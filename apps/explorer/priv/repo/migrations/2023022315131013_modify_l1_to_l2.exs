defmodule Explorer.Repo.Migrations.ModifyL1ToL2 do
  use Ecto.Migration

  def change do
    alter table(:l1_to_l2) do
      modify(:l2_hash, :bytea, null: true)
      modify(:block, :bigint, null: true)
      modify(:timestamp, :utc_datetime_usec, null: true)
      modify(:tx_origin, :bytea, null: true)
      modify(:queue_index, :bigint, null: true)
      modify(:target, :bytea, null: true)
      modify(:gas_limit, :numeric, precision: 100, null: true)
      modify(:type, :integer, null: true, default: 0)    # 0: reward; 1: deposit
      modify(:value, :numeric, precision: 100, null: true, default: 0)
      modify(:is_merge, :boolean, null: true, default: false)
      modify(:inserted_at, :utc_datetime_usec, null: true)
      modify(:updated_at, :utc_datetime_usec, null: true)
    end
  end
end
