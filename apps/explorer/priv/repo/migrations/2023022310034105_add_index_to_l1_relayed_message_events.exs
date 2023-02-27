defmodule Explorer.Repo.Migrations.AddIndexToL1RelayedMessageEvents do
  use Ecto.Migration

  def change do
    create(index(:l1_relayed_message_events, :tx_hash))
  end
end
