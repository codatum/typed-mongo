import type { Db, MongoClient } from 'mongodb';
import { Model } from './model.js';
import type { BaseSchema } from './types.js';

export type { Model } from './model.js';
export type * from './types.js';

export class TypedMongo {
  private mongoClient: MongoClient | undefined;

  constructor(
    private db: Db,
    mongoClient?: MongoClient,
  ) {
    this.mongoClient = mongoClient;
  }

  static initialize(db: Db, mongoClient?: MongoClient): TypedMongo {
    return new TypedMongo(db, mongoClient);
  }

  model<TSchema extends BaseSchema>(collectionName: string): Model<TSchema> {
    return new Model(this.db, collectionName);
  }

  getDb(): Db {
    return this.db;
  }
}
