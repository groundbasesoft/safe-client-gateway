import { faker } from '@faker-js/faker';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';

describe('FakeCacheService', () => {
  let target: FakeCacheService;

  beforeEach(async () => {
    target = new FakeCacheService();
  });

  it('sets key', async () => {
    const cacheDir = new CacheDir(
      faker.string.alphanumeric(),
      faker.string.alphanumeric(),
    );
    const value = faker.string.alphanumeric();
    const expireTimeSeconds = faker.number.int({ min: 1 });

    await target.setWithExpiration(cacheDir, value, expireTimeSeconds);

    await expect(target.get(cacheDir)).resolves.toBe(value);
    expect(target.keyCount()).toBe(1);
  });

  it('deletes key and sets invalidationTimeMs', async () => {
    jest.useFakeTimers();
    const now = jest.now();
    const key = faker.string.alphanumeric();
    const field = faker.string.alphanumeric();
    const cacheDir = new CacheDir(key, field);
    const value = faker.string.alphanumeric();
    const expireTimeSeconds = faker.number.int({ min: 1 });

    await target.setWithExpiration(cacheDir, value, expireTimeSeconds);
    await target.deleteByKey(key);

    await expect(target.get(cacheDir)).resolves.toBe(undefined);
    await expect(
      target.get(new CacheDir(`invalidationTimeMs:${cacheDir.key}`, '')),
    ).resolves.toBe(now.toString());
    expect(target.keyCount()).toBe(1);
    jest.useRealTimers();
  });

  it('clears keys', async () => {
    const expireTimeSeconds = faker.number.int({ min: 1 });
    const actions: Promise<void>[] = [];
    for (let i = 0; i < 5; i++) {
      actions.push(
        target.setWithExpiration(
          new CacheDir(`key${i}`, `field${i}`),
          `value${i}`,
          expireTimeSeconds,
        ),
      );
    }

    await Promise.all(actions);
    target.clear();

    expect(target.keyCount()).toBe(0);
  });
});
