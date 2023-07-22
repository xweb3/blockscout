defmodule BlockScoutWeb.Tokens.ContractView do
  use BlockScoutWeb, :view

  alias BlockScoutWeb.Tokens.OverviewView
  alias Explorer.Chain.{Address, SmartContract, Token}
  alias Explorer.SmartContract.{Helper, Writer}

  def render("scripts.html", %{conn: conn}) do
    render_scripts(conn, "address_contract/code_highlighting.js")
  end

  def smart_contract_with_read_only_functions?(
        %Token{contract_address: %Address{smart_contract: %SmartContract{}}} = token
      ) do
    Enum.any?(token.contract_address.smart_contract.abi || [], &Helper.queriable_method?(&1))
  end

  def smart_contract_with_read_only_functions?(%Token{
        contract_address: %Address{smart_contract: nil}
      }),
      do: false

  def smart_contract_is_proxy?(%Token{
        contract_address: %Address{smart_contract: %SmartContract{} = smart_contract}
      }) do
    SmartContract.proxy_contract?(smart_contract)
  end

  def smart_contract_is_proxy?(%Token{contract_address: %Address{smart_contract: nil}}), do: false

  def smart_contract_with_write_functions?(%Token{
        contract_address: %Address{smart_contract: %SmartContract{}} = address
      }) do
    Enum.any?(
      address.smart_contract.abi || [],
      &Writer.write_function?(&1)
    )
  end

  def smart_contract_with_write_functions?(%Token{contract_address: %Address{smart_contract: nil}}),
    do: false
end
