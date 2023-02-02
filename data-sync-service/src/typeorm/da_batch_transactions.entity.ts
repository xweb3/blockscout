import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class DaBatchTransaction {
  @PrimaryColumn({ type: 'int8' })
  batch_index: number;

  @Column({ type: 'bytea' })
  tx_hash: string;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  inserted_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
