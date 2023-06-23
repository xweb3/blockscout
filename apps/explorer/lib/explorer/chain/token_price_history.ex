defmodule Explorer.Chain.TokenPriceHistory do
  use Ecto.Schema
  import Ecto.Changeset

  @type t :: %__MODULE__{
    mnt_to_usd: Hash.Full.t(),
    start_time: Hash.Full.t(),
    end_time: integer()
  }

  @primary_key {:start_time, :integer, autogenerate: false}
  schema "token_price_history" do
    field(:mnt_to_usd, :integer)
    field(:end_time, :integer)
  end

end
