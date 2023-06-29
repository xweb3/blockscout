defmodule BlockScoutWeb.Plug.RedisCookie do
  @moduledoc """
    Extended version of Plug.Session.COOKIE from https://github.com/elixir-plug/plug/blob/main/lib/plug/session/cookie.ex
    Added Redis to have a possibility to invalidate session
  """

  require Logger
  @behaviour Plug.Session.Store

  alias Plug.Crypto
  alias Plug.Crypto.{KeyGenerator, MessageEncryptor, MessageVerifier}

  @impl true
  def init(opts) do
    Logger.info("111")
    opts
    |> build_opts()
    |> build_rotating_opts(opts[:rotating_options])
    |> Map.delete(:secret_key_base)
  end

  @impl true
  def get(conn, raw_cookie, opts) do
    Logger.info("222")
    opts = Map.put(opts, :secret_key_base, conn.secret_key_base)

    [opts | opts.rotating_options]
    |> Enum.find_value(:error, &read_raw_cookie(raw_cookie, &1))
    |> decode(opts.serializer, opts.log)
    |> check_in_redis(raw_cookie)
  end

  @impl true
  def put(conn, _sid, term, opts) do
    Logger.info("333")
    %{serializer: serializer, key_opts: key_opts, signing_salt: signing_salt} = opts
    binary = encode(term, serializer)

    opts
    |> case do
      %{encryption_salt: nil} ->
        MessageVerifier.sign(binary, derive(conn.secret_key_base, signing_salt, key_opts))

      %{encryption_salt: encryption_salt} ->
        MessageEncryptor.encrypt(
          binary,
          derive(conn.secret_key_base, encryption_salt, key_opts),
          derive(conn.secret_key_base, signing_salt, key_opts)
        )
    end
    |> store_to_redis()
  end

  @impl true
  def delete(_conn, sid, _opts) do
    Logger.info("444")
    remove_from_redis(sid)
    :ok
  end

  defp encode(term, :external_term_format) do
    Logger.info("555")
    :erlang.term_to_binary(term)
  end

  defp encode(term, serializer) do
    Logger.info("666")
    {:ok, binary} = serializer.encode(term)
    binary
  end

  defp decode({:ok, binary}, :external_term_format, log) do
    Logger.info("777")
    {:term,
     try do
       Crypto.non_executable_binary_to_term(binary)
     rescue
       e ->
         Logger.log(
           log,
           "Plug.Session could not decode incoming session cookie. Reason: " <>
             Exception.message(e)
         )

         %{}
     end}
  end

  defp decode({:ok, binary}, serializer, _log) do
    Logger.info("888")
    case serializer.decode(binary) do
      {:ok, term} -> {:custom, term}
      _ -> {:custom, %{}}
    end
  end

  defp decode(:error, _serializer, false) do
    Logger.info("999")
    {nil, %{}}
  end

  defp decode(:error, _serializer, log) do
    Logger.info("aaa")
    Logger.log(
      log,
      "Plug.Session could not verify incoming session cookie. " <>
        "This may happen when the session settings change or a stale cookie is sent."
    )

    {nil, %{}}
  end

  defp prederive(secret_key_base, value, key_opts)
       when is_binary(secret_key_base) and is_binary(value) do
        Logger.info("bbb")
    {:prederived, derive(secret_key_base, value, Keyword.delete(key_opts, :cache))}
  end

  defp prederive(_secret_key_base, value, _key_opts) do
    Logger.info("ccc")
    value
  end

  defp derive(_secret_key_base, {:prederived, value}, _key_opts) do
    Logger.info("ddd")
    value
  end

  defp derive(secret_key_base, {module, function, args}, key_opts) do
    Logger.info("eee")
    derive(secret_key_base, apply(module, function, args), key_opts)
  end

  defp derive(secret_key_base, key, key_opts) do
    Logger.info("fff")
    secret_key_base
    |> validate_secret_key_base()
    |> KeyGenerator.generate(key, key_opts)
  end

  defp validate_secret_key_base(nil),
    do: raise(ArgumentError, "cookie store expects conn.secret_key_base to be set")

  defp validate_secret_key_base(secret_key_base) when byte_size(secret_key_base) < 64,
    do: raise(ArgumentError, "cookie store expects conn.secret_key_base to be at least 64 bytes")

  defp validate_secret_key_base(secret_key_base), do: secret_key_base

  defp check_signing_salt(opts) do
    Logger.info("ggg")
    case opts[:signing_salt] do
      nil -> raise ArgumentError, "cookie store expects :signing_salt as option"
      salt -> salt
    end
  end

  defp check_serializer(serializer) when is_atom(serializer), do: serializer

  defp check_serializer(_),
    do: raise(ArgumentError, "cookie store expects :serializer option to be a module")

  defp read_raw_cookie(raw_cookie, opts) do
    Logger.info("hhh")
    signing_salt = derive(opts.secret_key_base, opts.signing_salt, opts.key_opts)

    opts
    |> case do
      %{encryption_salt: nil} ->
        MessageVerifier.verify(raw_cookie, signing_salt)

      %{encryption_salt: _} ->
        encryption_salt = derive(opts.secret_key_base, opts.encryption_salt, opts.key_opts)

        MessageEncryptor.decrypt(raw_cookie, encryption_salt, signing_salt)
    end
    |> case do
      :error -> nil
      result -> result
    end
  end

  defp build_opts(opts) do
    Logger.info("iii")
    encryption_salt = opts[:encryption_salt]
    signing_salt = check_signing_salt(opts)

    iterations = Keyword.get(opts, :key_iterations, 1000)
    length = Keyword.get(opts, :key_length, 32)
    digest = Keyword.get(opts, :key_digest, :sha256)
    log = Keyword.get(opts, :log, :debug)
    secret_key_base = Keyword.get(opts, :secret_key_base)
    key_opts = [iterations: iterations, length: length, digest: digest, cache: Plug.Keys]

    serializer = check_serializer(opts[:serializer] || :external_term_format)

    %{
      secret_key_base: secret_key_base,
      encryption_salt: prederive(secret_key_base, encryption_salt, key_opts),
      signing_salt: prederive(secret_key_base, signing_salt, key_opts),
      key_opts: key_opts,
      serializer: serializer,
      log: log
    }
  end

  defp build_rotating_opts(opts, rotating_opts) when is_list(rotating_opts) do
    Logger.info("jjj")
    Map.put(opts, :rotating_options, Enum.map(rotating_opts, &build_opts/1))
  end

  defp build_rotating_opts(opts, _), do: Map.put(opts, :rotating_options, [])

  defp store_to_redis(cookie) do
    Logger.info("kkk")
    Redix.command(:redix, ["SET", hash(cookie), 1])

    cookie
  end

  defp remove_from_redis(sid) do
    Logger.info("lll")
    Redix.command(:redix, ["DEL", sid])
  end

  defp check_in_redis({sid, map}, _cookie) when is_nil(sid) or map == %{}, do: {nil, %{}}

  defp check_in_redis({_sid, session}, cookie) do
    hash = hash(cookie)
    Logger.info("mmm")
    case Redix.command(:redix, ["GET", hash]) do
      {:ok, one} when one in [1, "1"] ->
        {hash, session}

      _ ->
        {nil, %{}}
    end
  end

  defp hash(cookie) do
    Logger.info("nnn")
    :sha256
    |> :crypto.hash(cookie)
    |> Base.encode16()
  end
end
