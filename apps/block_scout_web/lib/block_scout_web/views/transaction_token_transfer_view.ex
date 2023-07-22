defmodule BlockScoutWeb.TransactionTokenTransferView do
  use BlockScoutWeb, :view

  alias Explorer.Chain
  alias Explorer.Chain.{Address, Transaction}
  alias BlockScoutWeb.Account.AuthController
  import BlockScoutWeb.AddressView, only: [tag_name_to_label: 1]

  def transaction_status(transaction) do
    Chain.transaction_to_status(transaction)
  end

  def get_transaction(transaction_hash) do
    Chain.hash_to_transaction(
      transaction_hash,
      necessity_by_association: %{
        [created_contract_address: :names] => :optional,
        [from_address: :names] => :optional,
        [to_address: :names] => :optional,
        [created_contract_address: :smart_contract] => :optional,
        [from_address: :smart_contract] => :optional,
        [to_address: :smart_contract] => :optional,
        [token_transfers: :token] => :optional,
        [token_transfers: :to_address] => :optional,
        [token_transfers: :from_address] => :optional,
        [token_transfers: :token_contract_address] => :optional,
        :block => :optional
      }
    )
  end
end
