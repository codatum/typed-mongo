import type { Db, MongoClient } from 'mongodb';
import { Model } from './model.js';
import type { BaseSchema } from './types.js';

export type { Model } from './model.js';
export type * from './types.js';

export class TypedMongo {
  constructor(private db: Db) {}

  model<TSchema extends BaseSchema>(collectionName: string): Model<TSchema> {
    return new Model(this.db, collectionName);
  }

  getDb(): Db {
    return this.db;
  }
}
