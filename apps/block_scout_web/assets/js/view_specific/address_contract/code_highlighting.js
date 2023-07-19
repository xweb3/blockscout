import '../../lib/ace/src-min/ace'
import '../../lib/ace/src-min/mode-csharp'
import '../../lib/ace/src-min/theme-chrome'
import $ from 'jquery'

/* eslint-disable-next-line */
const Mode = ace.require('ace/mode/csharp').Mode

const codeMain = $('#code_viewer_main')
const code = codeMain.text()
/* eslint-disable-next-line */
const editor = codeMain.length > 0 && ace.edit('code_viewer_main')
if (editor) {
  editor.session.setMode(new Mode())
  editor.setTheme('ace/theme/chrome')
  editor.setValue(code, -1)
  editor.setOptions({
    readOnly: true,
    printMargin: false,
    wrapBehavioursEnabled: true,
    maxLines: 25,
    fontSize: 12,
    wrap: true
  })

  const $parent = $(editor.container).parents('.code-container')
  if ($('.btn-expand-code', $parent).length) {
    $('.btn-expand-code', $parent).on('click', (e) => {
      if ($(e.currentTarget).hasClass('expand')) {
        $(e.currentTarget).removeClass('expand')
        editor.setOptions({
          maxLines: 25
        })
      } else {
        $(e.currentTarget).addClass('expand')
        editor.setOptions({
          maxLines: Infinity
        })
      }
    })
  }

  const len = codeMain.data('additional-sources-length')
  for (let i = 0; i < len; i++) {
    const tag = 'code_viewer_' + i
    const code = $('#' + tag).text()
    /* eslint-disable-next-line */
    const editor = ace.edit(tag)
    editor.session.setMode(new Mode())
    editor.setTheme('ace/theme/chrome')
    editor.setValue(code, -1)
    editor.setOptions({ maxLines: 25, readOnly: true })

    const $parentAdditional = $(editor.container).parents('.code-container')
    if ($('.btn-expand-code', $parentAdditional).length) {
      $('.btn-expand-code', $parentAdditional).on('click', (e) => {
        if ($(e.currentTarget).hasClass('expand')) {
          $(e.currentTarget).removeClass('expand')
          editor.setOptions({
            maxLines: 25
          })
        } else {
          $(e.currentTarget).addClass('expand')
          editor.setOptions({
            maxLines: Infinity
          })
        }
      })
    }
  }
}
