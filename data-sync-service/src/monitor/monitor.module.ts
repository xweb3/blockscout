import { Module } from '@nestjs/common';
import { MonitorService } from './monitor.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  L2ToL1,
  L1ToL2,
  Transactions,
} from 'src/typeorm';
import { HttpModule } from '@nestjs/axios';
import {
  makeGaugeProvider,
} from "@willsoto/nestjs-prometheus";

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([L2ToL1, L1ToL2, Transactions]),
  ],
  providers: [
    MonitorService,
    makeGaugeProvider({
      name: 'block_number',
      help: 'block number',
    }),
    makeGaugeProvider({
      name: 'miss_block_number',
      help: 'miss block number',
    }),
    makeGaugeProvider({
      name: 'mnt_total_locked_value',
      help: 'mantle token total locked in bridge',
    }),
    makeGaugeProvider({
      name: 'mnt_total_deposit_value',
      help: 'mantle token total deposit value through contract',
    }),
    makeGaugeProvider({
      name: 'mnt_total_withdraw_value',
      help: 'mantle token total withdraw value through contract',
    }),
    makeGaugeProvider({
      name: 'eth_total_locked_value',
      help: 'ether total locked in bridge',
    }),
    makeGaugeProvider({
      name: 'eth_total_deposit_value',
      help: 'ether total deposit value through contract',
    }),
    makeGaugeProvider({
      name: 'eth_total_withdraw_value',
      help: 'ether total withdraw value through contract',
    }),
  ],
  exports: [MonitorService],
})
export class MonitorModule {}
