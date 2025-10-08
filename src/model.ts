import type {
  AggregateOptions,
  AggregationCursor,
  AnyBulkWriteOperation,
  BulkWriteOptions,
  BulkWriteResult,
  Collection,
  CountDocumentsOptions,
  Db,
  DeleteOptions,
  DeleteResult,
  DistinctOptions,
  EstimatedDocumentCountOptions,
  Filter,
  FindCursor,
  FindOneAndDeleteOptions,
  FindOneAndReplaceOptions,
  FindOneAndUpdateOptions,
  FindOptions,
  IndexDescription,
  IndexInformationOptions,
  InsertManyResult,
  InsertOneOptions,
  InsertOneResult,
  OptionalUnlessRequiredId,
  ReplaceOptions,
  UpdateFilter,
  UpdateOptions,
  UpdateResult,
} from 'mongodb';
import { MongoServerError } from 'mongodb';
import type {
  BaseSchema,
  MongoBulkWriteOperation,
  MongoFilter,
  MongoUpdateFilter,
  Projection,
  ProjectionType,
  StrictOptionalId,
} from './types.js';

export type ModelOptions = {
  indexes?: IndexDescription[];
};

export type SyncIndexesResult = {
  created: string[];
  dropped: string[];
};

/**
 * Model class that provides type-safe MongoDB operations
 */
export class Model<TSchema extends BaseSchema> {
  private collection: Collection<TSchema>;
  private indexes: IndexDescription[] | undefined;

  constructor(db: Db, collectionName: string, options: ModelOptions = {}) {
    this.collection = db.collection<TSchema>(collectionName);
    this.indexes = options.indexes;
  }

  getCollection(): Collection<TSchema> {
    return this.collection;
  }

  /**
   * Synchronize indexes with the database
   * 1. Get existing indexes from database
   * 2. Create new indexes (MongoDB will skip existing ones)
   * 3. Calculate diff
   * 4. Drop obsolete indexes (_id index is default and should not be dropped)
   */
  async syncIndexes(options?: IndexInformationOptions): Promise<SyncIndexesResult> {
    if (!this.indexes || this.indexes.length === 0) {
      return {
        created: [],
        dropped: [],
      };
    }

    // Step 1: Get existing indexes from database
    let oldIndexNames: string[] = [];
    try {
      oldIndexNames = (await this.collection.listIndexes(options).toArray()).map(
        (index) => index.name,
      );
    } catch (error) {
      // If collection doesn't exist, there are no indexes
      if (error instanceof MongoServerError) {
        if (error.code === 26 || error.codeName === 'NamespaceNotFound') {
          oldIndexNames = [];
        }
      }
      throw error;
    }

    // Step 2: Create new indexes (MongoDB will skip existing ones)
    const newIndexNames = await this.collection.createIndexes(this.indexes);

    // Step 3: Calculate diff
    const oldIndexNamesSet = new Set(oldIndexNames);
    const newIndexNamesSet = new Set(newIndexNames);

    const toDropIndexNames = oldIndexNames.filter((item) => !newIndexNamesSet.has(item));
    const createdIndexNames = newIndexNames.filter((item) => !oldIndexNamesSet.has(item));

    // Step 4: Drop obsolete indexes (_id index is default and should not be dropped)
    const droppedIndexNames = [];
    for (const indexName of toDropIndexNames) {
      // _id index is default and should not be dropped
      if (indexName === '_id_') {
        continue;
      }

      await this.collection.dropIndex(indexName);
      droppedIndexNames.push(indexName);
    }

    return {
      created: createdIndexNames,
      dropped: droppedIndexNames,
    };
  }

  /**
   * Find a single document
   */
  async findOne<TProjection extends Projection<TSchema> | undefined>(
    filter: MongoFilter<TSchema>,
    options?: FindOptions<TSchema> & { projection?: TProjection },
  ): Promise<ProjectionType<TSchema, TProjection> | null> {
    const result = await this.collection.findOne(filter as Filter<TSchema>, options);
    return result as unknown as ProjectionType<TSchema, TProjection>;
  }

  /**
   * Find documents and return a cursor (MongoDB standard behavior)
   */
  findCursor<TProjection extends Projection<TSchema> | undefined>(
    filter: MongoFilter<TSchema>,
    options?: FindOptions<TSchema> & { projection?: TProjection },
  ): FindCursor<ProjectionType<TSchema, TProjection>> {
    return this.collection.find(filter as Filter<TSchema>, options) as unknown as FindCursor<
      ProjectionType<TSchema, TProjection>
    >;
  }

  /**
   * Find multiple documents and return as array (convenience method)
   */
  async find<TProjection extends Projection<TSchema> | undefined>(
    filter: MongoFilter<TSchema>,
    options?: FindOptions<TSchema> & { projection?: TProjection },
  ): Promise<ProjectionType<TSchema, TProjection>[]> {
    const cursor = this.collection.find(filter as Filter<TSchema>, options);
    const results = await cursor.toArray();
    return results as unknown as ProjectionType<TSchema, TProjection>[];
  }

  /**
   * Insert a single document
   */
  async insertOne(
    doc: StrictOptionalId<TSchema>,
    options?: InsertOneOptions,
  ): Promise<InsertOneResult<TSchema>> {
    const result = await this.collection.insertOne(
      doc as unknown as OptionalUnlessRequiredId<TSchema>,
      options,
    );
    return result;
  }

