const DIGEST_RE = require('../util/digest-re')
const commonmark = require('commonform-commonmark')
const formRoute = require('./form-route')
const head = require('./partials/head')
const header = require('./partials/header')
const html = require('./html')
const indexes = require('../indexes')
const nav = require('./partials/nav')
const normalize = require('commonform-normalize')
const runSeries = require('run-series')
const seeOther = require('./see-other')

const fields = {
  markup: {
    validate: (markup) => {
      try {
        commonmark.parse(markup)
      } catch (error) {
        return false
      }
      return true
    }
  }
}

module.exports = formRoute({
  action: '/edit',
  requireAuthentication: true,
  loadGETData,
  form,
  fields,
  processBody,
  onSuccess
})

const defaultForm = { content: ['edit text'] }

function loadGETData (request, data, callback) {
  const digest = request.query.digest
  if (digest && DIGEST_RE.test(digest)) {
    return indexes.form.read(digest, (error, form) => {
      if (error) return callback(error)
      data.markup = {
        value: commonmark.stringify(form || defaultForm)
      }
      callback()
    })
  }
  callback()
}

function form (request, data) {
  return html`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    ${nav(request)}
    <main role=main>
      <h2>Edit</h2>
      <form id=editForm method=post>
        ${data.error}
        ${data.csrf}
        <textarea id=editor name=markup>${data.markup.value}</textarea>
        ${data.markup.error}
        <button type=submit>Save</button>
      </form>
    </main>
    <script src=/editor.bundle.js></script>
  </body>
</html>
  `
}

function processBody (request, body, callback) {
  let parsed, normalized

  runSeries([
    parse,
    record
  ], error => {
    if (error) return callback(error)
    callback(null, normalized.root)
  })

  function parse (done) {
    try {
      parsed = commonmark.parse(body.markup)
    } catch (error) {
      const invalidMarkup = new Error('invalid markup')
      invalidMarkup.statusCode = 400
      invalidMarkup.fieldName = 'markup'
      return done(invalidMarkup)
    }
    try {
      normalized = normalize(parsed.form)
    } catch (error) {
      return done(error)
    }
    return done()
  }

  function record (done) {
    request.record({ type: 'form', form: parsed.form }, done)
  }
}

function onSuccess (request, response, body, digest) {
  seeOther(request, response, '/forms/' + digest)
}
