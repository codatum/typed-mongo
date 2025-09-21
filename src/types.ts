import type {
  AlternativeType,
  ArrayElement,
  BSONRegExp,
  BSONType,
  BSONTypeAlias,
  Binary,
  BitwiseFilter,
  DeleteManyModel,
  DeleteOneModel,
  Document,
  IntegerType,
  Join,
  KeysOfAType,
  NumericType,
  OnlyFieldsOfType,
  PullAllOperator,
  PullOperator,
  PushOperator,
  ReplaceOneModel,
  SetFields,
  Timestamp,
  UpdateManyModel,
  UpdateOneModel,
} from 'mongodb';

import type { ObjectId } from 'mongodb';
// ============================================================================
// Document Types
// ============================================================================

/**
 * Strict version that requires all non-_id fields to be present
 * _id is optional only for ObjectId type, required for string type
 */
export type StrictOptionalId<TSchema> = TSchema extends { _id: ObjectId }
  ? Omit<TSchema, '_id'> & { _id?: ObjectId }
  : TSchema extends { _id: string }
    ? TSchema // string _id is required
    : TSchema & { _id?: string };

// ============================================================================
// Filter Types
// ============================================================================

// Forward declarations for types that will be defined in utils.ts
export type NestedPaths<Type, Depth extends number[]> = Depth['length'] extends 6
  ? []
  : Type extends
        | Buffer
        | Date
        | RegExp
        | Uint8Array
        | boolean
        | number
        | string
        // biome-ignore lint/suspicious/noExplicitAny: MongoDB type system requires any for function types
        | ((...args: any[]) => any)
        | {
            _bsontype: string;
          }
    ? []
    : Type extends readonly (infer ArrayType)[]
      ? // This returns the non-indexed dot-notation path: e.g. `foo.bar`
          | [...NestedPaths<ArrayType, [...Depth, 1]>]
          // This returns the array parent itself: e.g. `foo`
          | []
          // This returns the indexed dot-notation path: e.g. `foo.0.bar`
          | [number, ...NestedPaths<ArrayType, [...Depth, 1]>]
          // This returns the indexed element path: e.g. `foo.0`
          | [number]
      : // biome-ignore lint/suspicious/noExplicitAny: MongoDB type system requires any for Map types
        Type extends Map<string, any>
        ? [string]
        : Type extends object
          ? {
              // biome-ignore lint/suspicious/noExplicitAny: MongoDB type system requires any for array types
              [Key in Extract<keyof Type, string>]: Type[Key] extends readonly any[]
                ? [Key, ...NestedPaths<Type[Key], [...Depth, 1]>] // child is not structured the same as the parent
                : [Key, ...NestedPaths<Type[Key], [...Depth, 1]>] | [Key];
            }[Extract<keyof Type, string>]
          : [];

export type PropertyNestedType<
  Type,
  Property extends string,
> = Property extends `${infer Key}.${infer Rest}`
  ? Key extends `${number}`
    ? // indexed array nested properties
      NonNullable<Type> extends readonly (infer ArrayType)[]
      ? PropertyType<ArrayType, Rest>
      : unknown
    : // object nested properties & non-indexed array nested properties
      Key extends keyof Type
      ? Type[Key] extends Map<string, infer MapType>
        ? MapType
        : PropertyType<NonNullable<Type[Key]>, Rest>
      : unknown
  : unknown;

export type PropertyType<Type, Property extends string> = string extends Property
  ? unknown
  : // object properties
    Property extends keyof Type
    ? // biome-ignore lint/suspicious/noExplicitAny: MongoDB type system requires any for Record types
      Type extends Record<string, any>
      ? Property extends `${string}.${string}`
        ? PropertyNestedType<NonNullable<Type>, Property>
        : Type[Property]
      : Type[Property]
    : Type extends readonly (infer ArrayType)[]
      ? // indexed array properties
        Property extends `${number}`
        ? ArrayType
        : // non-indexed array properties
          Property extends keyof ArrayType
          ? PropertyType<ArrayType, Property>
          : PropertyNestedType<NonNullable<Type>, Property>
      : PropertyNestedType<NonNullable<Type>, Property>;

export type MongoFilter<TSchema> =
  | Partial<TSchema>
  | (MongoFilterConditions<TSchema> & MongoRootFilterOperators<TSchema>);

export type MongoFilterConditions<TSchema> = {
  [Property in Join<NestedPaths<TSchema, []>, '.'>]?: MongoCondition<
    PropertyType<TSchema, Property>
  >;
} & {
  [K in keyof TSchema]?: MongoCondition<TSchema[K]>;
};

export interface MongoRootFilterOperators<TSchema> {
  $and?: MongoFilter<TSchema>[];
  $nor?: MongoFilter<TSchema>[];
  $or?: MongoFilter<TSchema>[];
  // biome-ignore lint/suspicious/noExplicitAny: MongoDB $expr operator accepts any expression
  $expr?: Record<string, any>;
  $text?: {
    $search: string;
    $language?: string;
    $caseSensitive?: boolean;
    $diacriticSensitive?: boolean;
  };
  $where?: string | ((this: TSchema) => boolean);
  $comment?: Document | string;
}

