import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
// source /Users/bj89182ml/.gvm/scripts/gvm

@Injectable()
export class EigenlayerService {
  private readonly logger = new Logger(EigenlayerService.name);
  constructor(
    private readonly httpService: HttpService,
    private configService: ConfigService
  ) {}

  async getTxn(storeNumber: number) {
    const { data } = await firstValueFrom(
      this.httpService.get(`${this.configService.get('EIGEN_DA_URL')}/da/getTxsListByDsId/${Number(storeNumber)}`)
    );
    return data;
  }
  async getDataStore(fromStoreNumber: number) {
    const { data } = await firstValueFrom(
      this.httpService.get(`${this.configService.get('EIGEN_DA_URL')}/da/getDataStoreById/${fromStoreNumber.toString()}`)
    );
    return data;
  }

  async getLatestTransactionBatchIndex() {
    const { data } = await firstValueFrom(
      this.httpService.get(`${this.configService.get('EIGEN_DA_URL')}/da/getLatestTransactionBatchIndex`)
    );
    return data;
  }
  async getRollupStoreByRollupBatchIndex(batchIndex: number) {
    const { data } = await firstValueFrom(
      this.httpService.get(`${this.configService.get('EIGEN_DA_URL')}/da/getDataStoreListByBatchIndex/${batchIndex}`)
    );
    return data;
  }
}