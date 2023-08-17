defmodule BlockScoutWeb.APIDocsView do
  use BlockScoutWeb, :view

  alias BlockScoutWeb.LayoutView
  alias Explorer

  def explorerNotes(name,fallback) do
    case name do
      "eth_getBalance" ->
        raw gettext("The `earliest` parameter will not work as expected currently, because genesis block balances are not currently imported")
      "eth_getLogs" ->
        raw gettext("Will never return more than 1000 log entries. For this reason, you can use pagination options to request the next page. Pagination options params: {\"logIndex\": \"3D\", \"blockNumber\": \"6423AC\", \"transactionIndex\": 53} which include parameters from the last log received from the previous request. These three parameters are required for pagination.")
      true -> raw fallback
    end
  end

  def explorerDescription(name,fallback) do
    case name do
      "Object" ->
        gettext("The filter options")
      "Data" ->
        gettext("20 Bytes - address to check for balance")
      "Quantity|Tag" ->
        gettext("Integer block number, or the string \"latest\", \"earliest\" or \"pending\"")
      true -> fallback
    end
  end

  def action_tile_id(module, action) do
    "#{module}-#{action}"
  end

  def generateDescription(action) do
    if(action[:getDescription] && action.getDescription.(action.name)) do
      raw action.getDescription.(action.name)
    else
      raw action.description
    end
  end

  def generateRequiredParamsDescription(required_param, action) do
    if(required_param[:getRequiredParamsDescription] && required_param.getRequiredParamsDescription.(action.name <> "-" <> required_param.key)) do
      required_param.getRequiredParamsDescription.(action.name <> "-" <> required_param.key)
    else
      required_param.description
    end
  end

  def generateOptionalParamsDescription(optional_param, action) do
    if(optional_param[:getOptionalParamsDescription] && optional_param.getOptionalParamsDescription.(action.name <> "-" <> optional_param.key)) do
      optional_param.getOptionalParamsDescription.(action.name <> "-" <> optional_param.key)
    else
      optional_param.description
    end
  end

  def query_params(module, action) do
    module_and_action(module, action) <> Enum.join(required_params(action))
  end

  def input_placeholder(param) do
    "#{param.key} - #{param.description}"
  end

  def model_type_definition(definition) when is_binary(definition) do
    definition
  end

  def model_type_definition(definition_func) when is_function(definition_func, 1) do
    coin = Explorer.coin()
    definition_func.(coin)
  end

  defp module_and_action(module, action) do
    "?module=<strong>#{module}</strong>&action=<strong>#{action.name}</strong>"
  end

  defp required_params(action) do
    Enum.map(action.required_params, fn param ->
      "&#{param.key}=" <> "{<strong>#{param.placeholder}</strong>}"
    end)
  end

  def blockscout_url(set_path) when set_path == false do
    url_params = Application.get_env(:block_scout_web, BlockScoutWeb.Endpoint)[:url]
    host = url_params[:host]

    scheme = Keyword.get(url_params, :scheme, "http")

    if host != "localhost" do
      "#{scheme}://#{host}"
    else
      port = Application.get_env(:block_scout_web, BlockScoutWeb.Endpoint)[:http][:port]
      "#{scheme}://#{host}:#{to_string(port)}"
    end
  end

  def blockscout_url(set_path) when set_path == true do
    url_params = Application.get_env(:block_scout_web, BlockScoutWeb.Endpoint)[:url]
    host = url_params[:host]

    path = url_params[:path]

    scheme = Keyword.get(url_params, :scheme, "http")

    if host != "localhost" do
      "#{scheme}://#{host}#{path}"
    else
      port = Application.get_env(:block_scout_web, BlockScoutWeb.Endpoint)[:http][:port]
      "#{scheme}://#{host}:#{to_string(port)}"
    end
  end

  def api_url do
    true
    |> blockscout_url()
    |> Path.join("api")
  end

  def eth_rpc_api_url do
    true
    |> blockscout_url()
    |> Path.join("api/eth-rpc")
  end
end
