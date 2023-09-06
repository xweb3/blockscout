defmodule BlockScoutWeb.AddressWithdrawController do
  use BlockScoutWeb, :controller

  alias BlockScoutWeb.{AccessHelpers, Controller, TransactionView}
  alias Explorer.ExchangeRates.Token
  alias Explorer.{Chain, Market}
  alias Explorer.Chain.Address
  alias Indexer.Fetcher.CoinBalanceOnDemand
  alias Phoenix.View
  require Logger

  import BlockScoutWeb.Chain,
    only: [
      fetch_page_number: 1,
      update_page_parameters: 3,
      current_filter: 1,
      next_page_params: 3,
      paging_options: 1,
      split_list_by_page: 1
    ]

  import BlockScoutWeb.Account.AuthController, only: [current_user: 1]
  import BlockScoutWeb.Models.GetAddressTags, only: [get_address_tags: 2]

  @transaction_necessity_by_association [
    necessity_by_association: %{
      :block => :required
    }
  ]

  {:ok, burn_address_hash} =
    Chain.string_to_address_hash("0x0000000000000000000000000000000000000000")

  @burn_address_hash burn_address_hash

  def index(
        conn,
        %{
          "address_id" => address_hash_string,
          "type" => "JSON"
        } = params
      ) do
    with {:ok, address_hash} <- Chain.string_to_address_hash(address_hash_string),
         {:ok, address} <- Chain.hash_to_address(address_hash),
         {:ok, false} <- AccessHelpers.restricted_access?(address_hash_string, params) do
      full_options =
        [
          necessity_by_association: %{
            [created_contract_address: :names] => :optional,
            [from_address: :names] => :optional,
            [to_address: :names] => :optional,
            [created_contract_address: :smart_contract] => :optional,
            [from_address: :smart_contract] => :optional,
            [to_address: :smart_contract] => :optional
          }
        ]
        |> Keyword.merge(paging_options(params))

      transactions =
        Chain.address_withdraw_transactions(
          address_hash,
          address_hash_string,
          full_options
        )

      {transactions_paginated, next_page} = split_list_by_page(transactions)

      next_page_path =
        case next_page_params(next_page, transactions_paginated, params) do
          nil ->
            nil

          next_page_params ->
            address_withdraw_path(
              conn,
              :index,
              address_hash_string,
              Map.delete(next_page_params, "type")
            )
        end

      transfers_json =
        Enum.map(transactions_paginated, fn transaction ->
          View.render_to_string(
            TransactionView,
            "_table_tile_deposit_withdraw.html",
            conn: conn,
            transaction: transaction,
            burn_address_hash: @burn_address_hash,
            current_address: address,
            tags: get_address_tags(address_hash, current_user(conn))
          )
        end)

      json(conn, %{items: transfers_json, next_page_path: next_page_path})
    else
      {:restricted_access, _} ->
        not_found(conn)

      :error ->
        unprocessable_entity(conn)

      {:error, :not_found} ->
        not_found(conn)
    end
  end

  def index(
        conn,
        %{"address_id" => address_hash_string} = params
      ) do
    with {:ok, address_hash} <- Chain.string_to_address_hash(address_hash_string),
         {:ok, address} <- Chain.hash_to_address(address_hash),
         {:ok, false} <- AccessHelpers.restricted_access?(address_hash_string, params) do
      render(
        conn,
        "index.html",
        address: address,
        coin_balance_status: CoinBalanceOnDemand.trigger_fetch(address),
        exchange_rate: Market.get_exchange_rate(Explorer.coin()) || Token.null(),
        filter: params["filter"],
        current_path: Controller.current_full_path(conn),
        counters_path:
          address_path(conn, :address_counters, %{"id" => Address.checksum(address_hash)}),
        tags: get_address_tags(address_hash, current_user(conn))
      )
    else
      {:restricted_access, _} ->
        not_found(conn)

      :error ->
        unprocessable_entity(conn)

      {:error, :not_found} ->
        not_found(conn)
    end
  end
end
