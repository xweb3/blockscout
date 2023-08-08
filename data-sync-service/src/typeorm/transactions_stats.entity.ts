import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class TransactionStats {
  @PrimaryColumn({ type: 'timestamp'})
  date: Date;

  @Column({ type: 'bigint' })
  number_of_transactions: number;

  @Column({ type: 'bigint' })
  gas_used: number;

  @Column({ type: 'bigint' })
  total_fee: number;

  @Column({ type: 'bigint' })
  today_start_block: number;

}
