import { type Db, MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll } from 'vitest';

class TestDBManager {
  private static instance: TestDBManager;

  private mongod?: MongoMemoryServer;
  private client?: MongoClient;
  public db?: Db;
  private uri?: string;

  // privateコンストラクタで外部からのnewを防ぐ
  private constructor() {}

  // インスタンスを取得するためのstaticメソッド
  public static getInstance(): TestDBManager {
    if (!TestDBManager.instance) {
      TestDBManager.instance = new TestDBManager();
    }
    return TestDBManager.instance;
  }

  public async start(): Promise<{ client: MongoClient; db: Db; uri: string }> {
    // 既に起動済みの場合は既存のインスタンスを返す
    if (this.client && this.db && this.uri) {
      return { client: this.client, db: this.db, uri: this.uri };
    }

    this.mongod = await MongoMemoryServer.create();
    this.uri = this.mongod.getUri();
    this.client = new MongoClient(this.uri);
    await this.client.connect();
    this.db = this.client.db('test');

    return { client: this.client, db: this.db, uri: this.uri };
  }

  public async stop(): Promise<void> {
    await this.client?.close();
    await this.mongod?.stop();
    this.client = undefined;
    this.db = undefined;
    this.mongod = undefined;
    this.uri = undefined;
  }

  public getDb(): Db {
    if (!this.db) {
      throw new Error('Database not initialized. Call start() first.');
    }
    return this.db;
  }

  public getClient(): MongoClient {
    if (!this.client) {
      throw new Error('Client not initialized. Call start() first.');
    }
    return this.client;
  }
}

// シングルトンインスタンスをエクスポート
export const testDbManager = TestDBManager.getInstance();

// Global setup for all tests
beforeAll(async () => {
  await testDbManager.start();
});

afterAll(async () => {
  await testDbManager.stop();
});
