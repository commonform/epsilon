var Busboy = require('busboy')
var authenticate = require('./authenticate')
var commonmark = require('commonform-commonmark')
var found = require('./found')
var head = require('./partials/head')
var header = require('./partials/header')
var internalError = require('./internal-error')
var methodNotAllowed = require('./method-not-allowed')
var nav = require('./partials/nav')
var normalize = require('commonform-normalize')
var pump = require('pump')
var runAuto = require('run-auto')
var runParallelLimit = require('run-parallel-limit')
var runSeries = require('run-series')
var seeOther = require('./see-other')
var storage = require('../storage')

var DEFAULT_FORM = { content: ['Click to change text.'] }

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
  var digest = parameters.form
  var publisher = parameters.publisher
  var project = parameters.project
  var edition = parameters.edition
  var tasks = {}
  if (digest) {
    tasks.form = (done) => { storage.form.read(digest, done) }
  } else if (publisher && project && edition) {
    tasks.publication = (done) => {
      if (digest) return done(null, { digest })
      if (!publisher) return done()
      storage.edition.read({ publisher, project, edition }, done)
    }
    tasks.form = ['publication', (data, done) => {
      if (!data.publication) return done()
      storage.form.read(data.publication.digest, done)
    }]
  }
  runAuto(tasks, function (error, data) {
    if (error) return internalError(request, response, error)
    response.statusCode = parameters.statusCode || 200
    response.setHeader('Content-Type', 'text/html; charset=UTF-8')
    var form = data.form || DEFAULT_FORM
    var publication = data.publication
    var flash = parameters.flash ? `<p class=error>${escape(parameters.flash)}</p>` : ''
    var markup = parameters.markup || commonmark.stringify(form)
    var signaturePages
    if (parameters.signaturePages) signaturePages = parameters.signaturePages
    else if (publication && publication.signaturePages) signaturePages = publication.signaturePages
    else signaturePages = ''
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
        <textarea
            id=editor
            name=markup
            class=editor>${markup}</textarea>
        <p>
          Typing Reference:
          <a
            href=https://type.commonform.org
            target=_blank>type.commonform.org</a>
        </p>
        <fieldset>
          <legend>Publication (optional)</legend>
          <input
            name=project
            type=text
            placeholder="${(publication ? escape(publication.project) : 'Project Name') + ' (optional)'}">
          <input
            name=edition
            type=text
            placeholder="Edition (optional)">
          <p>
            <input
              name=title
              type=text
              placeholder="${(publication ? escape(publication.title) : 'Title') + ' (optional)'}">
          </p>
          <label for=notes>Release Notes</label>
          <textarea
              id=notes
              name=notes></textarea>
          <label for=signaturePages>Signature Pages (JSON)</label>
          <textarea
              id=signaturePages
              name=signaturePages>${signaturePages}</textarea>
        </fieldset>
        <fieldset>
          <legend>Notifications</legend>
          <label>
            <input
                name=subscribe
                type=checkbox
                checked>
            Subscribe
          </label>
        </fieldset>
        <p>
          <input type=submit value=Submit>
        </p>
      </form>
    </main>
    <script src=/editor.bundle.js></script>
  </body>
</html>
    `.trim())
  })
}

var fields = [
  'markup',
  'project',
  'edition',
  'title',
  'signaturePages',
  'notes',
  'subscribe'
]

function post (request, response) {
  var data = {}
  pump(
    request,
    new Busboy({
      headers: request.headers,
      limits: {
        fieldNameSize: Math.max(...fields.map((x) => x.length)),
        fields: fields.length,
        parts: 1
      }
    })
      .on('field', function (name, value) {
        if (value && fields.includes(name)) {
          data[name] = value.trim().replace(/\r\n/g, '\n')
        }
      })
      .once('finish', processRequest)
  )

  function processRequest () {
    try {
      var form = commonmark.parse(data.markup).form
    } catch (error) {
      return fail('invalid form markup')
    }
    try {
      var signaturePages = JSON.parse(
        data.signaturepages || 'null'
      )
    } catch (error) {
      return fail('invalid signature pages JSON')
    }

    var handle = request.account.handle
    var project = data.project
    var edition = data.edition
    var title = data.title
    var notes = data.notes
    var digest

    runSeries([
      save,
      subscribe,
      publish
    ], (error) => {
      if (error) return fail(error)
      seeOther(request, response, '/forms/' + digest)
    })

    function save (done) {
      var normalized = normalize(form)
      var toStore = recurseForm(
        form, normalized.root, normalized, [], []
      )
      storage.form.create(digest, form, (error, success) => {
        if (error) return done(error)
        if (!success) return done(new Error('form collision'))
        done()
      })
    }

    function subscribe (done) {
      if (!data.subscribe) return done()
      storage.formSubscriber.append(digest, handle, done)
    }

    function publish (done) {
      if (!project) return done()
      var body = { digest }
      if (notes) body.notes = notes.split(/(\r?\n){2}/)
      if (title) body.title = title.trim()
      if (signaturePages) body.signaturePages = signaturePages
      storage.publication.create({ handle, project, edition }, body, done)
    }

    function fail (error) {
      error = typeof error === 'string' ? error : error.toString()
      // TODO: Distinguish 401s and 500s.
      var parameters = Object.assign({
        statusCode: 400,
        flash: error
      }, data)
      get(request, response, parameters)
    }
  }
}
