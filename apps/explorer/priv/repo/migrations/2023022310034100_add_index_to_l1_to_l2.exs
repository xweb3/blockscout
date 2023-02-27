defmodule Explorer.Repo.Migrations.AddIndexToL1ToL2 do
  use Ecto.Migration

  def change do
    create(index(:l1_to_l2, :msg_hash))
    create(index(:l1_to_l2, :hash))
  end
end
