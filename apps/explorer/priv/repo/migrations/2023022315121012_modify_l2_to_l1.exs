defmodule Explorer.Repo.Migrations.ModifyL2ToL1 do
  use Ecto.Migration

  def change do
    alter table(:l2_to_l1) do
      modify(:block, :bigint, null: true)
      modify(:msg_nonce, :bigint, null: true)
      modify(:from_address, :bytea, null: true)
      modify(:txn_batch_index, :bigint, null: true)
      modify(:state_batch_index, :bigint, null: true)
      modify(:timestamp, :utc_datetime_usec, null: true)
      modify(:status, :string, null: true)
      modify(:gas_limit, :numeric, precision: 100, null: true)
      modify(:value, :numeric, precision: 100, null: true, default: 0)
      modify(:inserted_at, :utc_datetime_usec, null: true)
      modify(:updated_at, :utc_datetime_usec, null: true)
    end
  end
end
