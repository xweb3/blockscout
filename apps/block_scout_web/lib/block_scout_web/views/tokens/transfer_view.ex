defmodule BlockScoutWeb.Tokens.TransferView do
  use BlockScoutWeb, :view

  alias BlockScoutWeb.Tokens.OverviewView
  alias Explorer.Chain
  alias Explorer.Chain.{Address, Transaction}
  alias BlockScoutWeb.Account.AuthController
  import BlockScoutWeb.AddressView, only: [tag_name_to_label: 1]

  def transaction_status(transaction) do
    Chain.transaction_to_status(transaction)
  end
end
