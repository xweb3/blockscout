import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class TokenPriceRealTime {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  token_id: string;

  @Column({ type: 'numeric' })
  mnt_to_usd: number;

  @Column({ type: 'numeric' })
  mnt_to_eth: number;

  @Column({ type: 'numeric' })
  mnt_to_btc: number;
}
