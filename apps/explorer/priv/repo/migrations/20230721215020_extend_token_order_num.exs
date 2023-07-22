defmodule Explorer.Repo.Migrations.ExtendTokenOrderNum do
  use Ecto.Migration

  def change do
    alter table(:tokens) do
      add(:order_num, :decimal, null: true)
    end
  end
end
