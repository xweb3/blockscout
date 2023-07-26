import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('last_24hrs_stats')
export class Last24HrsStats {
  @PrimaryColumn({ type: 'bigint'})
  id: number;

  @Column({ type: 'bigint' })
  const_id: number;

  @Column({ type: 'bigint' })
  number_of_transactions: number;

  @Column({ type: 'bigint' })
  number_of_blocks: number;

}
