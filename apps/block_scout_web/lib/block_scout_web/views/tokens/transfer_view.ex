defmodule BlockScoutWeb.Tokens.TransferView do
  use BlockScoutWeb, :view

  alias BlockScoutWeb.Tokens.OverviewView
  alias Explorer.Chain
  alias Explorer.Chain.{Address, Transaction}
  alias BlockScoutWeb.Account.AuthController
  import BlockScoutWeb.AddressView, only: [tag_name_to_label: 1]
  import BlockScoutWeb.Tokens.Helper


  def transaction_status(transaction) do
    Chain.transaction_to_status(transaction)
  end

  def include_multiple_token?(transaction) do
    result = case token_transfer_amount(transaction) do
      {:ok, :erc721_instance} ->
        false
      {:ok, :erc1155_instance, _value} ->
        false
      {:ok, :erc1155_instance, _values, _token_ids, _decimals} ->
        true
      {:ok, _} ->
        false
    end
    result
  end

  def include_multiple_token_from_transaction?(transaction) do
    result = if BlockScoutWeb.TransactionView.involves_token_transfers?(transaction) do
      [first_token_transfer | _remaining_token_transfers] = transaction.token_transfers
      include_multiple_token?(first_token_transfer)
    else
      false
    end

    result
  end

end
