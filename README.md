# typed-mongo

[![CI](https://github.com/codatum/typed-mongo/actions/workflows/ci.yaml/badge.svg)](https://github.com/codatum/typed-mongo/actions/workflows/ci.yaml)
[![npm version](https://badge.fury.io/js/typed-mongo.svg)](https://badge.fury.io/js/typed-mongo)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**typed-mongo** is an extremely thin wrapper for the MongoDB Node.js driver that provides powerful type inference and declarative index creation while maintaining the performance of the original MongoDB client. Inspired by the [papr](https://github.com/plexinc/papr) library, typed-mongo takes a similar approach but focuses on simplicity and performance.

## Features

- 🎯 Smart type inference
- 🔄 No custom schema definitions required
- 📝 Declarative index creation
- ⚡ Superior performance

## Installation

```bash
npm install typed-mongo
# or
pnpm add typed-mongo
# or
yarn add typed-mongo
```

## Usage

### Basic Usage

```typescript
import { MongoClient } from 'mongodb';
import { Client } from 'typed-mongo';

// Define your schema
type UserSchema = {
  _id: string;
  name: string;
  age: number;
  email?: string;
  profile?: {
    bio: string;
    avatar?: string;
  };
};

// Connect to MongoDB
const mongoClient = new MongoClient('mongodb://localhost:27017');
await mongoClient.connect();
const db = mongoClient.db('myapp');

// Initialize typed-mongo client
const client = Client.initialize(db);

// Create a type-safe model
const User = client.model<UserSchema>('users');

// Insert documents
await User.insertOne({
  _id: 'user1',
  name: 'Alice',
  age: 25,
  email: 'alice@example.com'
});

// Type-safe queries
const user = await User.findOne({ name: 'Alice' });
// user is typed as UserSchema | null

// Query nested properties
const userWithBio = await User.findOne({ 
  'profile.bio': 'Developer' 
});
```

### Type Inference from Zod

```typescript
import { z } from 'zod';
import { Client } from 'typed-mongo';

// Define Zod schema
const UserSchema = z.object({
  _id: z.string(),
  name: z.string(),
  age: z.number(),
  email: z.string().email().optional(),
  tags: z.array(z.string()).optional(),
  profile: z.object({
    bio: z.string(),
    avatar: z.string().optional()
  }).optional()
});

// Infer type from Zod
type User = z.infer<typeof UserSchema>;

// Create model
const User = client.model<User>('users');

// Fully type-safe operations
await User.insertOne({
  _id: 'user1',
  name: 'Bob',
  age: 30,
  email: 'bob@example.com', // Type follows Zod validation
  tags: ['developer', 'typescript']
});
```

### Integration with Valibot and Other Libraries

```typescript
import * as v from 'valibot';

// Valibot schema
const UserSchema = v.object({
  _id: v.string(),
  name: v.string(),
  age: v.number(),
  email: v.optional(v.string()),
});

// Infer type
type User = v.InferOutput<typeof UserSchema>;

// Create model
const User = client.model<User>('users');
```

### Type Error Examples

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

### Projection Type Inference

```typescript
// Return type automatically adjusts based on projection
const userWithNameOnly = await User.findOne(
  { _id: 'user1' },
  { projection: { name: 1, _id: 0 } }
);
// userWithNameOnly is typed as { name: string } | null

const userWithProfile = await User.findOne(
  { _id: 'user1' },
  { projection: { name: 1, profile: 1 } }
);
// userWithProfile is typed as { _id: string; name: string; profile?: { bio: string; avatar?: string } } | null
```

### Advanced Update Operations

```typescript
// Type-safe update operations
await User.updateOne(
  { _id: 'user1' },
  {
    $set: { 
      age: 26,
      'profile.bio': 'Senior Developer' // Update nested fields
    },
    $push: { 
      tags: 'mongodb' 
    },
    $inc: { 
      age: 1 
    }
  }
);

// Array operations
await User.updateMany(
  { tags: 'developer' },
  {
    $pull: { tags: 'junior' },
    $addToSet: { tags: 'senior' }
  }
);
```

## API Reference

### Client

```typescript
const client = Client.initialize(db: Db, mongoClient?: MongoClient);
```

### Model

Models provide the following methods:

- `findOne(filter, options?)` - Find a single document
- `find(filter, options?)` - Returns a cursor (MongoDB standard)
- `findMany(filter, options?)` - Find multiple documents as an array
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