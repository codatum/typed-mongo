import { type BulkWriteResult, ObjectId } from 'mongodb';
import {
  afterAll,
  assertType,
  beforeAll,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  test,
} from 'vitest';
import { z } from 'zod';
import { Client } from '../src/index.js';
import type { Model } from '../src/model.js';
import { testDbManager } from './setup/mongodb-memory-server.js';

const userSchema = z
  .object({
    _id: z.string(),
    name: z.string(),
    age: z.number(),
    email: z.string().optional(),
    tags: z.array(z.string()).optional(),
    scores: z.array(z.number()).optional(),
    profile: z
      .object({
        bio: z.string(),
        avatar: z.string().optional(),
      })
      .optional(),
    settings: z
      .object({
        theme: z.string(),
        notifications: z.boolean(),
      })
      .optional(),
    metadata: z
      .object({
        created: z.date(),
        updated: z.date().optional(),
      })
      .optional(),
    counters: z.record(z.string(), z.number()).optional(),
  })
  .strict();

const postSchema = z
  .object({
    _id: z.instanceof(ObjectId),
    title: z.string(),
    content: z.string(),
    authorId: z.string(),
    tags: z.array(z.string()),
    likes: z.number(),
    comments: z.array(
      z.object({
        id: z.string(),
        text: z.string(),
        authorId: z.string(),
        createdAt: z.date(),
      }),
    ),
    published: z.boolean(),
    publishedAt: z.date().optional(),
    metadata: z.object({
      views: z.number(),
      shares: z.number(),
    }),
  })
  .strict();

type UserSchema = z.infer<typeof userSchema>;
type PostSchema = z.infer<typeof postSchema>;

describe('Type checking tests', () => {
  let client: Client;
  let User: Model<UserSchema>;
  let Post: Model<PostSchema>;

  beforeAll(async () => {
    const testDb = testDbManager.getDb();
    client = Client.initialize(testDb);
    User = client.model<UserSchema>('users');
    Post = client.model<PostSchema>('posts');
  });

  const testUser1 = {
    _id: 'user1',
    name: 'John',
    age: 30,
    profile: { bio: "John's bio" },
    settings: { theme: 'light', notifications: true },
    metadata: { created: new Date() },
  };
  const testUser2 = {
    _id: 'user2',
    name: 'Jane',
    age: 25,
  };
  const testPost1 = {
    _id: new ObjectId(),
    title: 'Post 1',
    content: 'Post 1 content',
    authorId: 'user1',
    tags: ['tag1', 'tag2'],
    likes: 0,
    comments: [],
    published: false,
    metadata: { views: 0, shares: 0 },
  };
  const testPost2 = {
    title: 'Post 2',
    content: 'Post 2 content',
    authorId: 'user1',
    tags: ['tag1', 'tag2'],
    likes: 0,
    comments: [],
    published: false,
    metadata: { views: 0, shares: 0 },
  };

  describe('findOne', () => {
    beforeAll(async () => {
      await User.deleteMany({});
      await User.insertMany([testUser1, testUser2]);
    });

    test('the findOne data type should match the schema-inferred type', async () => {
      const user = await User.findOne({ name: 'John' });
      expect(userSchema.safeParse(user).success).toBeTruthy();
      expect(user).toEqual(testUser1);
      assertType<z.infer<typeof userSchema> | null>(user);
    });

    test('the findOne projection data type should match the schema-inferred type', async () => {
      // _id is always included in the projection
      const projectedUserSchema = userSchema.pick({
        _id: true,
        name: true,
      });
      const projectedUserResult = await User.findOne({ name: 'John' }, { projection: { name: 1 } });
      expect(projectedUserSchema.safeParse(projectedUserResult).success).toBeTruthy();
      expect(projectedUserResult).toEqual({
        _id: 'user1',
        name: 'John',
      });
      assertType<z.infer<typeof projectedUserSchema> | null>(projectedUserResult);
    });
  });

  describe('findMany', () => {
    beforeAll(async () => {
      await User.deleteMany({});
      await User.insertMany([testUser1, testUser2]);
    });

    test('the findMany data type should match the schema-inferred type', async () => {
      const users = await User.findMany({});
      for (const user of users) {
        expect(userSchema.safeParse(user).success).toBeTruthy();
      }
      expect(users).toEqual([testUser1, testUser2]);
      assertType<z.infer<typeof userSchema>[]>(users);
    });
  });

  describe('insertOne', () => {
    beforeEach(async () => {
      await User.deleteMany({});
      await Post.deleteMany({});
    });

    test('the insertOne data type should match the schema-inferred type', async () => {
      const result = await User.insertOne(testUser1);

      expect(result).toEqual({
        acknowledged: true,
        insertedId: testUser1._id,
      });
      assertType<{
        acknowledged: boolean;
        insertedId: string;
      }>(result);
    });

    test('the insertOne data type should match the schema-inferred type with ObjectId', async () => {
      const result = await Post.insertOne(testPost1);
      expect(result).toEqual({
        acknowledged: true,
        insertedId: testPost1._id,
      });
      assertType<{
        acknowledged: boolean;
        insertedId: ObjectId;
      }>(result);
    });

    test('the insertOne data type should match the schema-inferred type with ObjectId', async () => {
      const result = await Post.insertOne(testPost2);
      expect(result.insertedId).toBeInstanceOf(ObjectId);
    });
  });
});
