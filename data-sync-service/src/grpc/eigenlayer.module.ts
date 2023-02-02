import { Module } from '@nestjs/common';
import { EigenlayerService } from './eigenlayer.service';

@Module({
  imports: [],
  providers: [EigenlayerService],
  exports: [EigenlayerService],
})
export class EigenlayerModule {}
