import type { Db } from 'mongodb';
import { Model, type ModelOptions, type SyncIndexesOptions } from './model.js';
import type { BaseSchema } from './types.js';

export type { Model, ModelOptions, SyncIndexesResult } from './model.js';
export type * from './types.js';

export type SyncIndexesResults = {
  collectionName: string;
  created: string[];
  dropped: string[];
}[];

export class TypedMongo {
  // biome-ignore lint/suspicious/noExplicitAny: MongoDB model can be any type
  private models = new Map<string, Model<any>>();

  constructor(private db: Db) {}

  model<TSchema extends BaseSchema>(
    collectionName: string,
    options: ModelOptions = {},
  ): Model<TSchema> {
    const model = new Model<TSchema>(this.db, collectionName, options);
    this.models.set(collectionName, model);
    return model;
  }

  /**
   * Synchronize all declared indexes for all models
   * This method will sync indexes for all models:
   * 1. Get existing indexes from the database
   * 2. Create new indexes (MongoDB will skip existing ones)
   * 3. Calculate diff
   * 4. Drop obsolete indexes (_id index is default and should not be dropped)
   * @returns {Promise<SyncIndexesResults>}
   */
  async syncIndexes(options?: SyncIndexesOptions): Promise<SyncIndexesResults> {
    const results: SyncIndexesResults = [];

    for (const model of this.models.values()) {
      const result = await model.syncIndexes(options);
      results.push({
        collectionName: model.getCollection().collectionName,
        created: result.created,
        dropped: result.dropped,
      });
    }

    return results;
  }

  /**
   * Get all registered models
   */
  // biome-ignore lint/suspicious/noExplicitAny: MongoDB model can be any type
  getModels(): Map<string, Model<any>> {
    return this.models;
  }

  getDb(): Db {
    return this.db;
  }
}
