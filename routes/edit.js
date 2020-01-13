var Busboy = require('busboy')
var authenticate = require('./authenticate')
var commonmark = require('commonform-commonmark')
var found = require('./found')
var has = require('has')
var head = require('./partials/head')
var header = require('./partials/header')
var methodNotAllowed = require('./method-not-allowed')
var nav = require('./partials/nav')
var normalize = require('commonform-normalize')
var runParallelLimit = require('run-parallel-limit')
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
    if (isGET) return get(request, response)
    post(request, response)
  })
}

function get (request, response) {
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
      <form action=edit method=post>
        <textarea id=editor name=markup></textarea>
        <button type=submit>Save</button>
      </form>
    </main>
  </body>
</html>
  `.trim())
}

function post (request, response) {
  var markup, parsed, normalized
  runSeries([
    readPostBody,
    parseMarkup,
    saveForms
  ], function (error) {
    if (error) {
      if (error.statusCode === 401) {
        response.statusCode = 401
        return get(request, response, error.message)
      }
      request.log.error(error)
      response.statusCode = error.statusCode || 500
      response.end()
    }
    seeOther(request, response, '/forms/' + normalized.root)
  })

  function readPostBody (done) {
    request.pipe(
      new Busboy({
        headers: request.headers,
        limits: {
          fieldNameSize: 6,
          fieldSize: 128,
          fields: 1,
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

  function saveForms (done) {
    var forms = {}
    recurse(parsed.form, normalized.root, normalized)
    function recurse (form, digest, normalized) {
      forms[digest] = form
      form.content.forEach((element, index) => {
        if (has(element, 'form')) {
          var child = element.form
          var childDigest = normalized[digest].content[index].digest
          recurse(child, childDigest, normalized)
        }
      })
    }
    var tasks = Object.keys(forms).map((digest) => {
      return (done) => {
        var form = forms[digest]
        storage.form.create(digest, form, (error, success) => {
          if (error) return done(error)
          if (!success) return done(new Error('form collision'))
          done()
        })
      }
    })
    runParallelLimit(tasks, 3, done)
  }
}
