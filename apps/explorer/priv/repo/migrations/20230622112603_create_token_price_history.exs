defmodule Explorer.Repo.Migrations.CreateTokenPriceHistory do
  use Ecto.Migration

  def change do
    create table(:token_price_history, primary_key: false) do
      add(:mnt_to_usd, :float, null: false)
      add(:start_time, :bigint, null: false, primary_key: true)
      add(:end_time, :bigint, null: false)
    end
  end
end
