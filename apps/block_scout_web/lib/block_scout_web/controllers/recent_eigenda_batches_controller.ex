defmodule BlockScoutWeb.RecentEigendaBatchesController do
  use BlockScoutWeb, :controller
  require Logger

  alias Explorer.{Chain, PagingOptions}
  alias Phoenix.View


  def index(conn, _params) do
    if ajax?(conn) do
      recent_eigenda_batches =
        Chain.recent_collated_eigenda_batches(
          paging_options: %PagingOptions{page_size: 6}
        )

      eigenda_batches =
        Enum.map(recent_eigenda_batches, fn eigenda_batch ->

          %{
            eigenda_batches_html:
              View.render_to_string(BlockScoutWeb.EigendaBatchView, "_recent_tile.html",
                eigenda_batch: eigenda_batch,
                conn: conn,
              )
          }
        end)
        Logger.info("#{inspect(eigenda_batches)}")
      json(conn, %{eigenda_batches: eigenda_batches})
    else
      unprocessable_entity(conn)
    end
  end
end
