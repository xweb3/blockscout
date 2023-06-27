import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class TokenPriceHistory {
  @PrimaryColumn({ type: 'numeric', name: 'start_time' })
  start_time: number;

  @Column({ type: 'numeric' })
  mnt_to_usd: number;

  @Column({ type: 'numeric' })
  end_time: number;
}
