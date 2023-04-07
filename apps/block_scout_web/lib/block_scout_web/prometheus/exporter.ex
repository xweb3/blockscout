defmodule BlockScoutWeb.Prometheus.Exporter do
  @moduledoc """
  Exports `Prometheus` metrics at `/metrics`
  """

  @dialyzer :no_match
  require Prometheus.PlugExporter
  use Prometheus.PlugExporter
end
