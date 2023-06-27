defmodule Explorer.Chain.TokenPriceRealTime do
  use Ecto.Schema
  import Ecto.Changeset

  @type t :: %__MODULE__{
    token_id: String.t(),
    mnt_to_usd: Decimal.t(),
    mnt_to_eth: Decimal.t(),
    mnt_to_btc: Decimal.t(),
  }

  @primary_key {:token_id, :string, autogenerate: false}
  schema "token_price_real_time" do
    field(:mnt_to_usd, :decimal)
    field(:mnt_to_eth, :decimal)
    field(:mnt_to_btc, :decimal)
  end

end
