var Busboy = require('busboy')
var DIGEST_RE = require('../util/digest-re')
var authenticate = require('./authenticate')
var commonmark = require('commonform-commonmark')
var escape = require('../util/escape')
var found = require('./found')
var head = require('./partials/head')
var header = require('./partials/header')
var internalError = require('./internal-error')
var methodNotAllowed = require('./method-not-allowed')
var nav = require('./partials/nav')
var normalize = require('commonform-normalize')
var record = require('../storage/record')
var runAuto = require('run-auto')
var runSeries = require('run-series')
var seeOther = require('./see-other')
var storage = require('../storage')

module.exports = (request, response) => {
  var method = request.method
  var isGET = method === 'GET'
  var isPOST = method === 'POST'
  if (!isGET && !isPOST) return methodNotAllowed(request, response)
  authenticate(request, response, () => {
    if (!request.account) return found(request, response, '/login')
    if (isGET) return get(request, response, request.query)
    post(request, response)
  })
}

function get (request, response, parameters) {
  var tasks = {}
  var digest = parameters.digest
  if (digest && DIGEST_RE.test(digest)) {
    tasks.form = (done) => storage.form.read(digest, done)
  }
  runAuto(tasks, (error, data) => {
    if (error) return internalError(request, response, error)
    var form = data.form || { content: ['edit text'] }
    var markup = parameters.markup || commonmark.stringify(form)
    var flash = parameters.flash
      ? `<p class=error>${escape(parameters.flash)}</p>`
      : ''
    response.setHeader('Content-Type', 'text/html')
    response.end(`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    ${nav(request.session)}
    <main role=main>
      <h2>Edit</h2>
      ${flash}
      <form action=edit method=post>
        <textarea id=editor name=markup>${escape(markup)}</textarea>
        <button type=submit>Save</button>
      </form>
    </main>
    <script src=/editor.bundle.js></script>
  </body>
</html>
    `.trim())
  })
}

function post (request, response) {
  var markup, parsed, normalized
  runSeries([
    readPostBody,
    parseMarkup,
    recordForm
  ], function (error) {
    if (error) {
      if (error.statusCode === 400) {
        response.statusCode = 400
        return get(request, response, {
          markup, flash: error.message
        })
      }
      return internalError(request, response, error)
    }
    seeOther(request, response, '/forms/' + normalized.root)
  })

  function readPostBody (done) {
    request.pipe(
      new Busboy({
        headers: request.headers,
        limits: {
          fieldNameSize: 7,
          fields: 3,
          parts: 1
        }
      })
        .on('field', function (name, value, truncated, encoding, mime) {
          if (name === 'markup') markup = value
        })
        .once('finish', done)
    )
  }

  function parseMarkup (done) {
    try {
      parsed = commonmark.parse(markup)
    } catch (error) {
      var invalidMarkup = new Error('invalid markup')
      invalidMarkup.statusCode = 400
      return done(invalidMarkup)
    }
    try {
      normalized = normalize(parsed.form)
    } catch (error) {
      return done(error)
    }
    return done()
  }

  function recordForm (done) {
    record({ type: 'form', form: parsed.form }, done)
  }
}
