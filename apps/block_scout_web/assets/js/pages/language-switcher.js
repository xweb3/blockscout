import $ from 'jquery'
import Cookies from 'js-cookie'

$('.language-changer button').on('click', function () {
  const lang = $(this).data('lang')
  Cookies.set('locale', lang)
  // reload lang switch
  document.location.reload(true)
})

$(function () {
  const currentLang = Cookies.get('locale')
  const $activeLangEle = $(`.language-changer button[data-lang='${currentLang}']`)

  if ($activeLangEle.length) {
    $activeLangEle.addClass('active')
    $('#languageChangerDropdown span').html(currentLang.toUpperCase())
    $('html').attr('lang', currentLang)
  } else {
    $('.language-changer button[data-lang=en]').addClass('active')
  }
})