  /**
   * Insert multiple documents
   */
  async insertMany(
    docs: StrictOptionalId<TSchema>[],
    options?: BulkWriteOptions,
  ): Promise<InsertManyResult<TSchema>> {
    return this.collection.insertMany(
      docs as unknown as OptionalUnlessRequiredId<TSchema>[],
      options,
    );
  }

  /**
   * Update a single document
   */
  async updateOne(
    filter: MongoFilter<TSchema>,
    update: MongoUpdateFilter<TSchema>,
    options?: UpdateOptions,
  ): Promise<UpdateResult<TSchema>> {
    return this.collection.updateOne(
      filter as Filter<TSchema>,
      update as UpdateFilter<TSchema>,
      options,
    );
  }

  /**
   * Update multiple documents
   */
  async updateMany(
    filter: MongoFilter<TSchema>,
    update: MongoUpdateFilter<TSchema>,
    options?: UpdateOptions,
  ): Promise<UpdateResult<TSchema>> {
    return this.collection.updateMany(
      filter as Filter<TSchema>,
      update as UpdateFilter<TSchema>,
      options,
    );
  }

  /**
   * Replace a single document
   */
  async replaceOne(
    filter: MongoFilter<TSchema>,
    replacement: StrictOptionalId<TSchema>,
    options?: ReplaceOptions,
  ): Promise<UpdateResult<TSchema>> {
    return this.collection.replaceOne(filter as Filter<TSchema>, replacement as TSchema, options);
  }

  /**
   * Find and update a single document
   */
  async findOneAndUpdate<TProjection extends Projection<TSchema> | undefined>(
    filter: MongoFilter<TSchema>,
    update: MongoUpdateFilter<TSchema>,
    options?: FindOneAndUpdateOptions & { projection?: TProjection },
  ): Promise<ProjectionType<TSchema, TProjection> | null> {
    const result = await this.collection.findOneAndUpdate(
      filter as Filter<TSchema>,
      update as UpdateFilter<TSchema>,
      options || {},
    );
    return result as unknown as ProjectionType<TSchema, TProjection>;
  }

  /**
   * Find and replace a single document
   */
  async findOneAndReplace<TProjection extends Projection<TSchema> | undefined>(
    filter: MongoFilter<TSchema>,
    replacement: StrictOptionalId<TSchema>,
    options?: FindOneAndReplaceOptions & { projection?: TProjection },
  ): Promise<ProjectionType<TSchema, TProjection> | null> {
    const result = await this.collection.findOneAndReplace(
      filter as Filter<TSchema>,
      replacement as TSchema,
      options || {},
    );
    return result as unknown as ProjectionType<TSchema, TProjection>;
  }

  /**
   * Delete a single document
   */
  async deleteOne(filter: MongoFilter<TSchema>, options?: DeleteOptions): Promise<DeleteResult> {
    return this.collection.deleteOne(filter as Filter<TSchema>, options);
  }

  /**
   * Delete multiple documents
   */
  async deleteMany(filter: MongoFilter<TSchema>, options?: DeleteOptions): Promise<DeleteResult> {
    return this.collection.deleteMany(filter as Filter<TSchema>, options);
  }

  /**
   * Find and delete a single document
   */
  async findOneAndDelete<TProjection extends Projection<TSchema> | undefined>(
    filter: MongoFilter<TSchema>,
    options?: FindOneAndDeleteOptions & { projection?: TProjection },
  ): Promise<ProjectionType<TSchema, TProjection> | null> {
    const result = await this.collection.findOneAndDelete(filter as Filter<TSchema>, options || {});

    return result as unknown as ProjectionType<TSchema, TProjection>;
  }

  /**
   * Bulk write
   */
  async bulkWrite(
    operations: readonly MongoBulkWriteOperation<TSchema>[],
    options?: BulkWriteOptions,
  ): Promise<BulkWriteResult> {
    return this.collection.bulkWrite(operations as AnyBulkWriteOperation<TSchema>[], options);
  }

  /**
   * Count documents
   */
  async countDocuments(
    filter: MongoFilter<TSchema> = {},
    options?: CountDocumentsOptions,
  ): Promise<number> {
    return this.collection.countDocuments(filter as Filter<TSchema>, options);
  }

  /**
   * Estimated document count
   */
  async estimatedDocumentCount(options?: EstimatedDocumentCountOptions): Promise<number> {
    return this.collection.estimatedDocumentCount(options);
  }

  /**
   * Get distinct values
   */
  async distinct<K extends keyof TSchema>(
    key: K,
    filter: MongoFilter<TSchema> = {},
    options?: DistinctOptions,
  ): Promise<TSchema[K][]> {
    return this.collection.distinct(key as string, filter as Filter<TSchema>, options || {});
  }

  /**
   * Aggregate
   */
  // biome-ignore lint/suspicious/noExplicitAny: MongoDB aggregate can return any type
  aggregate<TResult = any>(
    pipeline: Record<string, unknown>[],
    options?: AggregateOptions,
  ): AggregationCursor<TResult> {
    return this.collection.aggregate(pipeline, options) as AggregationCursor<TResult>;
  }
}
