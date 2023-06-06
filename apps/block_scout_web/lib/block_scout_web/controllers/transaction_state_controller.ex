defmodule BlockScoutWeb.TransactionStateController do
  use BlockScoutWeb, :controller

  alias BlockScoutWeb.{
    AccessHelpers,
    Controller,
    Models.TransactionStateHelper,
    TransactionController,
    TransactionStateView
  }

  alias Explorer.{Chain, Market}
  alias Explorer.ExchangeRates.Token
  alias Phoenix.View

  import BlockScoutWeb.Account.AuthController, only: [current_user: 1]
  import BlockScoutWeb.Models.GetAddressTags, only: [get_address_tags: 2]
  import BlockScoutWeb.Models.GetTransactionTags, only: [get_transaction_with_addresses_tags: 2]
  import EthereumJSONRPC

  {:ok, burn_address_hash} = Chain.string_to_address_hash("0x0000000000000000000000000000000000000000")

  @burn_address_hash burn_address_hash

  def index(conn, %{"transaction_id" => transaction_hash_string, "type" => "JSON"} = params) do
    with {:ok, transaction_hash} <- Chain.string_to_transaction_hash(transaction_hash_string),
         {:ok, transaction} <-
           Chain.hash_to_transaction(
             transaction_hash,
             necessity_by_association: %{
               [block: :miner] => :optional,
               from_address: :optional,
               to_address: :optional
             }
           ),
         {:ok, false} <-
           AccessHelpers.restricted_access?(to_string(transaction.from_address_hash), params),
         {:ok, false} <-
           AccessHelpers.restricted_access?(to_string(transaction.to_address_hash), params) do
      state_changes = TransactionStateHelper.state_changes(transaction)

      rendered_changes =
        Enum.map(state_changes, fn state_change ->
          View.render_to_string(
            TransactionStateView,
            "_state_change.html",
            coin_or_token_transfers: state_change.coin_or_token_transfers,
            address: state_change.address,
            burn_address_hash: @burn_address_hash,
            balance_before: state_change.balance_before,
            balance_after: state_change.balance_after,
            balance_diff: state_change.balance_diff,
            conn: conn,
            miner: state_change.miner?
          )
        end)

      json(conn, %{
        items: rendered_changes
      })
    else
      {:restricted_access, _} ->
        TransactionController.set_not_found_view(conn, transaction_hash_string)

      :error ->
        unprocessable_entity(conn)

      {:error, :not_found} ->
        TransactionController.set_not_found_view(conn, transaction_hash_string)

      :not_found ->
        TransactionController.set_not_found_view(conn, transaction_hash_string)
    end
  end

  def index(conn, %{"transaction_id" => transaction_hash_string} = params) do
    with {:ok, transaction_hash} <- Chain.string_to_transaction_hash(transaction_hash_string),
         {:ok, transaction} <-
           Chain.hash_to_transaction(
             transaction_hash,
             necessity_by_association: %{
               :block => :optional,
               [created_contract_address: :names] => :optional,
               [from_address: :names] => :optional,
               [to_address: :names] => :optional,
               [to_address: :smart_contract] => :optional,
               :token_transfers => :optional
             }
           ),
         {:ok, false} <-
           AccessHelpers.restricted_access?(to_string(transaction.from_address_hash), params),
         {:ok, false} <-
           AccessHelpers.restricted_access?(to_string(transaction.to_address_hash), params) do
            tx_status = EthereumJSONRPC.request(%{id: 0, method: "eth_getTxStatusDetailByHash", params: [transaction_hash_string]})
          |> json_rpc(Application.get_env(:indexer, :json_rpc_named_arguments))
          |> case do
            {:ok, tx}  ->
              tx["status"]
            {:error, _} ->
              nil
          end
          updated_transaction = case Chain.hash_to_batch(transaction_hash_string,necessity_by_association: @necessity_by_association) do
            {:error, _} ->
              transaction
            {:ok, %{batch_index: batch_index, data_commitment: data_commitment}} ->
              res = Map.put(transaction, :batch_index, batch_index)
              Map.put(res, :data_commitment, data_commitment)
          end
          updated_state_transaction = case Chain.block_to_state_batch(transaction.block_number,necessity_by_association: @necessity_by_association) do
            {:error, _} ->
              updated_transaction
            {:ok, %{batch_index: batch_index, submission_tx_hash: submission_tx_hash}} ->
              res = Map.put(updated_transaction, :state_batch_index, batch_index)
              Map.put(res, :submission_tx_hash, submission_tx_hash)
          end

          updated_display_tx_status_state_transaction = if tx_status == nil, do: updated_state_transaction, else: Map.put(updated_state_transaction, :tx_status, tx_status)
      render(
        conn,
        "index.html",
        exchange_rate: Market.get_exchange_rate(Explorer.coin()) || Token.null(),
        block_height: Chain.block_height(),
        current_path: Controller.current_full_path(conn),
        show_token_transfers: Chain.transaction_has_token_transfers?(transaction_hash),
        transaction: updated_display_tx_status_state_transaction,
        from_tags: get_address_tags(transaction.from_address_hash, current_user(conn)),
        to_tags: get_address_tags(transaction.to_address_hash, current_user(conn)),
        tx_tags:
          get_transaction_with_addresses_tags(
            transaction,
            current_user(conn)
          ),
        current_user: current_user(conn)
      )
    else
      :not_found ->
        TransactionController.set_not_found_view(conn, transaction_hash_string)

      :error ->
        unprocessable_entity(conn)

      {:error, :not_found} ->
        TransactionController.set_not_found_view(conn, transaction_hash_string)

      {:restricted_access, _} ->
        TransactionController.set_not_found_view(conn, transaction_hash_string)
    end
  end
end
