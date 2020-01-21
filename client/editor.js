/* eslint-env browser */
const classnames = require('classnames')
const commonmark = require('commonform-commonmark')
const lint = require('commonform-lint')

document.addEventListener('DOMContentLoaded', function () {
  parseAndAnnotateOnEdit()
  setDirtyFlagOnEdit()
  clearDirtyFlagOnSubmit()
})

// Parse and lint the form on every change.
function parseAndAnnotateOnEdit () {
  const editor = document.getElementById('editor')

  // Insert a readout element for displaying lint annotations.
  const readout = document.createElement('ul')
  editor.parentNode.insertBefore(readout, editor.nextSibling)

  // Whenever the user makes a change, parse the markup
  // and display lint annotations.
  editor.addEventListener('input', function () {
    // Parse.
    try {
      var parsed = commonmark.parse(editor.value)
    } catch (error) {
      return invalid('Invalid Markup')
    }
    const form = parsed.form
    emptyReadout()

    // Lint.
    let foundError = false
    lint(form).forEach(function (annotation) {
      if (annotation.level === 'error') foundError = true
      append(annotation.message)
    })
    editor.className = classnames('editor', { warn: foundError })
  })

  function append (message) {
    const li = document.createElement('li')
    li.appendChild(document.createTextNode(message))
    readout.appendChild(li)
  }

  function emptyReadout () {
    readout.innerHTML = ''
  }

  function invalid (message) {
    editor.className = classnames('editor', 'error')
    emptyReadout()
    append(message)
  }
}

// If the user changes the content in the editor, mark it
// dirty, so we can warn on `beforeunload`.
let dirty = false

window.addEventListener('beforeunload', function (event) {
  if (dirty) event.returnValue = 'If you leave this page without saving, your work will be lost.'
})

function setDirtyFlagOnEdit () {
  const editors = ['editor', 'notes']
  editors.forEach(function (id) {
    const editor = document.getElementById(id)
    if (editor) editor.addEventListener('input', function () { dirty = true })
  })
}

function clearDirtyFlagOnSubmit () {
  const forms = document.getElementsByTagName('form')
  for (let index = 0; index < forms.length; index++) {
    const form = forms[index]
    form.addEventListener('submit', () => {
      dirty = false
    })
  }
}
