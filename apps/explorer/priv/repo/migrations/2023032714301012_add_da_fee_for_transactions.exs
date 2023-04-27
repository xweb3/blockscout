defmodule Explorer.Repo.Migrations.AddDaFeeForTransactions do
  use Ecto.Migration

  def change do
    alter table(:transactions) do
      add(:da_gas_price, :numeric, precision: 100, null: true)
      add(:da_gas_used, :numeric, precision: 100, null: true)
      add(:da_fee, :numeric, precision: 100, null: true)
    end
  end
end
