defmodule Explorer.Repo.Migrations.AddIndexToL1SentMessageEvents do
  use Ecto.Migration

  def change do
    create(index(:l1_sent_message_events, :tx_hash))
  end
end
