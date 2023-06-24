defmodule Explorer.Chain.TokenPriceRealTime do
  use Ecto.Schema
  import Ecto.Changeset

  @type t :: %__MODULE__{
    token_id: String.t(),
    mnt_to_usd: Hash.Full.t(),
    mnt_to_eth: Hash.Full.t(),
    mnt_to_btc: Hash.Full.t(),
  }

  @primary_key {:token_id, :string, autogenerate: false}
  schema "token_price_history" do
    field(:mnt_to_usd, :integer)
    field(:mnt_to_eth, :integer)
    field(:mnt_to_btc, :integer)
  end

end
