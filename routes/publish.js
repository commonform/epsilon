const Busboy = require('busboy')
const DIGEST_RE = require('../util/digest-re')
const authenticate = require('./authenticate')
const editionValidator = require('../validators/edition')
const found = require('./found')
const internalError = require('./internal-error')
const methodNotAllowed = require('./method-not-allowed')
const projectValidator = require('../validators/project')
const record = require('../storage/record')
const runSeries = require('run-series')
const seeOther = require('./see-other')
const storage = require('../storage')

module.exports = (request, response) => {
  var method = request.method
  var isPOST = method === 'POST'
  if (!isPOST) return methodNotAllowed(request, response)
  authenticate(request, response, () => {
    if (!request.account) return found(request, response, '/login')
    post(request, response)
  })
}

function post (request, response) {
  var handle = request.account.handle
  var body = {}
  var fields = ['digest', 'project', 'edition']
  runSeries([
    readPostBody,
    validateInputs,
    verifyForm,
    recordPublication
  ], function (error) {
    if (error) {
      if (error.statusCode === 400) {
        // TODO: Show errors on form page.
        response.statusCode = 400
        return response.end()
      }
      return internalError(request, response, error)
    }
    var url = '/' + [handle, body.project, body.edition].join('/')
    seeOther(request, response, url)
  })

  function readPostBody (done) {
    request.pipe(
      new Busboy({
        headers: request.headers,
        limits: {
          fieldNameSize: Math.max(fields.map((x) => x.length)),
          fields: fields.length,
          parts: 1
        }
      })
        .on('field', function (name, value, truncated, encoding, mime) {
          if (fields.includes(name)) body[name] = value
        })
        .once('finish', done)
    )
  }

  function validateInputs (done) {
    var digest = body.digest
    var project = body.project
    var edition = body.edition
    if (!DIGEST_RE.test(digest)) return done('invalid digest')
    if (project && !projectValidator.valid(project)) return done('invalid project name')
    if (edition && !editionValidator.valid(edition)) return done('invalid edition')
    if (project && !edition) return done('missing edition')
    if (edition && !project) return done('missing project name')
    done()
  }

  function verifyForm (done) {
    storage.form.read(body.digest, (error, form) => {
      if (error) return done(error)
      if (!form) return done('unknown form')
      done()
    })
  }

  function recordPublication (done) {
    record({
      type: 'publication',
      publisher: handle,
      project: body.project,
      edition: body.edition,
      digest: body.digest
    }, done)
  }
}
