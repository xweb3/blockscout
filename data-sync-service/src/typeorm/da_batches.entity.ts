import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class DaBatches {
  @PrimaryColumn({ type: 'int8' })
  batch_index: number;

  @Column({ type: 'varchar', length: 255 })
  status: string;

  @Column({ type: 'int8' })
  start_block: number;

  @Column({ type: 'int8' })
  end_block: number;

  @Column({ type: 'bytea' })
  da_hash: string;

  @Column({ type: 'int8' })
  store_id: number;

  @Column({ type: 'int8' })
  store_number: number;

  @Column({ type: 'numeric', precision: 100 })
  de_fee: number;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  inserted_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
