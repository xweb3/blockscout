defmodule Explorer.Repo.Migrations.CreateLast24HrsStats do
  use Ecto.Migration

  def change do
    create table(:last_24hrs_stats) do
      add(:const_id, :integer)
      add(:number_of_transactions, :integer)
      add(:number_of_blocks, :integer)
    end

    create(unique_index(:last_24hrs_stats, :const_id))
  end
end
