import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';

export const CacheService = Symbol('ICacheService');

export interface ICacheService {
  setWithExpiration(
    cacheDir: CacheDir,
    value: string,
    expireTimeSeconds?: number,
  ): Promise<void>;

  set(cacheDir: CacheDir, value: string): Promise<void>;

  get(cacheDir: CacheDir): Promise<string | undefined>;

  deleteByKey(key: string): Promise<number>;
}
