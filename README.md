# typed-mongo

[![CI](https://github.com/codatum/typed-mongo/actions/workflows/ci.yml/badge.svg)](https://github.com/codatum/typed-mongo/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/typed-mongo.svg)](https://badge.fury.io/js/typed-mongo)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**typed-mongo** is an extremely thin wrapper for the MongoDB Node.js driver that provides powerful type inference and declarative index creation while maintaining the performance of the original MongoDB client. Inspired by the [papr](https://github.com/plexinc/papr) library, typed-mongo takes a similar approach but focuses on simplicity and performance.

## Features

- 🔄 Extremely thin wrapper around the MongoDB Node.js driver
- 🎯 Smart type inference
- 🔄 No custom schema definitions required
- ⚡ Superior performance
- 📝 Declarative index creation

## Installation

```bash
npm install typed-mongo
# or
pnpm add typed-mongo
# or
yarn add typed-mongo
```

## Basic Usage

```typescript
import { MongoClient, ObjectId } from 'mongodb';
import { TypedMongo } from 'typed-mongo';

// Define your schema
type UserSchema = {
  _id: ObjectId;
  name: string;
  age: number;
  email?: string;
  profile?: {
    bio: string;
    avatar?: string;
  };
};

// Connect to MongoDB
const mongoClient = new MongoClient('mongodb://localhost:27017', { ignoreUndefined: true });
await mongoClient.connect();
const db = mongoClient.db('myapp');

// Initialize typed-mongo
const typedMongo = new TypedMongo(db);

// Create a type-safe model
const User = typedMongo.model<UserSchema>('users');

// Insert a document with type-safe
await User.insertOne({
  name: 'Alice',
  age: 25,
  email: 'alice@example.com'
});

// user is typed as UserSchema | null
const user = await User.findOne({ name: 'Alice' });

// usersWithProjection is typed as { _id: ObjectId; name: string; }[]
const usersWithProjection = await User.find(
  {},
  { projection: { name: 1 } }
);
```

## Type Error Examples

TypeScript will catch these errors at compile time:

```typescript
// ❌ Type error: non-existent field
await User.findOne({ 
  nonExistentField: 'value' 
});
// Error: 'nonExistentField' does not exist in type UserSchema

// ❌ Type error: wrong type
await User.findOne({ 
  age: 'thirty' // age should be number
});
// Error: Type 'string' is not assignable to type 'number'

// ❌ Type error: missing required field
await User.insertOne({
  _id: 'user1',
  // name field is missing
  age: 25
});
// Error: Property 'name' is missing
```

## API Reference

### TypedMongo

```typescript
const typedMongo = new TypedMongo(db: Db);
```

### Model

Models provide the following methods:

- `findOne(filter, options?)` - Find a single document
- `findCursor(filter, options?)` - Returns a cursor (MongoDB standard)
- `find(filter, options?)` - Find multiple documents as an array
- `insertOne(doc, options?)` - Insert a single document
- `insertMany(docs, options?)` - Insert multiple documents
- `updateOne(filter, update, options?)` - Update a single document
- `updateMany(filter, update, options?)` - Update multiple documents
- `replaceOne(filter, replacement, options?)` - Replace a document
- `deleteOne(filter, options?)` - Delete a single document
- `deleteMany(filter, options?)` - Delete multiple documents
- `findOneAndUpdate(filter, update, options?)` - Find and update
- `findOneAndReplace(filter, replacement, options?)` - Find and replace
- `findOneAndDelete(filter, options?)` - Find and delete
- `countDocuments(filter?, options?)` - Count documents
- `distinct(key, filter?, options?)` - Get distinct values
- `aggregate(pipeline, options?)` - Aggregation pipeline
- `bulkWrite(operations, options?)` - Bulk write operations

## Performance

typed-mongo is designed as a thin wrapper around the MongoDB native driver, providing superior performance compared to heavy ORMs like Mongoose:

- **Minimal overhead**: No unnecessary abstraction layers
- **Native MongoDB performance**: Near-native driver speed
- **Memory efficient**: No additional schema validation or middleware overhead

## Why Choose typed-mongo?

### vs Mongoose
- ✅ Better performance
- ✅ Superior type inference
- ✅ Smaller bundle size
- ✅ No duplicate schema definitions

### vs Native MongoDB Driver
- ✅ Full type safety
- ✅ Better developer experience
- ✅ Early type error detection
- ✅ IDE autocomplete support

## Trusted by

<p align="center">
  <a href="https://codatum.com">
    <img src="https://storage.googleapis.com/prod-cdm-public2/assets/invite_mail_logo.png" alt="Codatum" height="50">
  </a>
</p>

typed-mongo is trusted by [Codatum](https://codatum.com).

## License

MIT

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## Support

If you encounter any issues or have feature requests, please open an issue on [GitHub](https://github.com/codatum/typed-mongo/issues).