import { isDarkMode } from './lib/dark_mode'

function applyDarkMode () {
  if (isDarkMode()) {
    document.body.className += ' ' + 'dark-theme-applied'
    document.body.style.backgroundColor = '#1c1d31'
  }
  setTimeout(() => {
    if (window && window.location && window.location.pathname === '/') {
      const ele = document.getElementById('navbar-container-bottom-line')
      if (ele) {
        ele.style.display = 'block'
      }
    }
  }, 10)
}
window.onload = applyDarkMode()

if (isDarkMode()) {
  if (document.getElementById('top-navbar')) {
    document.getElementById('top-navbar').style.backgroundColor = '#282945'
  }
  if (document.getElementById('navbar-logo')) {
    document.getElementById('navbar-logo').style.filter = 'brightness(0) invert(1)'
  }
  const modeChanger = document.getElementById('dark-mode-changer')
  if (modeChanger) {
    modeChanger.className += ' ' + 'dark-mode-changer--dark'
  }

  const search = document.getElementById('main-search-autocomplete')
  const searchMobile = document.getElementById('main-search-autocomplete-mobile')
  if (search && search.style) {
    search.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
    search.style.borderColor = 'rgba(255, 255, 255, 0.05)'
  }
  if (searchMobile && searchMobile.style) {
    searchMobile.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
    searchMobile.style.borderColor = 'rgba(255, 255, 255, 0.05)'
  }
}
