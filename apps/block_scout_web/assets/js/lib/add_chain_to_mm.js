import 'bootstrap'
import $ from 'jquery'

export async function addChainToMM({ btn }) {
  try {
    const chainIDFromWallet = await window.ethereum.request({ method: 'eth_chainId' })
    const chainIDFromInstance = getChainIdHex()

    const coinName = document.getElementById('js-coin-name').value
    const subNetwork = document.getElementById('js-subnetwork').value
    const jsonRPC = document.getElementById('js-json-rpc').value
    const path = process.env.NETWORK_PATH || '/'

    const blockscoutURL = location.protocol + '//' + location.host + path
    const successTitle = $(btn).data('success')

    if (chainIDFromWallet !== chainIDFromInstance) {
      await window.ethereum.request({
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
      })
    } else {
      btn.tooltip('dispose')
      btn.tooltip({
        title: `${successTitle} ${subNetwork}`,
        trigger: 'click',
        placement: 'bottom'
      }).tooltip('show')

      setTimeout(() => {
        btn.tooltip('dispose')
      }, 3000)
    }
  } catch (e) {
    console.error('add chain failed:', e)
    const failTitle = $(btn).data('fail')
    btn.tooltip('dispose')
    btn.tooltip({
      title: `${failTitle} ${e.message}`,
      trigger: 'click',
      placement: 'bottom'
    }).tooltip('show')

    setTimeout(() => {
      btn.tooltip('dispose')
    }, 3000)
  }
}

function getChainIdHex() {
  const chainIDFromDOM = document.getElementById('js-chain-id').value
  const chainIDFromInstance = parseInt(chainIDFromDOM)
  return chainIDFromInstance && `0x${chainIDFromInstance.toString(16)}`
}