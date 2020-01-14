var Busboy = require('busboy')
var DIGEST_RE = require('../util/digest-re')
var authenticate = require('./authenticate')
var commonmark = require('commonform-commonmark')
var editionValidator = require('../validators/edition')
var escape = require('../util/escape')
var found = require('./found')
var has = require('has')
var head = require('./partials/head')
var header = require('./partials/header')
var internalError = require('./internal-error')
var methodNotAllowed = require('./method-not-allowed')
var nav = require('./partials/nav')
var normalize = require('commonform-normalize')
var projectValidator = require('../validators/project')
var runAuto = require('run-auto')
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
        <button id=submit type=submit>Save</button>
        <fieldset>
          <legend>Publication (optional)</legend>
          <label for=project>Project Name</label>
          <input
              name=project
              type=text>
          <p>${projectValidator.html}</p>
          <label for=edition>Edition</label>
          <input
              name=edition
              type=text>
          <p>${editionValidator.html}</p>
        </fieldset>
      </form>
    </main>
  </body>
</html>
    `.trim())
  })
}

function post (request, response) {
  var markup, project, edition
  var parsed, normalized
  runSeries([
    readPostBody,
    validateInputs,
    parseMarkup,
    saveForms,
    savePublication
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
          fieldSize: 128,
          fields: 3,
          parts: 1
        }
      })
        .on('field', function (name, value, truncated, encoding, mime) {
          if (name === 'markup') markup = value
          else if (name === 'project') project = value.toLowerCase().trim()
          else if (name === 'edition') edition = value.toLowerCase().trim()
        })
        .once('finish', done)
    )
  }

  function validateInputs (done) {
    if (project && !projectValidator.valid(project)) return done('invalid project name')
    if (edition && !editionValidator.valid(edition)) return done('invalid edition')
    if (project && !edition) return done('missing edition')
    if (edition && !project) return done('missing project name')
    done()
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

  function savePublication (done) {
    if (!project || !edition) return done()
    var record = {
      digest: normalized.root,
      date: new Date().toISOString()
    }
    storage.publication.create({
      publisher: request.account.handle, project, edition
    }, record, done)
  }
}
