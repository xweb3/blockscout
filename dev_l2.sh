unset MIX_ENV
# export MIX_ENV=prod

export COIN=ETH
export COIN_NAME=ETH
export PORT=4003
export CHAIN_ID=901
export JSON_RPC=http://localhost:8545

export LOGO=/images/m/logo-text.svg
export LOGO_FOOTER=/images/m/logo-text.svg
# export LOGO_TEXT=Morphism

export SECRET_KEY_BASE=7wXwEW2vUys65/aJ5NReuScrKQR7NQVpZbXpS79MEEHaTPSFE4xToZa4OAAuETaI

# export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=postgres_morphism
export POSTGRES_DB=blockscout
export DATABASE_URL=postgresql://postgres:postgres_morphism@localhost:5432/blockscout?ssl=false
# docker attach
# psql postgresql://postgres:postgres@localhost:5432/blockscout?ssl=false
export DOCKER_REPO_CONFIG=blockscout
export APP_NAME_CONFIG=explorer_l2
export ETHEREUM_JSONRPC_VARIANT=geth
export ETHEREUM_JSONRPC_HTTP_URL=http://localhost:8545
export ETHEREUM_JSONRPC_TRACE_URL=http://localhost:8545
export ETHEREUM_JSONRPC_WS_URL=ws://localhost:8546
# http://10.11.56.77:8545 
# http://localhost:8545


export POOL_SIZE=10
export POOL_SIZE_API=10

# export DISABLE_EXCHANGE_RATES=true
# export ENABLE_TXS_STATS=true

export INDEXER_DISABLE_PENDING_TRANSACTIONS_FETCHER=true
export INDEXER_DISABLE_BLOCK_REWARD_FETCHER=true
export INDEXER_DISABLE_EMPTY_BLOCK_SANITIZER=true
# export INDEXER_DISABLE_INTERNAL_TRANSACTIONS_FETCHER=true

# export DISABLE_EXCHANGE_RATES=true
# export FETCH_REWARDS_WAY=manual
# export INDEXER_CATCHUP_BLOCKS_CONCURRENCY=5
# export INDEXER_HIDE_INDEXING_PROGRESS_ALERT=true

# export RE_CAPTCHA_SECRET_KEY=
# export RE_CAPTCHA_CLIENT_KEY=
export RE_CAPTCHA_DISABLED=true


export MICROSERVICE_SC_VERIFIER_ENABLED=true
export MICROSERVICE_SC_VERIFIER_URL=http://localhost:8150

export PERMANENT_DARK_MODE_ENABLED=true

# Header
export INDEXER_HIDE_INDEXING_PROGRESS_ALERT=true
export SHOW_TESTNET_LABEL=false
export TESTNET_LABEL_TEXT=Devnet
export LINK_TO_OTHER_EXPLORERS=false
export OTHER_EXPLORERS={}
export SUPPORTED_CHAINS=[{"title":"mainnet","url":"https://explorer.morphism.xyz"},{"title":"devnet","url":"https://explorer.testnet.morphism.xyz"},{"title":"devnet","url":"https://explorer.testnet.morphism.xyz","dev_net?":true}] 
export NETWORK=Morphism
export SUBNETWORK=Devnet

# export API_V2_ENABLED=true
# export API_V1_READ_METHODS_DISABLED="false"
# export API_V1_WRITE_METHODS_DISABLED="false"
# export DISABLE_WEBAPP=false

# Footer
export BLOCKSCOUT_VERSION=v5.1.4-beta
export FOOTER_SUB_TITILE="Morphism Labs"
export FOOTER_GITHUB_LINK=https://github.com/morphism-labs
export FOOTER_TWITTER_LINK=https://twitter.com/Morphism_EN
# export FOOTER_CHAT_LINK=https://discord.com/invite/morphism-labs

# export FOOTER_TELEGRAM_LINK_ENABLED=true
# export FOOTER_TELEGRAM_LINK=https://telegram.org/morphism-labs
# export FOOTER_OTHER_EXPLORERS=false


unset SOURCIFY_INTEGRATION_ENABLED
# export SOURCIFY_INTEGRATION_ENABLED=true

mix do deps.get, local.rebar --force, deps.compile;

mix phx.digest.clean;

# docker run -p 8150:8050 ghcr.io/blockscout/smart-contract-verifier:latest

mix compile;
#  ecto.drop,
mix do ecto.drop, ecto.create, ecto.migrate;

cd apps/block_scout_web/assets; npm install && node_modules/webpack/bin/webpack.js --mode development; cd -;

cd apps/explorer && npm install; cd -;

mix phx.digest;

cd apps/block_scout_web; mix phx.gen.cert blockscout blockscout.local; cd -;

mix phx.server
