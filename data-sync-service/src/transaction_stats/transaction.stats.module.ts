import { Module } from '@nestjs/common';
import { TransactionStatsService } from './transaction.stats.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Blocks,
  TransactionStats,
  Transactions,
} from 'src/typeorm';

@Module({
  imports: [
    TypeOrmModule.forFeature([Blocks, TransactionStats, Transactions]),
  ],
  providers: [
    TransactionStatsService,
  ],
  exports: [TransactionStatsService],
})
export class TransactionStatsModule {}
