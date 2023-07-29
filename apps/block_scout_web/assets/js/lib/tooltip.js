import $ from 'jquery'

export const hideUnvisibleTooltips = () => {
  if ($('.tooltip').length > 1) {
    $('.tooltip').each((_, el) => {
      const id = $(el).attr('id')
      if (!$(`[aria-describedby=${id}]`).length) {
        // console.log('will destroy')
        $(el).hide()
      }
    })
  }
}

$(function () {
  $('body').tooltip({ selector: '[data-toggle="tooltip"]' })

  $('body').on('show.bs.tooltip', function (e) {
    hideUnvisibleTooltips()
  })

  $('body').on('shown.bs.tooltip', function () {
    // console.log('inserted.bs.tooltip')
  })
  $('body').on('hide.bs.tooltip', function () {
    // console.log('hide.bs.tooltip')
  })
  $('body').on('hidden.bs.tooltip', function () {
    // console.log('hidden.bs.tooltip')
  })
  $('body').on('inserted.bs.tooltip', function () {
    hideUnvisibleTooltips()
  })

})
