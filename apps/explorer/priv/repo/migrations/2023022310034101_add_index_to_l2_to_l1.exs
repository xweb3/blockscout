defmodule Explorer.Repo.Migrations.AddIndexToL2ToL1 do
  use Ecto.Migration

  def change do
    create(index(:l2_to_l1, :msg_hash))
  end
end