export type MongoCondition<Type> =
  | AlternativeType<Type>
  | MongoFilterOperators<AlternativeType<Type>>;

export interface MongoFilterOperators<TValue> {
  $eq?: TValue;
  $gt?: TValue;
  $gte?: TValue;
  $in?: readonly TValue[];
  $lt?: TValue;
  $lte?: TValue;
  $ne?: TValue;
  $nin?: readonly TValue[];
  $not?: TValue extends string
    ? MongoFilterOperators<TValue> | RegExp
    : MongoFilterOperators<TValue>;
  $exists?: boolean;
  $type?: BSONType | BSONTypeAlias;
  // biome-ignore lint/suspicious/noExplicitAny: MongoDB $expr operator accepts any expression
  $expr?: Record<string, any>;
  // biome-ignore lint/suspicious/noExplicitAny: MongoDB $jsonSchema accepts any JSON schema
  $jsonSchema?: Record<string, any>;
  $mod?: TValue extends number ? [number, number] : never;
  $regex?: TValue extends string ? BSONRegExp | RegExp | string : never;
  $options?: TValue extends string ? string : never;
  $geoIntersects?: {
    $geometry: Document;
  };
  $geoWithin?: Document;
  $near?: Document;
  $nearSphere?: Document;
  $maxDistance?: number;
  // biome-ignore lint/suspicious/noExplicitAny: MongoDB $all operator works with any array type
  $all?: TValue extends readonly any[] ? readonly any[] : never;
  // biome-ignore lint/suspicious/noExplicitAny: MongoDB $elemMatch operator works with any array type
  $elemMatch?: TValue extends readonly any[] ? Document : never;
  // biome-ignore lint/suspicious/noExplicitAny: MongoDB $size operator works with any array type
  $size?: TValue extends readonly any[] ? number : never;
  $bitsAllClear?: BitwiseFilter;
  $bitsAllSet?: BitwiseFilter;
  $bitsAnyClear?: BitwiseFilter;
  $bitsAnySet?: BitwiseFilter;
  $rand?: Record<string, never>;
}

// ============================================================================
// Update Types
// ============================================================================
/**
 * Returns all dot-notation properties of a schema with their corresponding types.
 */
export type MongoAllProperties<TSchema> = {
  [Property in Join<NestedPaths<TSchema, []>, '.'>]?: PropertyType<TSchema, Property>;
} & {
  [K in keyof TSchema]?: TSchema[K];
};

/**
 * Returns all array-specific element dot-notation properties
 */
export type MongoArrayElementsProperties<TSchema> = {
  [Property in `${Extract<
    // biome-ignore lint/suspicious/noExplicitAny: MongoDB array operations require any[] type
    KeysOfAType<MongoAllProperties<TSchema>, any[]>,
    string
  >}.$${'' | `[${string}]`}`]?: ArrayElement<
    PropertyType<TSchema, Property extends `${infer Key}.$${string}` ? Key : never>
  >;
};

/**
 * Returns all array-specific nested dot-notation properties
 */
export type MongoArrayNestedProperties<TSchema> = {
  [Property in `${Extract<
    // biome-ignore lint/suspicious/noExplicitAny: MongoDB nested array operations require Record<string, any>[] type
    KeysOfAType<MongoAllProperties<TSchema>, Record<string, any>[]>,
    string
  >}.$${'' | `[${string}]`}.${string}`]?: PropertyType<
    TSchema,
    Property extends `${infer Base}.$${string}.${infer Rest}` ? `${Base}.0.${Rest}` : never
  >;
};

/**
 * Match keys and values for update operations
 */
export type MongoMatchKeysAndValues<TSchema> = MongoAllProperties<TSchema> &
  MongoArrayElementsProperties<TSchema> &
  MongoArrayNestedProperties<TSchema>;

/**
 * MongoDB update filter
 */
export interface MongoUpdateFilter<TSchema> {
  $currentDate?: OnlyFieldsOfType<
    TSchema,
    Date | Timestamp,
    | true
    | {
        $type: 'date' | 'timestamp';
      }
  >;
  $inc?: OnlyFieldsOfType<TSchema, NumericType | undefined>;
  $min?: MongoMatchKeysAndValues<TSchema>;
  $max?: MongoMatchKeysAndValues<TSchema>;
  $mul?: OnlyFieldsOfType<TSchema, NumericType | undefined>;
  $rename?: Record<string, string>;
  $set?: MongoMatchKeysAndValues<TSchema>;
  $setOnInsert?: MongoMatchKeysAndValues<TSchema>;
  // biome-ignore lint/suspicious/noExplicitAny: MongoDB $unset operator works with any field type
  $unset?: OnlyFieldsOfType<TSchema, any, '' | 1 | true>;
  $addToSet?: SetFields<TSchema>;
  // biome-ignore lint/suspicious/noExplicitAny: MongoDB $pop operator works with any array type
  $pop?: OnlyFieldsOfType<TSchema, readonly any[], -1 | 1>;
  $pull?: PullOperator<TSchema>;
  $push?: PushOperator<TSchema>;
  $pullAll?: PullAllOperator<TSchema>;
  $bit?: OnlyFieldsOfType<
    TSchema,
    NumericType | undefined,
    | {
        and: IntegerType;
      }
    | {
        or: IntegerType;
      }
    | {
        xor: IntegerType;
      }
  >;
}

