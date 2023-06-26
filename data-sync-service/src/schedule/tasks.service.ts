import { Injectable, Logger, Inject, CACHE_MANAGER } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { Interval, SchedulerRegistry } from '@nestjs/schedule';
import { L1IngestionService } from '../l1Ingestion/l1Ingestion.service';
import { L2IngestionService } from '../l2Ingestion/l2Ingestion.service';
import { ConfigService } from '@nestjs/config';
import { MonitorService } from 'src/monitor/monitor.service';

const L1_SENT = 'l1_sent_block_number';
const L1_RELAYED = 'l1_relayed_block_number';
const L2_SENT = 'l2_sent_block_number';
const L2_RELAYED = 'l2_relayed_block_number';
const TXN_BATCH = 'txn_batch_block_number';
const STATE_BATCH = 'state_batch_block_number';
const DA_BATCH_INDEX = 'DA_BATCH_INDEX';
const SYNC_STEP = 10;
const SYNC_STEP_L2 = 100;

@Injectable()
export class TasksService {
  constructor(
    private configService: ConfigService,
    private readonly l1IngestionService: L1IngestionService,
    private readonly l2IngestionService: L2IngestionService,
    private readonly monitorService: MonitorService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private schedulerRegistry: SchedulerRegistry
  ) {
    this.initCache();
    const fixedL2ToL1TokenAddress0x000Bug = setInterval(async () => {
      try {
        const result = await this.l2IngestionService.fixedL2ToL1TokenAddress0x000Bug();
        if (result.length <= 0) {
          console.log('deleteInterval fixedL2ToL1TokenAddress0x000Bug');
          this.schedulerRegistry.deleteInterval('fixedL2ToL1TokenAddress0x000Bug');
        }
      } catch (error) {
        this.logger.error(`error fixedL2ToL1TokenAddress0x000Bug: ${error}`);
      }
    }, 1000);
    this.schedulerRegistry.addInterval('fixedL2ToL1TokenAddress0x000Bug', fixedL2ToL1TokenAddress0x000Bug);
  }
  private readonly logger = new Logger(TasksService.name);
  async initCache() {
    let l1_sent_block_number = await this.cacheManager.get(L1_SENT);
    let l1_relayed_block_number = await this.cacheManager.get(L1_RELAYED);
    let l2_sent_block_number = await this.cacheManager.get(L2_SENT);
    let l2_relayed_block_number = await this.cacheManager.get(L2_RELAYED);
    let txn_batch_block_number = await this.cacheManager.get(TXN_BATCH);
    let state_batch_block_number = await this.cacheManager.get(STATE_BATCH);
    let da_batch_index = await this.cacheManager.get(DA_BATCH_INDEX);
    if (!l1_sent_block_number) {
      l1_sent_block_number =
        (await this.l1IngestionService.getSentEventsBlockNumber()) ||
        this.configService.get('L1_START_BLOCK_NUMBER');
    }
    if (!l1_relayed_block_number) {
      l1_relayed_block_number =
        (await this.l1IngestionService.getRelayedEventsBlockNumber()) ||
        this.configService.get('L1_START_BLOCK_NUMBER');
    }
    if (!l2_sent_block_number) {
      l2_sent_block_number =
        (await this.l2IngestionService.getSentEventsBlockNumber()) ||
        this.configService.get('L2_START_BLOCK_NUMBER');
    }
    if (!l2_relayed_block_number) {
      l2_relayed_block_number =
        (await this.l2IngestionService.getRelayedEventsBlockNumber()) ||
        this.configService.get('L2_START_BLOCK_NUMBER');
    }
    if (!txn_batch_block_number) {
      txn_batch_block_number =
        (await this.l1IngestionService.getTxnBatchBlockNumber()) ||
        this.configService.get('L1_START_BLOCK_NUMBER');
    }
    if (!state_batch_block_number) {
      state_batch_block_number =
        (await this.l1IngestionService.getStateBatchBlockNumber()) ||
        this.configService.get('L1_START_BLOCK_NUMBER');
    }
    if (!da_batch_index) {
      da_batch_index =
        (await this.l1IngestionService.getLastBatchIndex() + 1) ||
        1;
    }
    await this.cacheManager.set(L1_SENT, Number(l1_sent_block_number), {
      ttl: 0,
    });
    await this.cacheManager.set(L1_RELAYED, Number(l1_relayed_block_number), {
      ttl: 0,
    });
    await this.cacheManager.set(L2_SENT, Number(l2_sent_block_number), {
      ttl: 0,
    });
    await this.cacheManager.set(L2_RELAYED, Number(l2_relayed_block_number), {
      ttl: 0,
    });
    await this.cacheManager.set(TXN_BATCH, Number(txn_batch_block_number), {
      ttl: 0,
    });
    await this.cacheManager.set(STATE_BATCH, Number(state_batch_block_number), {
      ttl: 0,
    });
    await this.cacheManager.set(DA_BATCH_INDEX, Number(da_batch_index), {
      ttl: 0,
    });
    this.sync_token_price_history();
    this.sync_token_price_real_time();
    console.log('================end init cache================');

  }
  @Interval(12000)
  async l1_sent() {
    let end = 0;
    const currentL1BlockNumber =
      await this.l1IngestionService.getCurrentBlockNumber();
    console.log('l1 sent currentBlockNumber: ', currentL1BlockNumber);
    const currentBlockNumber = currentL1BlockNumber - 1;
    const start = Number(await this.cacheManager.get(L1_SENT));
    if (currentBlockNumber - start > SYNC_STEP) {
      end = start + SYNC_STEP;
    } else {
      end =
        start - SYNC_STEP > currentBlockNumber
          ? start - SYNC_STEP
          : currentBlockNumber;
    }
    if (currentBlockNumber > start + 1) {
      const inserted = await this.l1IngestionService.createSentEvents(
        start + 1,
        end,
      );
      if (inserted) {
        this.cacheManager.set(L1_SENT, end, { ttl: 0 });
      } else {
        this.logger.error('-------- insert l1 sent message events failed -----------');
      }
    }
  }
  @Interval(12000)
  async l1_relayed() {
    let end = 0;
    const currentL1BlockNumber =
      await this.l1IngestionService.getCurrentBlockNumber();
    console.log('l1 relayed currentBlockNumber: ', currentL1BlockNumber);
    const currentBlockNumber = currentL1BlockNumber - 1;
    const start = Number(await this.cacheManager.get(L1_RELAYED));
    if (currentBlockNumber - start > SYNC_STEP) {
      end = start + SYNC_STEP;
    } else {
      end =
        start - SYNC_STEP > currentBlockNumber
          ? start - SYNC_STEP
          : currentBlockNumber;
    }
    if (currentBlockNumber > start + 1) {
      const inserted = await this.l1IngestionService.createRelayedEvents(
        start + 1,
        end,
      );
      if (inserted) {
        this.cacheManager.set(L1_RELAYED, end, { ttl: 0 });
      } else {
        this.logger.error('-------- insert l1 relayed message events failed -----------');
      }
    }
  }
  @Interval(2000)
  async l2_sent() {
    let end = 0;
    const currentL2BlockNumber =
      await this.l2IngestionService.getCurrentBlockNumber();
    console.log('l2 sent currentBlockNumber: ', currentL2BlockNumber);
    const currentBlockNumber = currentL2BlockNumber - 1;
    const start = Number(await this.cacheManager.get(L2_SENT));
    if (currentBlockNumber - start > SYNC_STEP_L2) {
      end = start + SYNC_STEP_L2;
    } else {
      end =
        start - SYNC_STEP_L2 > currentBlockNumber
          ? start - SYNC_STEP_L2
          : currentBlockNumber;
    }
    if (currentBlockNumber > start + 1) {
      const inserted = await this.l2IngestionService.createSentEvents(
        start + 1,
        end,
      );
      if (inserted) {
        this.cacheManager.set(L2_SENT, end, { ttl: 0 });
      } else {
        this.logger.error('-------- insert l2 sent message events failed -----------');
      }
    }
  }
  @Interval(2000)
  async l2_relayed() {
    let end = 0;
    const currentL2BlockNumber =
      await this.l2IngestionService.getCurrentBlockNumber();
    console.log('l2 relayed currentBlockNumber: ', currentL2BlockNumber);
    const currentBlockNumber = currentL2BlockNumber - 1;
    const start = Number(await this.cacheManager.get(L2_RELAYED));
    if (currentBlockNumber - start > SYNC_STEP_L2) {
      end = start + SYNC_STEP_L2;
    } else {
      end =
        start - SYNC_STEP_L2 > currentBlockNumber
          ? start - SYNC_STEP_L2
          : currentBlockNumber;
    }
    if (currentBlockNumber > start + 1) {
      const inserted = await this.l2IngestionService.createRelayedEvents(
        start + 1,
        end,
      );
      if (inserted) {
        this.cacheManager.set(L2_RELAYED, end, { ttl: 0 });
      } else {
        this.logger.error('-------- insert l2 relayed message events failed -----------');
      }
    }
  }
  @Interval(3000)
  async state_batch() {
    let end = 0;
    const currentL1BlockNumber =
      await this.l1IngestionService.getCurrentBlockNumber();
    console.log('state batch currentBlockNumber: ', currentL1BlockNumber);
    // the latest block might get empty passed events
    const currentBlockNumber = currentL1BlockNumber - 1;
    const start = Number(await this.cacheManager.get(STATE_BATCH));
    // current = 100   start = 94  SYNC_STEP = 10
    if (currentBlockNumber - start > SYNC_STEP) {
      end = start + SYNC_STEP;
    } else {
      end =
        start - SYNC_STEP > currentBlockNumber
          ? start - SYNC_STEP
          : currentBlockNumber;
    }
    if (currentBlockNumber >= start + 1) {
      const result = await this.l1IngestionService.createStateBatchesEvents(
        start + 1,
        end,
      ).catch(e => {
        console.error(`insert state batch failed, number: ${start} ${end}`)
      });
      if (result) {
        const insertData = !result || result.length <= 0 ? [] : result[0].identifiers || []
        this.logger.log(
          `sync [${insertData.length}] state_batch from block [${start}] to [${end}]`,
        );
        await this.cacheManager.set(STATE_BATCH, end, { ttl: 0 });
      } else {
        console.error('result insert state batch data failed')
      }

    } else {
      this.logger.log(
        `sync state_batch finished and latest block number is: ${currentBlockNumber}`,
      );
    }
  }

