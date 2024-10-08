import { Inject, Injectable } from '@nestjs/common';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import {
  ChainPageSchema,
  ChainSchema,
} from '@/domain/chains/entities/schemas/chain.schema';
import { Chain } from '@/domain/chains/entities/chain.entity';
import { Singleton } from '@/domain/chains/entities/singleton.entity';
import { SingletonSchema } from '@/domain/chains/entities/schemas/singleton.schema';
import { Page } from '@/domain/entities/page.entity';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import {
  IndexingStatus,
  IndexingStatusSchema,
} from '@/domain/indexing/entities/indexing-status.entity';

@Injectable()
export class ChainsRepository implements IChainsRepository {
  constructor(
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
  ) {}

  async getChain(chainId: string): Promise<Chain> {
    const chain = await this.configApi.getChain(chainId);
    return ChainSchema.parse(chain);
  }

  async clearChain(chainId: string): Promise<void> {
    return this.configApi.clearChain(chainId);
  }

  async getChains(limit?: number, offset?: number): Promise<Page<Chain>> {
    const page = await this.configApi.getChains({ limit, offset });
    return ChainPageSchema.parse(page);
  }

  async getSingletons(chainId: string): Promise<Singleton[]> {
    const transactionApi = await this.transactionApiManager.getApi(chainId);
    const singletons = await transactionApi.getSingletons();
    return singletons.map((singleton) => SingletonSchema.parse(singleton));
  }

  async getIndexingStatus(chainId: string): Promise<IndexingStatus> {
    const transactionApi = await this.transactionApiManager.getApi(chainId);
    const indexingStatus = await transactionApi.getIndexingStatus();
    return IndexingStatusSchema.parse(indexingStatus);
  }
}
