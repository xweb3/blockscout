import $ from 'jquery'
import AutoComplete from '@tarekraafat/autocomplete.js/dist/autoComplete'
import { getTextAdData, fetchTextAdData } from './ad'
import { DateTime } from 'luxon'
import { appendTokenIcon } from './token_icon'
import { escapeHtml } from './utils'
import xss from 'xss'

// const placeHolder = 'Address/Txn Hash/Block/Token/DA Hash'

const pushData = (type, data, storage) => {
  if (storage[type]) {
    storage[type].push(data)
  } else {
    storage[type] = [data]
  }
}

const getLabel = (type)=> {
  switch (type) {
    case 'token':
      return 'TOKENS(ERC 20)'
    case 'nft':
      return 'NFTs(ERC 721&1155)'
    default:
      return type.toUpperCase()
  }
}

const getType = (data) => {
  if (data.type === 'token') {
    if (data.token_type === 'ERC-20') {
      return 'token'
    } else {
      return 'nft'
    }
  } else {
    return data.type
  }
}

let localResult = {}

const dataSrc = async (query, id) => {
  try {
    // Loading placeholder text
    const searchInput = document
      .getElementById(id)

    const placeholderLoading = $(searchInput).data('placholder-loading')
    const placeholderDefault = $(searchInput).data('placholder-default')

    searchInput.setAttribute('placeholder', placeholderLoading)

    // Fetch External Data Source
    const source = await fetch(
      `/token-autocomplete?q=${query}`
    )
    const data = await source.json()
    // Post Loading placeholder text
    // console.log('------', data)

    searchInput.setAttribute('placeholder', placeholderDefault)
    // Returns Fetched data
    localResult = {}
    for (let i = 0; i < data.length; i++) {
      if (data[i].type === 'token') {
        if (data[i].token_type === 'ERC-20') {
          pushData('token', data[i], localResult)
        } else {
          pushData('nft', data[i], localResult)
        }
      } else {
        pushData(data[i].type, data[i], localResult)
      }
    }
    let resultArray = []
    Object.keys(localResult).map(r => {
      resultArray = resultArray.concat(localResult[r])
    })
    return resultArray
  } catch (error) {
    return error
  }
}
const resultsListElement = (list, data) => {
  const $searchInput = $('#main-search-autocomplete')
  const labelResult = $searchInput.data('label-result')
  const labelNoResult = $searchInput.data('label-noresult')
  
  if (data.results.length > 0) {
    Object.keys(localResult).map(k => {
      // console.log('0-0-0--', k)
      const $firstItem = $(`.item[data-type='${k}']`, list).first().parent()
      const info = document.createElement('div')
      info.classList.add('result-counter')
      const adv = `
      <div class="ad mb-3" style="display: none;">
      <span class='ad-prefix'></span>: <img class="ad-img-url" width=20 height=20 /> <b><span class="ad-name"></span></b> - <span class="ad-short-description"></span> <a class="ad-url"><b><span class="ad-cta-button"></span></a></b>
      </div>`
      info.innerHTML = adv
      const label = getLabel(k)
      info.innerHTML += `<div class="counter-content" data-type="${k}"><p class="label">${label}</p> <p class="count">${labelResult.replace('%{number}', `<strong>${localResult[k].length}</strong>`)}</p></div>`

      $(info).insertBefore($firstItem)
    })

    const listHeader = document.createElement('div')
    listHeader.classList.add('result-header')
    const headerContent = `<div class="result-header-content">${Object.keys(localResult).map((k, i) => `<div data-target="${k}" class="list-toggle ${i === 0 ? 'active' : ''}">${getLabel(k)}</div>`).join('')}</div>`
    listHeader.innerHTML = headerContent
    list.prepend(listHeader)

    $('.list-toggle', list).on('click', function () {
      // if ($(this).hasClass('active')) return
      $('.list-toggle', list).removeClass('active')
      $(this).addClass('active')
      const target = $(this).data('target')
      const targetTopPosition = $(`.counter-content[data-type='${target}']`, list).parent().position().top + $(list).scrollTop() - $(list).offset().top
      $(list).animate({ scrollTop: targetTopPosition - 45 })
    })
  } else {
    const info = document.createElement('p')
    info.classList.add('result-counter', 'no-result')
    const adv = ` <div class="ad mb-3" style="display: none;">
    <span class='ad-prefix'></span>: <img class="ad-img-url" width=20 height=20 /> <b><span class="ad-name"></span></b> - <span class="ad-short-description"></span> <a class="ad-url"><b><span class="ad-cta-button"></span></a></b>
    </div>`
    info.innerHTML = adv
    if (data.query !== '###') {
      info.innerHTML += `${labelNoResult.replace('%{number}', `<strong>${data.matches.length}</strong> `)} <strong style="word-wrap:break-word;">"${data.query}"</strong>`
    }
    list.prepend(info)
  }

  fetchTextAdData()
}
export const searchEngine = (query, record) => {
  const queryLowerCase = query.toLowerCase()
  if (record && (
    (record.name && record.name.toLowerCase().includes(queryLowerCase)) ||
      (record.symbol && record.symbol.toLowerCase().includes(queryLowerCase)) ||
      (record.address_hash && record.address_hash.toLowerCase().includes(queryLowerCase)) ||
      (record.tx_hash && record.tx_hash.toLowerCase().includes(queryLowerCase)) ||
      (record.block_hash && record.block_hash.toLowerCase().includes(queryLowerCase)) ||
      (record.block_number && record.block_number === Number(queryLowerCase)) ||
      (record.tx_hash && record.type === 'eigenda')
  )
  ) {
    let searchResult = '<div>'
    searchResult += `<div>${record.address_hash || record.tx_hash || record.block_hash}</div>`

    if (record.type === 'label') {
      searchResult += `<div class="fontawesome-icon tag"></div><span> <b>${record.name}</b></span>`
    } else {
      searchResult += '<div>'
      if (record.name) {
        searchResult += `<b>${escapeHtml(record.name)}</b>`
      }
      if (record.symbol) {
        searchResult += ` (${escapeHtml(record.symbol)})`
      }
      if (record.holder_count) {
        searchResult += ` <i>${record.holder_count} holder(s)</i>`
      }
      if (record.inserted_at) {
        searchResult += ` (${DateTime.fromISO(record.inserted_at).toLocaleString(DateTime.DATETIME_SHORT)})`
      }
      searchResult += '</div>'
    }
    searchResult += '</div>'
    const re = new RegExp(query, 'ig')
    searchResult = searchResult.replace(re, '<mark class=\'autoComplete_highlight\'>$&</mark>')
    return searchResult
  }
}
function getContractVerifiedCls (data){
  let cls = '';
  if(!data.is_not_contract_address){
    cls = 'is_contract_address'
    if(data.is_verified){
      cls += ' contract_verified'
    }
  }
  
  return cls;
}

