defmodule Explorer.Repo.Migrations.AddIndexToL2RelayedMessageEvents do
  use Ecto.Migration

  def change do
    create(index(:l2_relayed_message_events, :tx_hash))
  end
end
