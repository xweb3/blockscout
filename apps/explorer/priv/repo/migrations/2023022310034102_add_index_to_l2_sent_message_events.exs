defmodule Explorer.Repo.Migrations.AddIndexToL2SentMessageEvents do
  use Ecto.Migration

  def change do
    create(index(:l2_sent_message_events, :tx_hash))
  end
end
