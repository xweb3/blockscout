defmodule Explorer.Repo.Migrations.TransactionsStatAddTodayStartBlockColumn do
  use Ecto.Migration

  def change do
    alter table(:transaction_stats) do
      add(:today_start_block, :numeric, null: true)
    end
  end
end
