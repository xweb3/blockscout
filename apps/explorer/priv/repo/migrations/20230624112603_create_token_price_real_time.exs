defmodule Explorer.Repo.Migrations.CreateTokenPriceRealTime do
  use Ecto.Migration

  def change do
    create table(:token_price_real_time, primary_key: false) do
      add(:token_id, :string, null: false, primary_key: true)
      add(:mnt_to_usd, :float, null: true)
      add(:mnt_to_eth, :float, null: true)
      add(:mnt_to_btc, :float, null: true)
    end
  end
end
