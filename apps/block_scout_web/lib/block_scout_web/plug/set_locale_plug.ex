defmodule BlockScoutWeb.Plug.SetLocale do
  import Plug.Conn # 1

  @supported_locales Gettext.known_locales(BlockScoutWeb.Gettext) # 2

  def init(_options), do: nil # 3

  @spec call(atom | %{:params => nil | maybe_improper_list | map, optional(any) => any}, any) ::
          atom | %{:params => nil | maybe_improper_list | map, optional(any) => any}
  def call(%Plug.Conn{params: %{"locale" => locale}} = conn, _options) when locale in @supported_locales do
    BlockScoutWeb.Gettext |> Gettext.put_locale(locale)
    conn |> put_resp_cookie "locale", locale, max_age: 365*24*60*60, http_only: false
  end

  def call(conn, _options) do
    case fetch_locale_from(conn) do
      nil -> conn
      locale ->
        BlockScoutWeb.Gettext |> Gettext.put_locale(locale)
        conn |> put_resp_cookie "locale", locale, max_age: 365*24*60*60, http_only: false
    end
  end

  defp fetch_locale_from(conn) do
    (conn.params["locale"] || conn.cookies["locale"]) |>
    check_locale
  end

  defp check_locale(locale) when locale in @supported_locales, do: locale

  defp check_locale(_), do: nil

end
