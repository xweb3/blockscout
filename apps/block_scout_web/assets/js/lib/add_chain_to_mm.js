import 'bootstrap'
import { commonPath } from './path_helper'

export async function addChainToMM({ btn }) {
  //const chainIDFromWallet = await window.ethereum.request({ method: 'eth_chainId' })
  const chainIDFromInstance = getChainIdHex()

  const p = {
    method: 'wallet_switchEthereumChain',
    params: [{
      chainId: chainIDFromInstance
    }]
  };

  const coinNameObj = document.getElementById('js-coin-name')
  // @ts-ignore
  const coinName = coinNameObj && coinNameObj.value
  const subNetworkObj = document.getElementById('js-subnetwork')
  // @ts-ignore
  const subNetwork = subNetworkObj && subNetworkObj.value
  const jsonRPCObj = document.getElementById('js-json-rpc')
  // @ts-ignore
  const jsonRPC = jsonRPCObj && jsonRPCObj.value
  const res = await window.ethereum.request(p).catch(async e => {
    console.error('switch chain failed:', e)
    if (e && e.code === 4902) {
      const blockscoutURL = location.protocol + '//' + location.host + commonPath
      const params = {
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: chainIDFromInstance,
          chainName: subNetwork,
          nativeCurrency: {
            name: coinName,
            symbol: coinName,
            decimals: 18
          },
          rpcUrls: [jsonRPC],
          blockExplorerUrls: [blockscoutURL]
        }]
      };
      console.log(params);
      await window.ethereum.request(params).catch(e => {
        console.error('add chain failed:', e)
        btn.tooltip('dispose')
        btn.tooltip({
          title: `add custom chain failed, ${e.message}`,
          trigger: 'click',
          placement: 'bottom'
        }).tooltip('show')

        setTimeout(() => {
          btn.tooltip('dispose')
        }, 3000)
      })
    }
  })
  if (res === null) {
    btn.tooltip('dispose')
    btn.tooltip({
      title: `You're already connected to ${subNetwork}`,
      trigger: 'click',
      placement: 'bottom'
    }).tooltip('show')

    setTimeout(() => {
      btn.tooltip('dispose')
    }, 3000)
  }
}

function getChainIdHex() {
  const chainIDObj = document.getElementById('js-chain-id')
  // @ts-ignore
  const chainIDFromDOM = chainIDObj && chainIDObj.value
  const chainIDFromInstance = parseInt(chainIDFromDOM)
  return chainIDFromInstance && `0x${chainIDFromInstance.toString(16)}`
}