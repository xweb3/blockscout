import { Module } from '@nestjs/common';
import { L2IngestionService } from './l2Ingestion.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { L2RelayedMessageEvents, L2SentMessageEvents, L2ToL1 } from 'src/typeorm';
import { HttpModule } from '@nestjs/axios';
import {
  makeGaugeProvider,
} from "@willsoto/nestjs-prometheus";

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([L2RelayedMessageEvents, L2SentMessageEvents, L2ToL1]),
  ],
  providers: [
    L2IngestionService,
    makeGaugeProvider({
      name: 'msg_nonce',
      help: 'msg nonce',
    }),
    makeGaugeProvider({
      name: 'l1_to_l2_l2_hash',
      help: 'l2_hash in l1_to_l2 table ',
    }),
    makeGaugeProvider({
      name: 'l2_to_l1_status',
      help: 'status in l2_to_l1 table ',
    })
    
  ],
  exports: [L2IngestionService],
})
export class L2IngestionModule {}
