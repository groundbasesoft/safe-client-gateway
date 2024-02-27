import { faker } from '@faker-js/faker';
import { ILoggingService } from '@/logging/logging.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { RedisCacheService } from '@/datasources/cache/redis.cache.service';
import { RedisClientType } from 'redis';
import { fakeJson } from '@/__tests__/faker';
import { IConfigurationService } from '@/config/configuration.service.interface';
import clearAllMocks = jest.clearAllMocks;
import { redisClientFactory } from '@/__tests__/redis-client.factory';

const mockLoggingService: jest.MockedObjectDeep<ILoggingService> = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

const configurationService = {
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>;
const mockConfigurationService = jest.mocked(configurationService);

describe('RedisCacheService', () => {
  let redisCacheService: RedisCacheService;
  let defaultExpirationTimeInSeconds: number;
  const keyPrefix = '';
  let redisClient: RedisClientType;

  beforeAll(async () => {
    redisClient = await redisClientFactory();
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  beforeEach(async () => {
    clearAllMocks();
    defaultExpirationTimeInSeconds = faker.number.int();
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'expirationTimeInSeconds.default') {
        return defaultExpirationTimeInSeconds;
      }
      throw Error(`Unexpected key: ${key}`);
    });

    await redisClient.flushAll();
    redisCacheService = new RedisCacheService(
      redisClient,
      mockLoggingService,
      mockConfigurationService,
      keyPrefix,
    );
  });

  describe('CacheService.setWithExpiration', () => {
    it('Setting key without setting expireTimeSeconds does not store the value', async () => {
      const cacheDir = new CacheDir(
        faker.string.alphanumeric(),
        faker.string.sample(),
      );
      const value = fakeJson();

      await redisCacheService.setWithExpiration(cacheDir, value, undefined);

      const storedValue = await redisClient.hGet(cacheDir.key, cacheDir.field);
      expect(storedValue).toBeNull();
    });

    it('Setting key with expireTimeSeconds does store the value with the provided TTL', async () => {
      const cacheDir = new CacheDir(
        faker.string.alphanumeric(),
        faker.string.sample(),
      );
      const value = fakeJson();
      const expireTime = faker.number.int();

      await redisCacheService.setWithExpiration(cacheDir, value, expireTime);

      const storedValue = await redisClient.hGet(cacheDir.key, cacheDir.field);
      const ttl = await redisClient.ttl(cacheDir.key);
      expect(storedValue).toEqual(value);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(expireTime);
    });

    it('Setting key throws on expire', async () => {
      const cacheDir = new CacheDir(
        faker.string.alphanumeric(),
        faker.string.sample(),
      );

      // Expiration time out of range to force an error
      await expect(
        redisCacheService.setWithExpiration(cacheDir, '', Number.MAX_VALUE + 1),
      ).rejects.toThrow();

      const storedValue = await redisClient.hGet(cacheDir.key, cacheDir.field);
      expect(storedValue).toBeNull();
    });
  });

  describe('CacheService.set', () => {
    it('Setting key stores the value with no TTL', async () => {
      const cacheDir = new CacheDir(
        faker.string.alphanumeric(),
        faker.string.sample(),
      );

      const value = fakeJson();
      await expect(redisCacheService.set(cacheDir, value));

      const storedValue = await redisClient.hGet(cacheDir.key, cacheDir.field);
      const ttl = await redisClient.ttl(cacheDir.key);
      expect(storedValue).toEqual(value);
      expect(ttl).toEqual(-1);
    });

    it('Setting key stores the value but does not modify the previous TTL, if any', async () => {
      const cacheDir = new CacheDir(
        faker.string.alphanumeric(),
        faker.string.sample(),
      );

      const value = fakeJson();
      const expireTime = faker.number.int();
      await expect(
        redisCacheService.setWithExpiration(cacheDir, value, expireTime),
      );
      await expect(redisCacheService.set(cacheDir, value));

      const storedValue = await redisClient.hGet(cacheDir.key, cacheDir.field);
      const ttl = await redisClient.ttl(cacheDir.key);
      expect(storedValue).toEqual(value);
      expect(ttl).toEqual(expireTime);
    });
  });

  it('Getting key gets the stored value', async () => {
    const cacheDir = new CacheDir(
      faker.string.alphanumeric(),
      faker.string.sample(),
    );
    const value = fakeJson();
    await redisClient.hSet(cacheDir.key, cacheDir.field, value);

    const storedValue = await redisCacheService.get(cacheDir);

    expect(storedValue).toEqual(value);
  });

  it('Deleting key deletes the stored value and sets invalidationTime', async () => {
    const startTime = Date.now();
    const cacheDir = new CacheDir(
      faker.string.alphanumeric(),
      faker.string.sample(),
    );
    const value = fakeJson();
    await redisClient.hSet(cacheDir.key, cacheDir.field, value);

    await redisCacheService.deleteByKey(cacheDir.key);

    const storedValue = await redisClient.hGet(cacheDir.key, cacheDir.field);
    const invalidationTime = Number(
      await redisClient.hGet(`invalidationTimeMs:${cacheDir.key}`, ''),
    );
    const invalidationTimeTtl = await redisClient.ttl(
      `invalidationTimeMs:${cacheDir.key}`,
    );
    expect(storedValue).toBeNull();
    expect(invalidationTime).toBeGreaterThanOrEqual(startTime);
    expect(invalidationTimeTtl).toBeGreaterThan(0);
    expect(invalidationTimeTtl).toBeLessThanOrEqual(
      defaultExpirationTimeInSeconds,
    );
  });

  it('When Module gets destroyed, redis connection is closed', async () => {
    await redisCacheService.onModuleDestroy();

    // Connection is closed, this is expected to throw an error
    await expect(redisCacheService.ping()).rejects.toThrow();
    // Connection is reopened after this test execution
    redisClient = await redisClientFactory();
  });
});