  @Interval(10000)
  async l1l2_merge() {
    try {
      await this.l1IngestionService.createL1L2Relation();
    } catch (error) {
      this.logger.error(`error l1->l2 [handle_L1_l2_merge]: ${error}`);
    }
  }
  @Interval(10000)
  async l2l1_merge() {
    try {
      await this.l1IngestionService.createL2L1Relation();
    } catch (error) {
      this.logger.error(`error l1->l2 [handle_l1_l2__merge]: ${error}`);
    }
  }
  @Interval(10000)
  async l2l1_merge_waiting() {
    try {
      await this.l2IngestionService.handleWaitTransaction();
    } catch (error) {
      this.logger.error(`error l1l2 [handle_l2l1_merge_waiting]: ${error}`);
    }
  }
  @Interval(5000)
  async eigen_da_batch_txns() {

    const fromStoreNumber = Number(await this.cacheManager.get(DA_BATCH_INDEX));
    console.log('[syncEigenDaBatch] start eigenda service fromStoreNumber: ', fromStoreNumber);
    const result = await this.l1IngestionService.syncEigenDaBatch(fromStoreNumber).catch(e => {
      this.logger.error(`[syncEigenDaBatch] error eigen da batches err: ${e}`);
    });
    if (result) {
      console.log('[syncEigenDaBatch] add DA_BATCH_INDEX');
      await this.cacheManager.set(DA_BATCH_INDEX, fromStoreNumber + 1, { ttl: 0 });
    }
  }

  @Interval(1800000)
  async sync_token_price_history() {
    console.log('start sync token price service')
    this.l1IngestionService.syncTokenPriceHistory();
  }

  @Interval(10000)
  async sync_token_price_real_time() {
    this.l1IngestionService.syncTokenPriceRealTime();
  }

  @Interval(60000)
  async updateReorgBlockMessage() {
    this.l1IngestionService.updateReorgBlockMessage().catch(e => {
      console.error(`update reorg block failed`, e.message)
    });
  }
  
  @Interval(1000)
  async monitor_service() {
    this.monitorService.missBlockNumber();
    this.monitorService.syncBridgeData();
  }
}
