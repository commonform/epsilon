const Busboy = require('busboy')
const DIGEST_RE = require('../util/digest-re')
const csrf = require('../util/csrf')
const found = require('./found')
const indexes = require('../indexes')
const internalError = require('./internal-error')
const methodNotAllowed = require('./method-not-allowed')
const projectValidator = require('../validators/project')
const runSeries = require('run-series')
const seeOther = require('./see-other')

module.exports = (request, response) => {
  const method = request.method
  const isPOST = method === 'POST'
  if (!isPOST) return methodNotAllowed(request, response)
  if (!request.account) return found(request, response, '/signin')
  post(request, response)
}

function post (request, response) {
  const handle = request.account.handle
  const body = {}
  const fields = ['form', 'draft']
    .concat('csrftoken', 'csrfnonce')
  runSeries([
    readPostBody,
    validateInputs,
    verifyForm,
    recordDraft
  ], function (error) {
    if (error) {
      if (error.statusCode === 400) {
        // TODO: Show errors on form page.
        response.statusCode = 400
        return response.end()
      }
      return internalError(request, response, error)
    }
    if (body.proofed) {
    }
    const url = `/${handle}/${body.draft}`
    return seeOther(request, response, url)
  })

  function readPostBody (done) {
    request.pipe(
      new Busboy({
        headers: request.headers,
        limits: {
          fieldNameSize: Math.max(fields.map(x => x.length)),
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
    const form = body.form
    const draft = body.draft
    if (!DIGEST_RE.test(form)) return done('invalid form digest')
    if (draft && !projectValidator.valid(draft)) return done('invalid draft name')
    csrf.verify({
      action: '/drafts',
      sessionID: request.session.id,
      token: body.csrftoken,
      nonce: body.csrfnonce
    }, done)
  }

  function verifyForm (done) {
    indexes.form.read(body.form, (error, read) => {
      if (error) return done(error)
      if (!read) return done('unknown form')
      done()
    })
  }

  function recordDraft (done) {
    request.record({
      type: 'draft',
      publisher: handle,
      draft: body.draft,
      form: body.form,
      date: new Date().toISOString()
    }, done)
  }
}
