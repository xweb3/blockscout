import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Blocks {
  @PrimaryColumn({ type: 'bigint', name: 'number' })
  hash: number;

  @Column({ type: 'timestamp' })
  timestamp: Date;

}
