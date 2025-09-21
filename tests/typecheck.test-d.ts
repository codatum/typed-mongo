import { type BulkWriteResult, ObjectId } from 'mongodb';
/**
 * Type-only tests for typed-mongo
 * This file is tested with: pnpm test --typecheck
 */
import { describe, expectTypeOf, test } from 'vitest';
import { Client } from '../src/index.js';
import type { Model } from '../src/model.js';
import { testDbManager } from './setup/mongodb-memory-server.js';

// Test schema types
type UserSchema = {
  _id: string;
  name: string;
  age: number;
  email?: string;
  tags?: string[];
  scores?: number[];
  profile?: {
    bio: string;
    avatar?: string;
  };
  settings?: {
    theme: string;
    notifications: boolean;
  };
  metadata?: {
    created: Date;
    updated?: Date;
  };
  counters?: Record<string, number>;
};

type PostSchema = {
  _id: ObjectId;
  title: string;
  content: string;
  authorId: string;
  tags: string[];
  likes: number;
  comments: Array<{
    id: string;
    text: string;
    authorId: string;
    createdAt: Date;
  }>;
  published: boolean;
  publishedAt?: Date;
  metadata: {
    views: number;
    shares: number;
  };
};

const testDb = testDbManager.getDb();
const client = Client.initialize(testDb);

const User = client.model<UserSchema>('users');
const Post = client.model<PostSchema>('posts');

