defmodule Explorer.Chain.Transaction.History.Last24HrsStats do
  @moduledoc """
  Represents last 24 hours stats numbers.
  """

  import Ecto.Query, only: [from: 2]

  use Explorer.Schema

  alias Explorer.Repo

  @derive {Jason.Encoder,
           except: [
             :__meta__
           ]}

  schema "last_24hrs_stats" do
    field(:const_id, :integer)
    field(:number_of_transactions, :integer)
    field(:number_of_blocks, :integer)
  end

  @type t :: %__MODULE__{
          const_id: integer(),
          number_of_transactions: integer(),
          number_of_blocks: integer(),
        }

  @spec by_const_id(integer()) :: [__MODULE__]
  def by_const_id(const_id) do
    query =
      from(stat in __MODULE__,
        where: stat.const_id == ^const_id,
      )

    Repo.all(query)
  end
end
