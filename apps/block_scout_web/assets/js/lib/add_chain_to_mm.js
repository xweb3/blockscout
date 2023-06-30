import 'bootstrap'
import $ from 'jquery'

export async function addChainToMM({ btn }) {
  //const chainIDFromWallet = await window.ethereum.request({ method: 'eth_chainId' })
  const chainIDFromInstance = getChainIdHex()

  const p = {
    method: 'wallet_switchEthereumChain',
    params: [{
      chainId: chainIDFromInstance
    }]
  };
    const coinName = document.getElementById('js-coin-name').value
    const subNetwork = document.getElementById('js-subnetwork').value
    const jsonRPC = document.getElementById('js-json-rpc').value
    const path = process.env.NETWORK_PATH || '/'
    const blockscoutURL = location.protocol + '//' + location.host + path

    const successTitle = $(btn).data('success')
    const failTitle = $(btn).data('fail')

  const res = await window.ethereum.request(p).catch(async e => {
    console.error('switch chain failed:', e)
    if (e && e.code === 4902) {
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
          title: `${failTitle} ${e.message}`,
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
      title: `${successTitle} ${subNetwork}`,
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