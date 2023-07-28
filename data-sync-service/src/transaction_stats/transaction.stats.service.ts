import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import moment from 'moment';
import {
  Blocks,
  Transactions,
  TransactionStats,
  Last24HrsStats,
} from 'src/typeorm';
import { EntityManager, getConnection, getManager, Repository } from 'typeorm';

@Injectable()
export class TransactionStatsService {
  private readonly logger = new Logger(TransactionStatsService.name);
  entityManager: EntityManager;
  constructor(
    private configService: ConfigService,
    @InjectRepository(Blocks)
    private readonly blocksRepository: Repository<Blocks>,
    @InjectRepository(Transactions)
    private readonly transactionsRepository: Repository<Transactions>,

    @InjectRepository(TransactionStats)
    private readonly transactionStatsRepository: Repository<TransactionStats>,


  ) {
    this.entityManager = getManager();

  }

  async queryTodayStartBlock(formatUTCTimestamp) {
    let startBlockNumber = 0;
    const res = await this.entityManager.query(`
    SELECT number FROM blocks WHERE timestamp >= $1 order by number asc limit 1;
    `, [formatUTCTimestamp])
    if (res?.length > 0) {
      const { number } = res[0]
      startBlockNumber = number;
    } else {
      const subRes = await this.entityManager.query(`
      SELECT number FROM blocks WHERE timestamp < $1 order by number desc limit 1;
      `, [formatUTCTimestamp])
      if (subRes?.length > 0) {
        const { number } = subRes[0]
        startBlockNumber = number + 1;
      }
    }

    console.log({
      type: 'log',
      time: new Date().getTime(),
      msg: {
        message: `today start block number`,
        startBlockNumber,
        time: formatUTCTimestamp
      },
    });
    return startBlockNumber;
  }

  async updateTransactionStats() {
    try {
      const todayUtcZeroTimestamp = moment.utc().clone().startOf('day').valueOf();
      const formatUTCTimestamp = new Date(todayUtcZeroTimestamp).toISOString();

      //const startBlockNumber = await this.queryTodayStartBlock(formatUTCTimestamp);

      //TODO (Jayce) The method calculated of count of txn should be change after upgrade of bedrock
      const [{ count }] = await this.entityManager.query(`SELECT count(*) FROM blocks WHERE timestamp >= $1`, [formatUTCTimestamp])

      if (count || count === 0) {
        await getConnection()
          .createQueryBuilder()
          .setLock('pessimistic_write')
          .insert()
          .into(TransactionStats)
          .values([{
            date: formatUTCTimestamp,
            number_of_transactions: count,
            gas_used: 0,
            total_fee: 0,
            //today_start_block: Number(startBlockNumber),
          }])
          .orUpdate(["number_of_transactions", "today_start_block"], ["date"], {
            skipUpdateIfNoValuesChanged: true
          })
          .execute()
      }
    } catch (e) {
      console.log({
        type: 'ERROR',
        time: new Date().getTime(),
        msg: `update today transaction stats failed ${e?.message}`
      })
    }


  }

  async updateLast24HrsStats() {
    const currentUTCTimestamp = moment.utc().valueOf();
    const last24HrsAgoTimestamp = currentUTCTimestamp - 86400000;
    const formatUTCTimestamp = new Date(last24HrsAgoTimestamp).toISOString();

    try {
      //TODO (Jayce) The method calculated of count of txn should be change after upgrade of bedrock
      const [{ count }] = await this.entityManager.query(`SELECT count(*) FROM blocks WHERE timestamp >= $1`, [formatUTCTimestamp])
      if (count || count === 0) {
        await getConnection()
          .createQueryBuilder()
          .setLock('pessimistic_write')
          .insert()
          .into(Last24HrsStats)
          .values([{
            const_id: 1,
            number_of_transactions: count,
            number_of_blocks: count,
          }])
          .orUpdate(["number_of_transactions", "number_of_blocks"], ["const_id"], {
            skipUpdateIfNoValuesChanged: true
          })
          .execute()
      }
    } catch (e) {
      console.log({
        type: 'ERROR',
        time: new Date().getTime(),
        msg: `update today last 24 hours stats failed ${e?.message}`
      })
    }
  }

}