describe('Type checking tests', () => {
  test('Model type inference', () => {
    expectTypeOf(User).toEqualTypeOf<Model<UserSchema>>();
    expectTypeOf(Post).toEqualTypeOf<Model<PostSchema>>();
  });

  describe('Find operations', () => {
    test('Check return types', async () => {
      const userResult = await User.findOne({ name: 'John' });
      expectTypeOf(userResult).toEqualTypeOf<UserSchema | null>();

      const cursor = User.find({});
      expectTypeOf(cursor).toHaveProperty('toArray');
      const arrayResult = await cursor.toArray();
      expectTypeOf(arrayResult).toEqualTypeOf<UserSchema[]>();

      const usersResult = await User.findMany({});
      expectTypeOf(usersResult).toEqualTypeOf<UserSchema[]>();
    });

    test('Check projection', async () => {
      const projectedUserResult = await User.findOne(
        { name: 'John' },
        { projection: { name: 1, profile: 1, 'settings.notifications': 1 } },
      );
      expectTypeOf(projectedUserResult).toEqualTypeOf<{
        _id: string;
        name: string;
        profile?: {
          bio: string;
          avatar?: string;
        };
        settings?: {
          notifications: boolean;
        };
      } | null>();

      const projectedUsersResult = await User.findMany(
        { name: 'John' },
        { projection: { _id: 1, name: 1 } },
      );
      expectTypeOf(projectedUsersResult).toEqualTypeOf<
        {
          _id: string;
          name: string;
        }[]
      >();
    });

    test('Check filter', async () => {
      const _ = await User.findOne({
        name: 'John',
        age: {
          $gt: 20,
          $lt: 40,
        },
        email: 'john@example.com',
        tags: 'user',
        scores: { $in: [100, 200] },
        'profile.bio': "John's bio",
      });
    });

    test('Filter type errors', async () => {
      // @ts-expect-error - non-existent field
      User.findOne({ nonExistentField: 'value' });

      // @ts-expect-error - wrong type for 'name'
      User.findOne({ name: 10 });

      // @ts-expect-error - wrong type for 'age'
      User.findOne({ age: 'thirty' });

      // @ts-expect-error - wrong type for 'email'
      User.findOne({ email: 123 });

      // @ts-expect-error - wrong type for 'tags'
      User.findOne({ tags: 123 });

      // @ts-expect-error - wrong type for 'scores'
      User.findOne({ scores: '100' });

      // @ts-expect-error - non-existent field
      User.findOne({ 'profile.nonExistentField': '' });

      // @ts-expect-error - wrong type for 'profile.bio'
      User.findOne({ 'profile.bio': 123 });
    });
  });

  describe('Insert operations', () => {
    test('Check return types', async () => {
      type UserInsertDoc = Parameters<typeof User.insertOne>[0];

      // Required fields must be present
      expectTypeOf<UserInsertDoc>().toEqualTypeOf<{
        _id: string;
        name: string;
        age: number;
        email?: string;
        tags?: string[];
        scores?: number[];
        profile?: {
          bio: string;
          avatar?: string;
        };
        settings?: {
          theme: string;
          notifications: boolean;
        };
        metadata?: {
          created: Date;
          updated?: Date;
        };
        counters?: Record<string, number>;
      }>();

      // Valid insertOne
      const userResult = await User.insertOne({
        _id: 'user1',
        name: 'John',
        age: 30,
      });
      expectTypeOf(userResult).toEqualTypeOf<{
        acknowledged: boolean;
        insertedId: string;
      }>();

      // Valid with optional fields
      const postResult = await Post.insertOne({
        title: 'Jane',
        content: 'Jane',
        authorId: 'user1',
        tags: ['user', 'admin'],
        likes: 0,
        comments: [],
        published: false,
        metadata: { views: 0, shares: 0 },
      });
      expectTypeOf(postResult).toEqualTypeOf<{
        acknowledged: boolean;
        insertedId: ObjectId;
      }>();

      // Valid with ObjectId _id
      const postResult2 = await Post.insertOne({
        _id: new ObjectId(),
        title: 'Jane',
        content: 'Jane',
        authorId: 'user1',
        tags: ['user', 'admin'],
        likes: 0,
        comments: [],
        published: false,
        metadata: { views: 0, shares: 0 },
      });
      expectTypeOf(postResult2).toEqualTypeOf<{
        acknowledged: boolean;
        insertedId: ObjectId;
      }>();

      const usersResult = await User.insertMany([
        {
          _id: 'user1',
          name: 'John',
          age: 30,
        },
        {
          _id: 'user2',
          name: 'Jane',
          age: 30,
        },
      ]);
      expectTypeOf(usersResult).toEqualTypeOf<{
        acknowledged: boolean;
        insertedCount: number;
        insertedIds: {
          [key: number]: string;
        };
      }>();
    });

    test('Insert type errors', async () => {
      // @ts-expect-error - _id is required if _id is not ObjectId
      User.insertOne({
        name: 'John',
        age: 30,
      });

      // @ts-expect-error - missing required field
      User.insertOne({
        _id: 'user1',
        name: 'John',
      });

      User.insertOne({
        _id: 'user1',
        name: 'John',
        // @ts-expect-error - wrong type for age
        age: 'thirty',
      });
    });
  });

  describe('Update operations', () => {
    test('Check return types', async () => {
      const updateOneResult = await User.updateOne({ name: 'John' }, { $set: { age: 31 } });
      expectTypeOf(updateOneResult).toEqualTypeOf<{
        acknowledged: boolean;
        matchedCount: number;
        modifiedCount: number;
        upsertedCount: number;
        upsertedId: string | null;
      }>();

      const updateManyResult = await User.updateMany({ name: 'John' }, { $set: { age: 31 } });
      expectTypeOf(updateManyResult).toEqualTypeOf<{
        acknowledged: boolean;
        matchedCount: number;
        modifiedCount: number;
        upsertedCount: number;
        upsertedId: string | null;
      }>();
    });

    test('Check findOneAndUpdate return types', async () => {
      const findOneAndUpdateResult = await User.findOneAndUpdate(
        { name: 'John' },
        { $set: { age: 31 } },
      );
      expectTypeOf(findOneAndUpdateResult).toEqualTypeOf<UserSchema | null>();

      const findOneAndUpdateResult2 = await User.findOneAndUpdate(
        { name: 'John' },
        { $set: { age: 31 } },
        { projection: { name: 1 } },
      );
      expectTypeOf(findOneAndUpdateResult2).toEqualTypeOf<{
        _id: string;
        name: string;
      } | null>();
    });

    test('Check UpdateFilter', async () => {
      await User.updateOne(
        { name: 'John' },
        {
          $set: {
            name: 'Jane',
            age: 31,
            email: 'jane@example.com',
            tags: ['user', 'admin'],
            scores: [100, 200],
            profile: {
              bio: "Jane's bio",
            },
            metadata: {
              created: new Date(),
            },
          },
          $unset: {
            email: '',
          },
          $push: {
            tags: 'new-tag',
            scores: 300,
          },
          $pull: {
            tags: 'old-tag',
          },
          $pullAll: {
            scores: [100, 200],
          },
          $pop: {
            tags: 1,
          },
          $rename: {
            age: 'yearsOld',
          },
          $currentDate: {
            lastLogin: true,
          },
          $addToSet: {
            tags: 'new-tag',
          },
        },
      );
    });

    test('Check UpdateFilter type errors', async () => {
      // @ts-expect-error - wrong type for _id
      User.updateOne({ name: 'John' }, { $set: { name: 31 } });

      // @ts-expect-error - wrong type for $push operator
      User.updateOne({ name: 'John' }, { $push: { tags: 123 } });

      // @ts-expect-error - wrong type for $pullAll operator
      User.updateOne({ name: 'John' }, { $pullAll: { tags: [123] } });

      // @ts-expect-error - wrong type for $pop operator
      User.updateOne({ name: 'John' }, { $pop: { tags: '1' } });

      // @ts-expect-error - wrong type for $rename operator
      User.updateOne({ name: 'John' }, { $rename: { age: 123 } });

      // @ts-expect-error - wrong type for $currentDate operator
      User.updateOne({ name: 'John' }, { $currentDate: { lastLogin: 'date' } });
    });
  });

  describe('Delete operations', () => {
    test('Check return types', async () => {
      const deleteOneResult = await User.deleteOne({ name: 'John' });
      expectTypeOf(deleteOneResult).toEqualTypeOf<{
        acknowledged: boolean;
        deletedCount: number;
      }>();

      const deleteManyResult = await User.deleteMany({ name: 'John' });
      expectTypeOf(deleteManyResult).toEqualTypeOf<{
        acknowledged: boolean;
        deletedCount: number;
      }>();
    });

    test('Check findOneAndDelete return types', async () => {
      const findOneAndDeleteResult = await User.findOneAndDelete({
        name: 'John',
      });
      expectTypeOf(findOneAndDeleteResult).toEqualTypeOf<UserSchema | null>();

      const findOneAndDeleteResult2 = await User.findOneAndDelete(
        { name: 'John' },
        { projection: { name: 1 } },
      );
      expectTypeOf(findOneAndDeleteResult2).toEqualTypeOf<{
        _id: string;
        name: string;
      } | null>();
    });
  });

  describe('Bulk write operations', () => {
    test('Check aggregate return types', async () => {
      const aggregateResult = await User.bulkWrite([
        {
          updateOne: {
            filter: { name: 'John' },
            update: { $set: { age: 31 } },
          },
        },
        {
          updateMany: {
            filter: { name: 'John' },
            update: { $set: { age: 31 } },
          },
        },
        {
          deleteOne: {
            filter: { name: 'John' },
          },
        },

        {
          deleteMany: {
            filter: { name: 'John' },
          },
        },

        {
          replaceOne: {
            filter: { name: 'John' },
            replacement: { name: 'John', age: 31 },
          },
        },
      ]);
      expectTypeOf(aggregateResult).toEqualTypeOf<BulkWriteResult>();
    });
  });

  describe('Count Documents operations', () => {
    test('Check countDocuments return types', async () => {
      const countDocumentsResult = await User.countDocuments({ name: 'John' });
      expectTypeOf(countDocumentsResult).toEqualTypeOf<number>();
    });
  });

  describe('Estimated Document Count operations', () => {
    test('Check estimatedDocumentCount return types', async () => {
      const estimatedDocumentCountResult = await User.estimatedDocumentCount();
      expectTypeOf(estimatedDocumentCountResult).toEqualTypeOf<number>();
    });
  });

  describe('Distinct operations', () => {
    test('Check distinct return types', async () => {
      const distinctResult = await User.distinct('name');
      expectTypeOf(distinctResult).toEqualTypeOf<string[]>();
    });
  });

  describe('Aggregate operations', () => {
    test('Check aggregate return types', async () => {
      const aggregateResult = await User.aggregate<UserSchema>([
        { $match: { name: 'John' } },
      ]).toArray();
      expectTypeOf(aggregateResult).toEqualTypeOf<UserSchema[]>();

      const aggregateResult2 = await User.aggregate<{
        _id: string;
        count: number;
      }>([
        { $group: { _id: '$name', count: { $sum: 1 } } },
        { $limit: 10 },
        { $skip: 0 },
        { $sort: { count: -1 } },
      ]).toArray();
      expectTypeOf(aggregateResult2).toEqualTypeOf<{ _id: string; count: number }[]>();
    });
  });
});