// ============================================================================
// Bulk Write Types
// ============================================================================
export type MongoBulkWriteOperation<TSchema extends BaseSchema> =
  | {
      deleteMany: Omit<DeleteManyModel<TSchema>, 'filter'> & { filter: MongoFilter<TSchema> };
    }
  | {
      deleteOne: Omit<DeleteOneModel<TSchema>, 'filter'> & { filter: MongoFilter<TSchema> };
    }
  | {
      replaceOne: Omit<ReplaceOneModel<TSchema>, 'filter'> & { filter: MongoFilter<TSchema> };
    }
  | {
      updateMany: Omit<UpdateManyModel<TSchema>, 'filter' | 'update'> & {
        filter: MongoFilter<TSchema>;
        update: MongoUpdateFilter<TSchema>;
      };
    }
  | {
      updateOne: Omit<UpdateOneModel<TSchema>, 'filter' | 'update'> & {
        filter: MongoFilter<TSchema>;
        update: MongoUpdateFilter<TSchema>;
      };
    }
  | {
      insertOne: {
        document: StrictOptionalId<TSchema>;
      };
    };

// ============================================================================
// Legacy/Compatibility Types
// ============================================================================
export interface BaseSchema {
  _id: ObjectId | number | string;
}

export type Identity<Type> = Type;

export type Flatten<Type extends object> = Identity<{
  [Key in keyof Type]: Type[Key];
}>;

type FilterProperties<TObject, TValue> = Pick<TObject, KeysOfAType<TObject, TValue>>;

export type ProjectionType<
  TSchema extends BaseSchema,
  Projection extends Partial<Record<Join<NestedPaths<TSchema, []>, '.'>, number>> | undefined,
> = undefined extends Projection
  ? TSchema
  : keyof FilterProperties<Projection, 0 | 1> extends never
    ? DeepPick<TSchema, '_id' | (string & keyof Projection)>
    : keyof FilterProperties<Projection, 1> extends never
      ? Omit<TSchema, keyof FilterProperties<Projection, 0>>
      : Omit<
          DeepPick<TSchema, '_id' | (string & keyof Projection)>,
          keyof FilterProperties<Projection, 0>
        >;

export type Projection<TSchema> = Partial<Record<Join<NestedPaths<TSchema, []>, '.'>, number>>;

export type RequireAtLeastOne<TObj, Keys extends keyof TObj = keyof TObj> = {
  [Key in Keys]-?: Partial<Pick<TObj, Exclude<Keys, Key>>> & Required<Pick<TObj, Key>>;
}[Keys] &
  Pick<TObj, Exclude<keyof TObj, Keys>>;

// ============================================================================
// DeepPick Types
// ============================================================================
type UnionKeyOf<Type> = Type extends infer T ? keyof T : never;

type HeadPaths<Paths extends string> = Paths extends `${infer Head}.${string}` ? Head : Paths;

type InnerKeys<HeadKey extends string, Paths extends string> = [
  Extract<Paths, `${HeadKey}.${string}`>,
] extends [`${HeadKey}.${infer RestKey}`]
  ? RestKey
  : never;

export type RequiredProperties<Properties> = {
  [Prop in keyof Properties]: undefined extends Properties[Prop] ? never : Prop;
}[keyof Properties];

export type OptionalProperties<Properties> = Exclude<
  keyof Properties,
  RequiredProperties<Properties>
>;

export type ObjectType<Properties> = Flatten<
  Pick<Properties, NonNullable<RequiredProperties<Properties>>> & {
    [Prop in OptionalProperties<Properties>]?: Properties[Prop];
  }
>;

type InnerPick<Type, Paths extends string> = ObjectType<{
  [HeadKey in UnionKeyOf<Type>]: DeepPick<Type[HeadKey], InnerKeys<HeadKey, Paths>>;
}>;

type ArrayItemKeys<Paths extends string> = InnerKeys<`${number}`, Paths>;

type Primitive = boolean | number | string | symbol | null | undefined;

export type DeepPick<Type, Paths extends string> = Type extends Binary | Date | ObjectId | Primitive
  ? Type
  : Type extends (infer ArrayItem)[]
    ? DeepPick<ArrayItem, ArrayItemKeys<Paths>>[]
    : Pick<InnerPick<Type, Paths>, HeadPaths<Paths> & UnionKeyOf<Type>>;