const resultItemElement = async (item, data) => {
  item.style = 'display: flex;'

  item.innerHTML = `
  <div data-type='${getType(data.value)}' class='item' id='token-icon-${data.value.address_hash}' style='margin-top: -1px;'></div>
  <div class="result-match" style="text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">
    ${data.match}
  </div>
  <div class="autocomplete-category">
    ${data.value.type}
  </div>
  <span class="hide-contract-address common-contract-address ${getContractVerifiedCls(data.value)}"></span>
  `

  const $tokenIconContainer = $(item).find(`#token-icon-${data.value.address_hash}`)
  const $searchInput = $('#main-search-autocomplete')
  const chainID = $searchInput.data('chain-id')
  // const displayTokenIcons = $searchInput.data('display-token-icons')
  appendTokenIcon($tokenIconContainer, chainID, data.value.address_hash, false, 24)
}
const config = (id) => {
  return {
    selector: `#${id}`,
    data: {
      src: (query) => dataSrc(query, id),
      cache: false
    },
    placeHolder: $(`#${id}`).data('placholder-default'),
    searchEngine: (query, record) => searchEngine(query, record),
    threshold: 2,
    resultsList: {
      element: (list, data) => resultsListElement(list, data),
      noResults: true,
      maxResults: 100,
      tabSelect: true
    },
    resultItem: {
      element: (item, data) => resultItemElement(item, data),
      highlight: 'autoComplete_highlight',
      class: 'item-wrapper'
    },
    query: (input) => {
      return xss(input)
    },
    debounce: 300,
    events: {
      input: {
        focus: () => {
          if (autoCompleteJS.input.value.length) autoCompleteJS.start()
        }
      }
    }
  }
}
const autoCompleteJS = document.querySelector('#main-search-autocomplete') && new AutoComplete(config('main-search-autocomplete'))
// eslint-disable-next-line
const autoCompleteJSMobile = document.querySelector('#main-search-autocomplete-mobile') && new AutoComplete(config('main-search-autocomplete-mobile'))

const selection = (event) => {
  const selectionValue = event.detail.selection.value

  if (selectionValue.type === 'contract' || selectionValue.type === 'address' || selectionValue.type === 'label') {
    window.location = `/address/${selectionValue.address_hash}`
  } else if (selectionValue.type === 'token') {
    window.location = `/tokens/${selectionValue.address_hash}`
  } else if (selectionValue.type === 'transaction') {
    window.location = `/tx/${selectionValue.tx_hash}`
  } else if (selectionValue.type === 'block') {
    window.location = `/blocks/${selectionValue.block_hash}`
  } else if (selectionValue.type === 'eigenda') {
    window.location = `/eigenda-batch/${selectionValue.tx_hash}`
  }
}

const openOnFocus = (event, type) => {
  const query = event.target.value
  if (query) {
    if (type === 'desktop') {
      autoCompleteJS.start(query)
    } else if (type === 'mobile') {
      autoCompleteJSMobile.start(query)
    }
  } else {
    getTextAdData()
      .then(({ data: adData, inHouse: _inHouse }) => {
        if (adData) {
          if (type === 'desktop') {
            autoCompleteJS.start('###')
          } else if (type === 'mobile') {
            autoCompleteJSMobile.start('###')
          }
        }
      })
  }
}

document.querySelector('#main-search-autocomplete') && document.querySelector('#main-search-autocomplete').addEventListener('selection', function (event) {
  selection(event)
})
document.querySelector('#main-search-autocomplete-mobile') && document.querySelector('#main-search-autocomplete-mobile').addEventListener('selection', function (event) {
  selection(event)
})

document.querySelector('#main-search-autocomplete') && document.querySelector('#main-search-autocomplete').addEventListener('focus', function (event) {
  openOnFocus(event, 'desktop')
})

document.querySelector('#main-search-autocomplete-mobile') && document.querySelector('#main-search-autocomplete-mobile').addEventListener('focus', function (event) {
  openOnFocus(event, 'mobile')
})
