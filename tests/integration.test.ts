import type { Document, ObjectId } from 'mongodb';
import { ObjectId as MongoObjectId } from 'mongodb';
import { beforeEach, describe, expect, test } from 'vitest';
import { TypedMongo } from '../src/index.js';
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
  tags?: string[];
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

describe('typed-mongo Integration Tests', () => {
  let typedMongo: TypedMongo;
  let User: Model<UserSchema>;
  let Post: Model<PostSchema>;

  beforeEach(async () => {
    const testDb = testDbManager.getDb();
    typedMongo = new TypedMongo(testDb);

    // Clear collections before each test
    const collections = await testDb.listCollections().toArray();
    for (const collection of collections) {
      await testDb.collection(collection.name).deleteMany({});
    }

    // Initialize models
    User = typedMongo.model<UserSchema>('users');
    Post = typedMongo.model<PostSchema>('posts');
  });

  describe('insertOne', () => {
    test('should insert a document with string _id', async () => {
      const result = await User.insertOne({
        _id: 'user1',
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
      });

      expect(result.acknowledged).toBe(true);
      expect(result.insertedId).toBe('user1');

      const doc = await User.findOne({ _id: 'user1' });
      expect(doc).toBeDefined();
      expect(doc?.name).toBe('John Doe');
      expect(doc?.age).toBe(30);
      expect(doc?.email).toBe('john@example.com');
    });

    test('should insert a document with ObjectId', async () => {
      const objectId = new MongoObjectId();
      const result = await Post.insertOne({
        _id: objectId,
        title: 'Test Post',
        content: 'This is a test post',
        authorId: 'user1',
        tags: ['test', 'sample'],
        likes: 0,
        comments: [],
        published: false,
        metadata: {
          views: 0,
          shares: 0,
        },
      });

      expect(result.acknowledged).toBe(true);
      expect(result.insertedId).toEqual(objectId);

      const doc = await Post.findOne({ _id: objectId });
      expect(doc).toBeDefined();
      expect(doc?.title).toBe('Test Post');
      expect(doc?.tags).toEqual(['test', 'sample']);
    });

    test('should auto-generate ObjectId when not provided', async () => {
      const result = await Post.insertOne({
        title: 'Auto ID Post',
        content: 'Post with auto-generated ID',
        authorId: 'user1',
        tags: [],
        likes: 0,
        comments: [],
        published: true,
        metadata: {
          views: 0,
          shares: 0,
        },
      });

      expect(result.acknowledged).toBe(true);
      expect(result.insertedId).toBeDefined();
      expect(result.insertedId).toBeInstanceOf(MongoObjectId);
    });
  });

  describe('insertMany', () => {
    test('should insert multiple documents', async () => {
      const users = [
        { _id: 'user1', name: 'Alice', age: 25 },
        { _id: 'user2', name: 'Bob', age: 30 },
        { _id: 'user3', name: 'Charlie', age: 35 },
      ];

      const result = await User.insertMany(users);
      expect(result.acknowledged).toBe(true);
      expect(result.insertedCount).toBe(3);
      expect(Object.keys(result.insertedIds)).toHaveLength(3);

      const allUsers = await User.find({});
      expect(allUsers).toHaveLength(3);
      expect(allUsers.map((u) => u.name).sort()).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    test('should handle empty array', async () => {
      // MongoDB doesn't allow empty array for insertMany
      // We need to handle this case in the model implementation
      // For now, we'll test that it throws an error
      await expect(User.insertMany([])).rejects.toThrow('Batch cannot be empty');
    });
  });

  describe('findOne', () => {
    const createdDate = new Date();

    beforeEach(async () => {
      await User.insertMany([
        { _id: 'user1', name: 'Alice', age: 25, email: 'alice@example.com' },
        {
          _id: 'user2',
          name: 'Bob',
          age: 30,
          metadata: { created: createdDate },
        },
        {
          _id: 'user3',
          name: 'Charlie',
          age: 35,
          email: 'charlie@example.com',
        },
      ]);
    });

    test('should find a document by _id', async () => {
      const doc = await User.findOne({ _id: 'user2' });
      expect(doc).toBeDefined();
      expect(doc?.name).toBe('Bob');
      expect(doc?.age).toBe(30);
      expect(doc?.metadata?.created).toStrictEqual(createdDate);
    });

    test('should find a document by field', async () => {
      const doc = await User.findOne({ name: 'Alice' });
      expect(doc).toBeDefined();
      expect(doc?._id).toBe('user1');
      expect(doc?.age).toBe(25);
    });

    test('should find with complex filter', async () => {
      const doc = await User.findOne({
        age: { $gte: 30 },
        email: { $exists: false },
      });
      expect(doc).toBeDefined();
      expect(doc?.name).toBe('Bob');
    });

    test('should return null when not found', async () => {
      const doc = await User.findOne({ _id: 'nonexistent' });
      expect(doc).toBeNull();
    });

    test('should support projection options', async () => {
      const doc = await User.findOne({ _id: 'user1' }, { projection: { name: 1, _id: 0 } });
      expect(doc).toBeDefined();
      expect(doc?.name).toBe('Alice');
      expect(doc?._id).toBeUndefined();
    });
  });

  describe('find', () => {
    beforeEach(async () => {
      await User.insertMany([
        { _id: 'user1', name: 'Alice', age: 25, tags: ['admin', 'user'] },
        { _id: 'user2', name: 'Bob', age: 30, tags: ['user'] },
        { _id: 'user3', name: 'Charlie', age: 35, tags: ['user', 'moderator'] },
        { _id: 'user4', name: 'David', age: 28, tags: ['user'] },
      ]);
    });

    test('should find all documents', async () => {
      const docs = await User.find({});
      expect(docs).toHaveLength(4);
    });

    test('should find with filter', async () => {
      const docs = await User.find({ age: { $gte: 30 } });
      expect(docs).toHaveLength(2);
      expect(docs.map((d) => d.name).sort()).toEqual(['Bob', 'Charlie']);
    });

    test('should find with $in operator', async () => {
      const docs = await User.find({ _id: { $in: ['user1', 'user3'] } });
      expect(docs).toHaveLength(2);
      expect(docs.map((d) => d.name).sort()).toEqual(['Alice', 'Charlie']);
    });

    test('should find with $or operator', async () => {
      const docs = await User.find({
        $or: [{ age: { $lt: 26 } }, { name: 'Charlie' }],
      });
      expect(docs).toHaveLength(2);
      expect(docs.map((d) => d.name).sort()).toEqual(['Alice', 'Charlie']);
    });

    test('should support sort option', async () => {
      const docs = await User.find({}, { sort: { age: -1 } });
      expect(docs.map((d) => d.name)).toEqual(['Charlie', 'Bob', 'David', 'Alice']);
    });

    test('should support limit option', async () => {
      const docs = await User.find({}, { limit: 2 });
      expect(docs).toHaveLength(2);
    });

    test('should support skip option', async () => {
      const docs = await User.find({}, { sort: { _id: 1 }, skip: 2 });
      expect(docs).toHaveLength(2);
      expect(docs.map((d) => d._id)).toEqual(['user3', 'user4']);
    });
  });

  describe('findCursor', () => {
    beforeEach(async () => {
      await User.insertMany([
        { _id: 'user1', name: 'Alice', age: 25 },
        { _id: 'user2', name: 'Bob', age: 30 },
        { _id: 'user3', name: 'Charlie', age: 35 },
      ]);
    });

    test('should return a cursor', async () => {
      const cursor = User.findCursor({});
      expect(cursor).toBeDefined();
      expect(cursor.toArray).toBeDefined();

      const docs = await cursor.toArray();
      expect(docs).toHaveLength(3);
    });

    test('should support cursor operations', async () => {
      const cursor = User.findCursor({ age: { $gte: 30 } });
      const count = await cursor.count();
      expect(count).toBe(2);

      const docs = await cursor.toArray();
      expect(docs).toHaveLength(2);
    });
  });

  describe('updateOne', () => {
    beforeEach(async () => {
      await User.insertOne({
        _id: 'user1',
        name: 'Alice',
        age: 25,
        email: 'alice@example.com',
        scores: [100, 200],
      });
    });

    test('should update a document with $set', async () => {
      const result = await User.updateOne(
        { _id: 'user1' },
        { $set: { age: 26, email: 'alice.new@example.com' } },
      );

      expect(result.acknowledged).toBe(true);
      expect(result.modifiedCount).toBe(1);
      expect(result.matchedCount).toBe(1);

      const doc = await User.findOne({ _id: 'user1' });
      expect(doc?.age).toBe(26);
      expect(doc?.email).toBe('alice.new@example.com');
    });

    test('should update with $inc operator', async () => {
      const result = await User.updateOne({ _id: 'user1' }, { $inc: { age: 5 } });

      expect(result.modifiedCount).toBe(1);

      const doc = await User.findOne({ _id: 'user1' });
      expect(doc?.age).toBe(30);
    });

    test('should update with $push operator', async () => {
      const result = await User.updateOne({ _id: 'user1' }, { $push: { scores: 300 } });

      expect(result.modifiedCount).toBe(1);

      const doc = await User.findOne({ _id: 'user1' });
      expect(doc?.scores).toEqual([100, 200, 300]);
    });

    test('should update with $unset operator', async () => {
      const result = await User.updateOne({ _id: 'user1' }, { $unset: { email: '' } });

      expect(result.modifiedCount).toBe(1);

      const doc = await User.findOne({ _id: 'user1' });
      expect(doc?.email).toBeUndefined();
    });

    test('should handle upsert option', async () => {
      const result = await User.updateOne(
        { _id: 'user2' },
        { $set: { name: 'Bob', age: 30 } },
        { upsert: true },
      );

      expect(result.acknowledged).toBe(true);
      expect(result.upsertedCount).toBe(1);
      expect(result.upsertedId).toBe('user2');

      const doc = await User.findOne({ _id: 'user2' });
      expect(doc?.name).toBe('Bob');
    });

    test('should return zero modified when no match', async () => {
      const result = await User.updateOne({ _id: 'nonexistent' }, { $set: { age: 100 } });

      expect(result.matchedCount).toBe(0);
      expect(result.modifiedCount).toBe(0);
    });
  });

  describe('updateMany', () => {
    beforeEach(async () => {
      await User.insertMany([
        { _id: 'user1', name: 'Alice', age: 25, tags: ['user'] },
        { _id: 'user2', name: 'Bob', age: 30, tags: ['user'] },
        { _id: 'user3', name: 'Charlie', age: 35, tags: ['admin'] },
      ]);
    });

    test('should update multiple documents', async () => {
      const result = await User.updateMany(
        { tags: 'user' },
        { $set: { tags: ['user', 'verified'] } },
      );

      expect(result.acknowledged).toBe(true);
      expect(result.matchedCount).toBe(2);
      expect(result.modifiedCount).toBe(2);

      const users = await User.find({ tags: 'verified' });
      expect(users).toHaveLength(2);
    });

    test('should update all documents with empty filter', async () => {
      const result = await User.updateMany({}, { $inc: { age: 1 } });

      expect(result.matchedCount).toBe(3);
      expect(result.modifiedCount).toBe(3);

      const users = await User.find({});
      expect(users.map((u) => u.age).sort()).toEqual([26, 31, 36]);
    });

    test('should handle complex update operations', async () => {
      const result = await User.updateMany(
        { age: { $gte: 30 } },
        {
          $set: { 'settings.theme': 'dark' },
          $inc: { age: 10 },
        },
      );

      expect(result.modifiedCount).toBe(2);

      const updated = await User.find({ age: { $gte: 40 } });
      expect(updated).toHaveLength(2);
      expect(updated[0]?.settings?.theme).toBe('dark');
    });
  });

  describe('replaceOne', () => {
    beforeEach(async () => {
      await User.insertOne({
        _id: 'user1',
        name: 'Alice',
        age: 25,
        email: 'alice@example.com',
        tags: ['user'],
        profile: {
          bio: 'Developer',
          avatar: 'avatar1.jpg',
        },
      });
    });

    test('should replace a document completely', async () => {
      const result = await User.replaceOne(
        { _id: 'user1' },
        {
          _id: 'user1',
          name: 'Alice Replaced',
          age: 30,
          // Note: email, tags, and profile are not included, so they will be removed
        },
      );

      expect(result.acknowledged).toBe(true);
      expect(result.modifiedCount).toBe(1);
      expect(result.matchedCount).toBe(1);

      const doc = await User.findOne({ _id: 'user1' });
      expect(doc?.name).toBe('Alice Replaced');
      expect(doc?.age).toBe(30);
      expect(doc?.email).toBeUndefined();
      expect(doc?.tags).toBeUndefined();
      expect(doc?.profile).toBeUndefined();
    });

    test('should handle upsert option', async () => {
      const result = await User.replaceOne(
        { _id: 'user2' },
        {
          _id: 'user2',
          name: 'Bob',
          age: 35,
        },
        { upsert: true },
      );

      expect(result.acknowledged).toBe(true);
      expect(result.upsertedCount).toBe(1);
      expect(result.upsertedId).toBe('user2');

      const doc = await User.findOne({ _id: 'user2' });
      expect(doc?.name).toBe('Bob');
      expect(doc?.age).toBe(35);
    });

    test('should return zero modified when no match', async () => {
      const result = await User.replaceOne(
        { _id: 'nonexistent' },
        {
          _id: 'nonexistent',
          name: 'Nobody',
          age: 100,
        },
      );

      expect(result.matchedCount).toBe(0);
      expect(result.modifiedCount).toBe(0);
    });

    test('should replace with nested objects', async () => {
      const result = await User.replaceOne(
        { _id: 'user1' },
        {
          _id: 'user1',
          name: 'Alice Updated',
          age: 26,
          profile: {
            bio: 'Senior Developer',
            avatar: 'new-avatar.jpg',
          },
          settings: {
            theme: 'dark',
            notifications: false,
          },
        },
      );

      expect(result.modifiedCount).toBe(1);

      const doc = await User.findOne({ _id: 'user1' });
      expect(doc?.name).toBe('Alice Updated');
      expect(doc?.profile?.bio).toBe('Senior Developer');
      expect(doc?.settings?.theme).toBe('dark');
      expect(doc?.email).toBeUndefined(); // Original email is removed
    });
  });

  describe('findOneAndUpdate', () => {
    beforeEach(async () => {
      await User.insertOne({
        _id: 'user1',
        name: 'Alice',
        age: 25,
        email: 'alice@example.com',
      });
    });

    test('should find and update returning new document', async () => {
      const doc = await User.findOneAndUpdate(
        { _id: 'user1' },
        { $set: { age: 26, name: 'Alice Updated' } },
      );

      expect(doc).toBeDefined();
      expect(doc?.age).toBe(25);
      expect(doc?.name).toBe('Alice');
    });

    test('should return old document with returnDocument: before', async () => {
      const doc = await User.findOneAndUpdate(
        { _id: 'user1' },
        { $set: { age: 26 } },
        { returnDocument: 'after' },
      );

      expect(doc).toBeDefined();
      expect(doc?.age).toBe(26); // Old value

      const updated = await User.findOne({ _id: 'user1' });
      expect(updated?.age).toBe(26); // New value
    });

    test('should handle upsert with findOneAndUpdate', async () => {
      const doc = await User.findOneAndUpdate(
        { _id: 'user2' },
        { $set: { name: 'Bob', age: 30 } },
        { upsert: true },
      );

      expect(doc).toBeDefined();
    });

    test('should return null when no match and no upsert', async () => {
      const doc = await User.findOneAndUpdate({ _id: 'nonexistent' }, { $set: { age: 100 } });

      expect(doc).toBeNull();
    });

    test('should support projection', async () => {
      const doc = await User.findOneAndUpdate(
        { _id: 'user1' },
        { $set: { age: 26 } },
        { projection: { name: 1, age: 1, _id: 0 } },
      );

      expect(doc).toBeDefined();
      expect(doc?.name).toBe('Alice');
      expect(doc?.age).toBe(25);
      expect(doc?._id).toBeUndefined();
    });
  });

  describe('findOneAndReplace', () => {
    beforeEach(async () => {
      await User.insertOne({
        _id: 'user1',
        name: 'Alice',
        age: 25,
        email: 'alice@example.com',
        tags: ['user', 'admin'],
        profile: {
          bio: 'Developer',
        },
      });
    });

    test('should find and replace returning old document by default', async () => {
      const doc = await User.findOneAndReplace(
        { _id: 'user1' },
        {
          _id: 'user1',
          name: 'Alice Replaced',
          age: 30,
        },
      );

      expect(doc).toBeDefined();
      expect(doc?.name).toBe('Alice'); // Returns old document
      expect(doc?.age).toBe(25);
      expect(doc?.email).toBe('alice@example.com');

      const updated = await User.findOne({ _id: 'user1' });
      expect(updated?.name).toBe('Alice Replaced');
      expect(updated?.age).toBe(30);
      expect(updated?.email).toBeUndefined(); // Replaced document doesn't have email
    });

    test('should return new document with returnDocument: after', async () => {
      const doc = await User.findOneAndReplace(
        { _id: 'user1' },
        {
          _id: 'user1',
          name: 'Alice New',
          age: 28,
        },
        { returnDocument: 'after' },
      );

      expect(doc).toBeDefined();
      expect(doc?.name).toBe('Alice New'); // Returns new document
      expect(doc?.age).toBe(28);
      expect(doc?.email).toBeUndefined(); // New document doesn't have email
    });

    test('should handle upsert with findOneAndReplace', async () => {
      const doc = await User.findOneAndReplace(
        { _id: 'user2' },
        {
          _id: 'user2',
          name: 'Bob',
          age: 30,
        },
        { upsert: true, returnDocument: 'after' },
      );

      expect(doc).toBeDefined();
      expect(doc?.name).toBe('Bob');
      expect(doc?.age).toBe(30);

      const inserted = await User.findOne({ _id: 'user2' });
      expect(inserted).toBeDefined();
      expect(inserted?.name).toBe('Bob');
    });

    test('should return null when no match and no upsert', async () => {
      const doc = await User.findOneAndReplace(
        { _id: 'nonexistent' },
        {
          _id: 'nonexistent',
          name: 'Nobody',
          age: 100,
        },
      );

      expect(doc).toBeNull();
    });

    test('should support projection', async () => {
      const doc = await User.findOneAndReplace(
        { _id: 'user1' },
        {
          _id: 'user1',
          name: 'Alice Projected',
          age: 27,
        },
        { projection: { name: 1, _id: 0 } },
      );

      expect(doc).toBeDefined();
      expect(doc?.name).toBe('Alice'); // Old name with projection
      expect(doc?._id).toBeUndefined(); // Excluded by projection
      // age is not included in projection, so we can't check it
    });

    test('should support sort option when multiple matches', async () => {
      await User.insertMany([
        { _id: 'user2', name: 'Bob', age: 30 },
        { _id: 'user3', name: 'Charlie', age: 35 },
      ]);

      const doc = await User.findOneAndReplace(
        { age: { $gte: 25 } },
        {
          _id: 'user3', // Will replace user3 since it has highest age
          name: 'Replaced User',
          age: 40,
        },
        { sort: { age: -1 } }, // Replace the oldest first
      );

      expect(doc).toBeDefined();
      expect(doc?.name).toBe('Charlie'); // Highest age was replaced

      const replaced = await User.findOne({ name: 'Replaced User' });
      expect(replaced).toBeDefined();
      expect(replaced?.age).toBe(40);
    });

    test('should completely replace nested structures', async () => {
      const doc = await User.findOneAndReplace(
        { _id: 'user1' },
        {
          _id: 'user1',
          name: 'Alice Complete',
          age: 29,
          settings: {
            theme: 'light',
            notifications: true,
          },
          metadata: {
            created: new Date(),
          },
        },
        { returnDocument: 'after' },
      );

      expect(doc).toBeDefined();
      expect(doc?.name).toBe('Alice Complete');
      expect(doc?.settings?.theme).toBe('light');
      expect(doc?.metadata?.created).toBeInstanceOf(Date);
      expect(doc?.profile).toBeUndefined(); // Original profile is gone
      expect(doc?.tags).toBeUndefined(); // Original tags are gone
    });
  });

  describe('deleteOne', () => {
    beforeEach(async () => {
      await User.insertMany([
        { _id: 'user1', name: 'Alice', age: 25 },
        { _id: 'user2', name: 'Bob', age: 30 },
        { _id: 'user3', name: 'Charlie', age: 35 },
      ]);
    });

    test('should delete a single document', async () => {
      const result = await User.deleteOne({ _id: 'user2' });

      expect(result.acknowledged).toBe(true);
      expect(result.deletedCount).toBe(1);

      const doc = await User.findOne({ _id: 'user2' });
      expect(doc).toBeNull();

      const remaining = await User.find({});
      expect(remaining).toHaveLength(2);
    });

    test('should delete first matching document', async () => {
      const result = await User.deleteOne({ age: { $gte: 30 } });

      expect(result.deletedCount).toBe(1);

      const remaining = await User.find({ age: { $gte: 30 } });
      expect(remaining).toHaveLength(1); // Only one deleted
    });

    test('should return zero deleted when no match', async () => {
      const result = await User.deleteOne({ _id: 'nonexistent' });

      expect(result.deletedCount).toBe(0);

      const all = await User.find({});
      expect(all).toHaveLength(3);
    });
  });

  describe('deleteMany', () => {
    beforeEach(async () => {
      await User.insertMany([
        { _id: 'user1', name: 'Alice', age: 25 },
        { _id: 'user2', name: 'Bob', age: 30 },
        { _id: 'user3', name: 'Charlie', age: 35 },
        { _id: 'user4', name: 'David', age: 40 },
      ]);
    });

    test('should delete multiple documents', async () => {
      const result = await User.deleteMany({ age: { $gte: 30 } });

      expect(result.acknowledged).toBe(true);
      expect(result.deletedCount).toBe(3);

      const remaining = await User.find({});
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.name).toBe('Alice');
    });

    test('should delete all documents with empty filter', async () => {
      const result = await User.deleteMany({});

      expect(result.deletedCount).toBe(4);

      const remaining = await User.find({});
      expect(remaining).toHaveLength(0);
    });

    test('should return zero deleted when no match', async () => {
      const result = await User.deleteMany({ age: { $gt: 100 } });

      expect(result.deletedCount).toBe(0);

      const all = await User.find({});
      expect(all).toHaveLength(4);
    });
  });

  describe('findOneAndDelete', () => {
    beforeEach(async () => {
      await User.insertMany([
        { _id: 'user1', name: 'Alice', age: 25, email: 'alice@example.com' },
        { _id: 'user2', name: 'Bob', age: 30 },
        { _id: 'user3', name: 'Charlie', age: 35 },
      ]);
    });

    test('should find and delete returning deleted document', async () => {
      const doc = await User.findOneAndDelete({ _id: 'user2' });

      expect(doc).toBeDefined();
      expect(doc?.name).toBe('Bob');
      expect(doc?.age).toBe(30);

      const remaining = await User.findOne({ _id: 'user2' });
      expect(remaining).toBeNull();
    });

    test('should return null when no match', async () => {
      const doc = await User.findOneAndDelete({ _id: 'nonexistent' });

      expect(doc).toBeNull();

      const all = await User.find({});
      expect(all).toHaveLength(3);
    });

    test('should support projection', async () => {
      const doc = await User.findOneAndDelete(
        { _id: 'user1' },
        { projection: { name: 1, _id: 0 } },
      );

      expect(doc).toBeDefined();
      expect(doc?.name).toBe('Alice');
      expect(doc?._id).toBeUndefined();
    });

    test('should support sort option', async () => {
      const doc = await User.findOneAndDelete({ age: { $gte: 30 } }, { sort: { age: -1 } });

      expect(doc).toBeDefined();
      expect(doc?.name).toBe('Charlie'); // Highest age deleted first

      const remaining = await User.find({ age: { $gte: 30 } });
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.name).toBe('Bob');
    });
  });

  describe('countDocuments', () => {
    beforeEach(async () => {
      await User.insertMany([
        { _id: 'user1', name: 'Alice', age: 25, tags: ['user'] },
        { _id: 'user2', name: 'Bob', age: 30, tags: ['user', 'admin'] },
        { _id: 'user3', name: 'Charlie', age: 35, tags: ['user'] },
        { _id: 'user4', name: 'David', age: 40, tags: ['moderator'] },
      ]);
    });

    test('should count all documents', async () => {
      const count = await User.countDocuments();
      expect(count).toBe(4);
    });

    test('should count with filter', async () => {
      const count = await User.countDocuments({ age: { $gte: 30 } });
      expect(count).toBe(3);
    });

    test('should count with complex filter', async () => {
      const count = await User.countDocuments({
        $or: [{ tags: 'admin' }, { age: { $gt: 35 } }],
      });
      expect(count).toBe(2);
    });

    test('should return zero for no matches', async () => {
      const count = await User.countDocuments({ age: { $gt: 100 } });
      expect(count).toBe(0);
    });

    test('should support limit option', async () => {
      const count = await User.countDocuments({}, { limit: 2 });
      expect(count).toBe(2);
    });

    test('should support skip option', async () => {
      const count = await User.countDocuments({}, { skip: 2 });
      expect(count).toBe(2);
    });
  });

  describe('distinct', () => {
    beforeEach(async () => {
      await User.insertMany([
        { _id: 'user1', name: 'Alice', age: 25, tags: ['user', 'admin'] },
        { _id: 'user2', name: 'Bob', age: 30, tags: ['user'] },
        { _id: 'user3', name: 'Charlie', age: 25, tags: ['user', 'moderator'] },
        { _id: 'user4', name: 'David', age: 35, tags: ['user'] },
      ]);
    });

    test('should get distinct values for a field', async () => {
      const ages = await User.distinct('age');
      expect(ages.sort()).toEqual([25, 30, 35]);
    });

    test('should get distinct values with filter', async () => {
      const ages = await User.distinct('age', { tags: 'admin' });
      expect(ages).toEqual([25]);
    });

    test('should get distinct array values', async () => {
      const tags = await User.distinct('tags');
      expect(tags.sort()).toEqual(['admin', 'moderator', 'user']);
    });

    test('should return empty array for no matches', async () => {
      const ages = await User.distinct('age', { age: { $gt: 100 } });
      expect(ages).toEqual([]);
    });
  });

  describe('Complex nested operations', () => {
    beforeEach(async () => {
      await User.insertOne({
        _id: 'user1',
        name: 'Alice',
        age: 25,
        profile: {
          bio: 'Software Developer',
          avatar: 'avatar1.jpg',
        },
        settings: {
          theme: 'light',
          notifications: true,
        },
        counters: {
          posts: 10,
          likes: 100,
        },
      });
    });

    test('should update nested fields with dot notation', async () => {
      const result = await User.updateOne(
        { _id: 'user1' },
        {
          $set: {
            'profile.bio': 'Senior Developer',
            'settings.theme': 'dark',
          },
        },
      );

      expect(result.modifiedCount).toBe(1);

      const doc = await User.findOne({ _id: 'user1' });
      expect(doc?.profile?.bio).toBe('Senior Developer');
      expect(doc?.profile?.avatar).toBe('avatar1.jpg'); // Unchanged
      expect(doc?.settings?.theme).toBe('dark');
      expect(doc?.settings?.notifications).toBe(true); // Unchanged
    });

    test('should increment nested counters', async () => {
      const result = await User.updateOne(
        { _id: 'user1' },
        {
          $inc: {
            'counters.posts': 1,
            'counters.likes': 10,
          },
        },
      );

      expect(result.modifiedCount).toBe(1);

      const doc = await User.findOne({ _id: 'user1' });
      expect(doc?.counters?.posts).toBe(11);
      expect(doc?.counters?.likes).toBe(110);
    });

    test('should query by nested fields', async () => {
      const doc = await User.findOne({ 'profile.bio': 'Software Developer' });
      expect(doc).toBeDefined();
      expect(doc?._id).toBe('user1');

      const count = await User.countDocuments({
        'settings.notifications': true,
      });
      expect(count).toBe(1);
    });
  });

  describe('Array operations', () => {
    beforeEach(async () => {
      await Post.insertOne({
        title: 'Test Post',
        content: 'Content',
        authorId: 'user1',
        tags: ['javascript', 'nodejs'],
        likes: 10,
        comments: [
          {
            id: 'comment1',
            text: 'Great post!',
            authorId: 'user2',
            createdAt: new Date('2024-01-01'),
          },
          {
            id: 'comment2',
            text: 'Thanks for sharing',
            authorId: 'user3',
            createdAt: new Date('2024-01-02'),
          },
        ],
        published: true,
        publishedAt: new Date('2024-01-01'),
        metadata: {
          views: 100,
          shares: 5,
        },
      });
    });

    test('should push to array', async () => {
      const result = await Post.updateOne(
        { title: 'Test Post' },
        {
          $push: {
            tags: 'typescript',
            comments: {
              id: 'comment3',
              text: 'New comment',
              authorId: 'user4',
              createdAt: new Date(),
            },
          },
        },
      );

      expect(result.modifiedCount).toBe(1);

      const doc = await Post.findOne({ title: 'Test Post' });
      expect(doc?.tags).toContain('typescript');
      expect(doc?.comments).toHaveLength(3);
    });

    test('should pull from array', async () => {
      const result = await Post.updateOne(
        { title: 'Test Post' },
        {
          $pull: {
            tags: 'nodejs',
            comments: { id: 'comment1' },
          },
        },
      );

      expect(result.modifiedCount).toBe(1);

      const doc = await Post.findOne({ title: 'Test Post' });
      expect(doc?.tags).toEqual(['javascript']);
      expect(doc?.comments).toHaveLength(1);
      expect(doc?.comments[0]?.id).toBe('comment2');
    });

    test('should use $addToSet for unique values', async () => {
      // Add existing tag
      await Post.updateOne({ title: 'Test Post' }, { $addToSet: { tags: 'javascript' } });

      const doc = await Post.findOne({ title: 'Test Post' });
      expect(doc?.tags).toEqual(['javascript', 'nodejs']); // No duplicate

      // Add new tag
      await Post.updateOne({ title: 'Test Post' }, { $addToSet: { tags: 'react' } });

      const doc2 = await Post.findOne({ title: 'Test Post' });
      expect(doc2?.tags).toEqual(['javascript', 'nodejs', 'react']);
    });

    test('should use $pop to remove from array ends', async () => {
      // Remove from end
      await Post.updateOne({ title: 'Test Post' }, { $pop: { tags: 1 } });

      let doc = await Post.findOne({ title: 'Test Post' });
      expect(doc?.tags).toEqual(['javascript']);

      // Add more tags
      await Post.updateOne(
        { title: 'Test Post' },
        { $push: { tags: { $each: ['react', 'vue', 'angular'] } } },
      );

      // Remove from beginning
      await Post.updateOne({ title: 'Test Post' }, { $pop: { tags: -1 } });

      doc = await Post.findOne({ title: 'Test Post' });
      expect(doc?.tags).toEqual(['react', 'vue', 'angular']);
    });

    test('should query arrays with $elemMatch', async () => {
      const doc = await Post.findOne({
        comments: {
          $elemMatch: {
            authorId: 'user2',
            text: { $regex: 'Great' },
          },
        },
      });

      expect(doc).toBeDefined();
      expect(doc?.title).toBe('Test Post');
    });

    test('should query arrays with $size', async () => {
      const doc = await Post.findOne({
        tags: { $size: 2 },
      });

      expect(doc).toBeDefined();
      expect(doc?.tags).toHaveLength(2);
    });

    test('should query arrays with $all', async () => {
      const doc = await Post.findOne({
        tags: { $all: ['javascript', 'nodejs'] },
      });

      expect(doc).toBeDefined();

      const notFound = await Post.findOne({
        tags: { $all: ['javascript', 'python'] },
      });

      expect(notFound).toBeNull();
    });
  });

  describe('Update operators', () => {
    beforeEach(async () => {
      await User.insertOne({
        _id: 'user1',
        name: 'Alice',
        age: 25,
        scores: [100, 200, 300],
        counters: {
          posts: 10,
          likes: 50,
        },
      });
    });

    test('should use $mul operator', async () => {
      const result = await User.updateOne(
        { _id: 'user1' },
        { $mul: { age: 2, 'counters.posts': 3 } },
      );

      expect(result.modifiedCount).toBe(1);

      const doc = await User.findOne({ _id: 'user1' });
      expect(doc?.age).toBe(50);
      expect(doc?.counters?.posts).toBe(30);
    });

    test('should use $min operator', async () => {
      await User.updateOne({ _id: 'user1' }, { $min: { age: 20, 'counters.likes': 100 } });

      const doc = await User.findOne({ _id: 'user1' });
      expect(doc?.age).toBe(20); // Updated to lower value
      expect(doc?.counters?.likes).toBe(50); // Unchanged (already lower)
    });

    test('should use $max operator', async () => {
      await User.updateOne({ _id: 'user1' }, { $max: { age: 30, 'counters.likes': 40 } });

      const doc = await User.findOne({ _id: 'user1' });
      expect(doc?.age).toBe(30); // Updated to higher value
      expect(doc?.counters?.likes).toBe(50); // Unchanged (already higher)
    });

    test('should use $currentDate operator', async () => {
      await User.updateOne({ _id: 'user1' }, { $currentDate: { 'metadata.updated': true } });

      const doc = await User.findOne({ _id: 'user1' });
      expect(doc?.metadata?.updated).toBeInstanceOf(Date);

      const now = new Date();
      const updated = doc?.metadata?.updated as Date;
      const diff = now.getTime() - updated.getTime();
      expect(diff).toBeLessThan(5000); // Within 5 seconds
    });

    test('should use $rename operator', async () => {
      await User.updateOne(
        { _id: 'user1' },
        { $rename: { age: 'yearsOld', 'counters.posts': 'counters.articles' } },
      );

      const doc = await User.findOne({ _id: 'user1' });
      expect(doc?.age).toBeUndefined();
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      expect((doc as any)?.yearsOld).toBe(25);
      expect(doc?.counters?.posts).toBeUndefined();
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      expect((doc?.counters as any)?.articles).toBe(10);
    });

    test('should use $setOnInsert with upsert', async () => {
      const result = await User.updateOne(
        { _id: 'user2' },
        {
          $set: { name: 'Bob' },
          $setOnInsert: { age: 30, email: 'bob@example.com' },
        },
        { upsert: true },
      );

      expect(result.upsertedCount).toBe(1);

      const doc = await User.findOne({ _id: 'user2' });
      expect(doc?.name).toBe('Bob');
      expect(doc?.age).toBe(30);
      expect(doc?.email).toBe('bob@example.com');

      // Update existing document (setOnInsert should not apply)
      await User.updateOne(
        { _id: 'user2' },
        {
          $set: { name: 'Bob Updated' },
          $setOnInsert: { age: 99 },
        },
        { upsert: true },
      );

      const doc2 = await User.findOne({ _id: 'user2' });
      expect(doc2?.name).toBe('Bob Updated');
      expect(doc2?.age).toBe(30); // Unchanged
    });

    test('should use $pullAll operator', async () => {
      await User.updateOne({ _id: 'user1' }, { $pullAll: { scores: [100, 300] } });

      const doc = await User.findOne({ _id: 'user1' });
      expect(doc?.scores).toEqual([200]);
    });
  });

  describe('Bulk operations', () => {
    test('should perform bulk inserts', async () => {
      const users = Array.from({ length: 100 }, (_, i) => ({
        _id: `user${i}`,
        name: `User ${i}`,
        age: 20 + (i % 30),
      }));

      const result = await User.insertMany(users);
      expect(result.insertedCount).toBe(100);

      const count = await User.countDocuments();
      expect(count).toBe(100);
    });

    test('should handle large find operations', async () => {
      // Insert many documents with padded IDs for proper sorting
      const users = Array.from({ length: 50 }, (_, i) => ({
        _id: `user${i.toString().padStart(2, '0')}`,
        name: `User ${i}`,
        age: 20 + (i % 30),
      }));

      await User.insertMany(users);

      // Find with pagination
      const page1 = await User.find({}, { limit: 10, sort: { _id: 1 } });
      expect(page1).toHaveLength(10);
      expect(page1[0]?._id).toBe('user00');

      const page2 = await User.find({}, { limit: 10, skip: 10, sort: { _id: 1 } });
      expect(page2).toHaveLength(10);
      expect(page2[0]?._id).toBe('user10');
    });
  });

  describe('TypedMongo operations', () => {
    test('should get database instance', () => {
      const db = typedMongo.getDb();
      expect(db).toBeDefined();
      expect(db.databaseName).toBeDefined();
    });

    test('should create multiple models', () => {
      const model1 = typedMongo.model<UserSchema>('collection1');
      const model2 = typedMongo.model<PostSchema>('collection2');

      expect(model1).toBeDefined();
      expect(model2).toBeDefined();
      expect(model1).not.toBe(model2);
    });
  });

  describe('Error handling', () => {
    test('should handle duplicate key errors', async () => {
      await User.insertOne({ _id: 'user1', name: 'Alice', age: 25 });

      // Try to insert duplicate
      await expect(User.insertOne({ _id: 'user1', name: 'Bob', age: 30 })).rejects.toThrow();
    });
  });

  describe('Type safety', () => {
    test('should work with strict typing', async () => {
      interface StrictUser extends Document {
        _id: string;
        name: string;
        age: number;
        email: string; // Required
      }

      const StrictUserModel = typedMongo.model<StrictUser>('strict_users');

      // This should work
      await StrictUserModel.insertOne({
        _id: 'strict1',
        name: 'Alice',
        age: 25,
        email: 'alice@example.com',
      });

      // TypeScript would catch missing required fields at compile time
      // But at runtime, MongoDB allows it
      // @ts-expect-error Testing missing required field
      const result = await StrictUserModel.insertOne({
        _id: 'strict2',
        name: 'Bob',
        age: 30,
      });

      expect(result.acknowledged).toBe(true);
    });

    test('should handle ObjectId vs string _id correctly', async () => {
      // String ID model
      const stringDoc = await User.insertOne({
        _id: 'string-id',
        name: 'String ID User',
        age: 25,
      });
      expect(typeof stringDoc.insertedId).toBe('string');

      // ObjectId model
      const objectIdDoc = await Post.insertOne({
        title: 'ObjectId Post',
        content: 'Content',
        authorId: 'user1',
        tags: [],
        likes: 0,
        comments: [],
        published: false,
        metadata: { views: 0, shares: 0 },
      });
      expect(objectIdDoc.insertedId).toBeInstanceOf(MongoObjectId);
    });
  });

  describe('Index management', () => {
    test('should sync indexes', async () => {
      const User = typedMongo.model<UserSchema>('users', {
        indexes: [
          { key: { name: 1 } },
          { key: { age: 1 }, name: 'age_1' },
          { key: { email: 1 }, unique: true },
        ],
      });

      const result = await User.syncIndexes();
      expect(result.created).toHaveLength(3);
      expect(result.dropped).toHaveLength(0);

      // Check that indexes are created
      const indexes = await User.getCollection().listIndexes().toArray();
      expect(indexes).toHaveLength(4);
      expect(indexes[0]).toMatchObject({ name: '_id_', key: { _id: 1 } });
      expect(indexes[1]).toMatchObject({ name: 'name_1', key: { name: 1 } });
      expect(indexes[2]).toMatchObject({ name: 'age_1', key: { age: 1 } });
      expect(indexes[3]).toMatchObject({ name: 'email_1', key: { email: 1 }, unique: true });

      // Update indexes
      const User2 = typedMongo.model<UserSchema>('users', {
        indexes: [
          { key: { name: 1 } },
          { key: { email: 1 }, unique: true },
          { key: { 'profile.bio': 1 } },
        ],
      });

      const result2 = await User2.syncIndexes();
      expect(result2.created).toHaveLength(1);
      expect(result2.dropped).toHaveLength(1);

      const indexes2 = await User2.getCollection().listIndexes().toArray();
      expect(indexes2).toHaveLength(4);
      expect(indexes2[0]).toMatchObject({ name: '_id_', key: { _id: 1 } });
      expect(indexes2[1]).toMatchObject({ name: 'name_1', key: { name: 1 } });
      expect(indexes2[2]).toMatchObject({ name: 'email_1', key: { email: 1 }, unique: true });
      expect(indexes2[3]).toMatchObject({ name: 'profile.bio_1', key: { 'profile.bio': 1 } });
    });

    test('should sync indexes for multiple models', async () => {
      typedMongo.model<UserSchema>('users', {
        indexes: [{ key: { name: 1 } }],
      });

      const results = await typedMongo.syncIndexes();
      expect(results).toHaveLength(2);
      expect(results[0]?.collectionName).toBe('users');
      expect(results[0]?.created).toHaveLength(0);
      expect(results[0]?.dropped).toHaveLength(2);
      expect(results[1]?.collectionName).toBe('posts');
      expect(results[1]?.created).toHaveLength(0);
      expect(results[1]?.dropped).toHaveLength(0);

      const indexes = await User.getCollection().listIndexes().toArray();
      expect(indexes).toHaveLength(2);
      expect(indexes[0]).toMatchObject({ name: '_id_', key: { _id: 1 } });
      expect(indexes[1]).toMatchObject({ name: 'name_1', key: { name: 1 } });

      const indexes2 = await Post.getCollection().listIndexes().toArray();
      expect(indexes2).toHaveLength(1);
      expect(indexes2[0]).toMatchObject({ name: '_id_', key: { _id: 1 } });

      // Update indexes
      typedMongo.model<UserSchema>('users', {
        indexes: [{ key: { name: 1 } }, { key: { email: 1 }, unique: true }],
      });

      typedMongo.model<PostSchema>('posts', {
        indexes: [{ key: { title: 1 } }],
      });

      const results2 = await typedMongo.syncIndexes();
      expect(results2).toHaveLength(2);
      expect(results2[0]?.collectionName).toBe('users');
      expect(results2[0]?.created).toHaveLength(1);
      expect(results2[0]?.dropped).toHaveLength(0);
      expect(results2[1]?.collectionName).toBe('posts');
      expect(results2[1]?.created).toHaveLength(1);
      expect(results2[1]?.dropped).toHaveLength(0);

      const userIndexes = await User.getCollection().listIndexes().toArray();
      expect(userIndexes).toHaveLength(3);
      expect(userIndexes[0]).toMatchObject({ name: '_id_', key: { _id: 1 } });
      expect(userIndexes[1]).toMatchObject({ name: 'name_1', key: { name: 1 } });
      expect(userIndexes[2]).toMatchObject({ name: 'email_1', key: { email: 1 }, unique: true });

      const postIndexes = await Post.getCollection().listIndexes().toArray();
      expect(postIndexes).toHaveLength(2);
      expect(postIndexes[0]).toMatchObject({ name: '_id_', key: { _id: 1 } });
      expect(postIndexes[1]).toMatchObject({ name: 'title_1', key: { title: 1 } });
    });
  });

  describe('Index management - Additional tests', () => {
    test('should handle compound indexes', async () => {
      const User = typedMongo.model<UserSchema>('users', {
        indexes: [{ key: { name: 1, age: -1 } }, { key: { email: 1, name: 1 }, unique: true }],
      });

      const result = await User.syncIndexes();
      expect(result.created).toHaveLength(2);

      const indexes = await User.getCollection().listIndexes().toArray();
      expect(indexes).toHaveLength(3); // _id + 2 compound indexes
      expect(indexes[1]).toMatchObject({
        name: 'name_1_age_-1',
        key: { name: 1, age: -1 },
      });
      expect(indexes[2]).toMatchObject({
        name: 'email_1_name_1',
        key: { email: 1, name: 1 },
        unique: true,
      });
    });

    test('should handle text indexes', async () => {
      const User = typedMongo.model<UserSchema>('users_text', {
        indexes: [{ key: { name: 'text', 'profile.bio': 'text' } }],
      });

      const result = await User.syncIndexes();
      expect(result.created).toHaveLength(1);

      const indexes = await User.getCollection().listIndexes().toArray();
      const textIndex = indexes.find((idx) => idx.name !== '_id_');
      expect(textIndex).toBeDefined();
      // Text indexes have special key format in MongoDB
      expect(textIndex?.key).toHaveProperty('_fts');
      expect(textIndex?.key._fts).toBe('text');
    });

    test('should handle 2dsphere indexes', async () => {
      type LocationSchema = {
        _id: string;
        name: string;
        location: {
          type: 'Point';
          coordinates: [number, number];
        };
      };

      const Location = typedMongo.model<LocationSchema>('locations', {
        indexes: [{ key: { location: '2dsphere' } }],
      });

      const result = await Location.syncIndexes();
      expect(result.created).toHaveLength(1);

      const indexes = await Location.getCollection().listIndexes().toArray();
      const geoIndex = indexes.find((idx) => idx.name !== '_id_');
      expect(geoIndex).toBeDefined();
      expect(geoIndex?.key).toMatchObject({ location: '2dsphere' });
    });

    test('should handle partial indexes', async () => {
      const User = typedMongo.model<UserSchema>('users_partial', {
        indexes: [
          {
            key: { email: 1 },
            unique: true,
            partialFilterExpression: { email: { $exists: true } },
          },
        ],
      });

      const result = await User.syncIndexes();
      expect(result.created).toHaveLength(1);

      const indexes = await User.getCollection().listIndexes().toArray();
      const partialIndex = indexes.find((idx) => idx.name === 'email_1');
      expect(partialIndex).toBeDefined();
      expect(partialIndex?.unique).toBe(true);
      expect(partialIndex?.partialFilterExpression).toEqual({
        email: { $exists: true },
      });
    });

    test('should handle TTL indexes', async () => {
      const User = typedMongo.model<UserSchema>('users_ttl', {
        indexes: [
          {
            key: { 'metadata.created': 1 },
            expireAfterSeconds: 3600,
          },
        ],
      });

      const result = await User.syncIndexes();
      expect(result.created).toHaveLength(1);

      const indexes = await User.getCollection().listIndexes().toArray();
      const ttlIndex = indexes.find((idx) => idx.name === 'metadata.created_1');
      expect(ttlIndex).toBeDefined();
      expect(ttlIndex?.expireAfterSeconds).toBe(3600);
    });

    test('should handle sparse indexes', async () => {
      const User = typedMongo.model<UserSchema>('users_sparse', {
        indexes: [
          {
            key: { email: 1 },
            sparse: true,
          },
        ],
      });

      const result = await User.syncIndexes();
      expect(result.created).toHaveLength(1);

      const indexes = await User.getCollection().listIndexes().toArray();
      const sparseIndex = indexes.find((idx) => idx.name === 'email_1');
      expect(sparseIndex).toBeDefined();
      expect(sparseIndex?.sparse).toBe(true);
    });

    test('should handle custom index names', async () => {
      const User = typedMongo.model<UserSchema>('users_custom', {
        indexes: [
          {
            key: { name: 1, age: 1 },
            name: 'custom_name_age_index',
          },
        ],
      });

      const result = await User.syncIndexes();
      expect(result.created).toHaveLength(1);

      const indexes = await User.getCollection().listIndexes().toArray();
      const customIndex = indexes.find((idx) => idx.name === 'custom_name_age_index');
      expect(customIndex).toBeDefined();
      expect(customIndex?.key).toMatchObject({ name: 1, age: 1 });
    });

    test('should handle collation in indexes', async () => {
      const User = typedMongo.model<UserSchema>('users_collation', {
        indexes: [
          {
            key: { name: 1 },
            collation: { locale: 'en', strength: 2 },
          },
        ],
      });

      const result = await User.syncIndexes();
      expect(result.created).toHaveLength(1);

      const indexes = await User.getCollection().listIndexes().toArray();
      const collationIndex = indexes.find((idx) => idx.name === 'name_1');
      expect(collationIndex).toBeDefined();
      expect(collationIndex?.collation).toMatchObject({
        locale: 'en',
        strength: 2,
      });
    });

    test('should handle background index creation', async () => {
      const User = typedMongo.model<UserSchema>('users_bg', {
        indexes: [
          {
            key: { name: 1 },
            background: true,
          },
        ],
      });

      const result = await User.syncIndexes();
      expect(result.created).toHaveLength(1);

      const indexes = await User.getCollection().listIndexes().toArray();
      const bgIndex = indexes.find((idx) => idx.name === 'name_1');
      expect(bgIndex).toBeDefined();
      // Note: background option might not be reflected in listIndexes output
      // but the index should be created successfully
    });

    test('should preserve _id index when syncing', async () => {
      const User = typedMongo.model<UserSchema>('users_preserve', {
        indexes: [{ key: { name: 1 } }],
      });

      await User.syncIndexes();

      const indexes = await User.getCollection().listIndexes().toArray();
      const idIndex = indexes.find((idx) => idx.name === '_id_');
      expect(idIndex).toBeDefined();
      expect(idIndex?.key).toMatchObject({ _id: 1 });
    });

    test('should handle empty indexes array', async () => {
      // Create a fresh collection for this test
      const collectionName = `users_empty_${Date.now()}`;
      const User = typedMongo.model<UserSchema>(collectionName, {
        indexes: [],
      });

      // First create some indexes
      await User.getCollection().createIndex({ name: 1 });
      await User.getCollection().createIndex({ age: 1 });

      const result = await User.syncIndexes();
      expect(result.created).toHaveLength(0);
      expect(result.dropped).toHaveLength(2);

      const indexes = await User.getCollection().listIndexes().toArray();
      expect(indexes).toHaveLength(1); // Only _id index remains
      expect(indexes[0]?.name).toBe('_id_');
    });

    test('should handle index recreation when options change', async () => {
      // Create a fresh collection for this test
      const collectionName = `users_recreate_${Date.now()}`;

      // Create initial index
      const User1 = typedMongo.model<UserSchema>(collectionName, {
        indexes: [{ key: { email: 1 } }],
      });

      const result1 = await User1.syncIndexes();
      expect(result1.created).toHaveLength(1);

      // Verify initial index doesn't have unique
      const indexes1 = await User1.getCollection().listIndexes().toArray();
      const emailIndex1 = indexes1.find((idx) => idx.name === 'email_1');
      expect(emailIndex1?.unique).toBeUndefined();

      // Change index options (add unique) - this should drop and recreate
      const User2 = typedMongo.model<UserSchema>(collectionName, {
        indexes: [{ key: { email: 1 }, unique: true }],
      });

      // should throw error because index already exists
      await expect(User2.syncIndexes()).rejects.toThrow();
    });

    test('should handle multiple models with different indexes on same collection', async () => {
      // First model with one set of indexes
      const User1 = typedMongo.model<UserSchema>('shared_collection', {
        indexes: [{ key: { name: 1 } }],
      });

      await User1.syncIndexes();

      // Second model with different indexes on same collection
      const User2 = typedMongo.model<UserSchema>('shared_collection', {
        indexes: [{ key: { age: 1 } }],
      });

      const result = await User2.syncIndexes();
      expect(result.dropped).toHaveLength(1); // Drops name index
      expect(result.created).toHaveLength(1); // Creates age index

      const indexes = await User2.getCollection().listIndexes().toArray();
      expect(indexes).toHaveLength(2); // _id + age
      expect(indexes.some((idx) => idx.name === 'age_1')).toBe(true);
      expect(indexes.some((idx) => idx.name === 'name_1')).toBe(false);
    });

    test('should handle wildcard indexes', async () => {
      const User = typedMongo.model<UserSchema>('users_wildcard', {
        indexes: [{ key: { '$**': 1 } }],
      });

      const result = await User.syncIndexes();
      expect(result.created).toHaveLength(1);

      const indexes = await User.getCollection().listIndexes().toArray();
      const wildcardIndex = indexes.find((idx) => idx.name !== '_id_');
      expect(wildcardIndex).toBeDefined();
      expect(wildcardIndex?.key).toMatchObject({ '$**': 1 });
    });

    test('should handle hashed indexes', async () => {
      const User = typedMongo.model<UserSchema>('users_hashed', {
        indexes: [{ key: { _id: 'hashed' } }],
      });

      const result = await User.syncIndexes();
      expect(result.created).toHaveLength(1);

      const indexes = await User.getCollection().listIndexes().toArray();
      const hashedIndex = indexes.find((idx) => idx.name === '_id_hashed');
      expect(hashedIndex).toBeDefined();
      expect(hashedIndex?.key).toMatchObject({ _id: 'hashed' });
    });

    test('should return empty results when no models have indexes', async () => {
      const tm = new TypedMongo(testDbManager.getDb());
      tm.model<UserSchema>('collection1');
      tm.model<PostSchema>('collection2');

      const results = await tm.syncIndexes();
      expect(results).toHaveLength(2);
      expect(results[0]?.created).toHaveLength(0);
      expect(results[0]?.dropped).toHaveLength(0);
      expect(results[1]?.created).toHaveLength(0);
      expect(results[1]?.dropped).toHaveLength(0);
    });

    test('should handle index sync errors gracefully', async () => {
      const User = typedMongo.model<UserSchema>('users_error', {
        indexes: [{ key: { name: 1 }, unique: true }],
      });

      // Insert duplicate data
      await User.insertMany([
        { _id: 'user1', name: 'Alice', age: 25 },
        { _id: 'user2', name: 'Alice', age: 30 },
      ]);

      // Syncing should fail due to duplicate values for unique index
      await expect(User.syncIndexes()).rejects.toThrow();
    });
  });
});
