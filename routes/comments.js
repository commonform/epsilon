const Busboy = require('busboy')
const DIGEST_RE = require('../util/digest-re')
const UUID_RE = require('../util/uuid-re')
const authenticate = require('./authenticate')
const found = require('./found')
const internalError = require('./internal-error')
const methodNotAllowed = require('./method-not-allowed')
const runSeries = require('run-series')
const seeOther = require('./see-other')
const uuid = require('uuid')

module.exports = (request, response) => {
  if (request.method !== 'POST') return methodNotAllowed(request, response)
  authenticate(request, response, () => {
    post(request, response)
  })
}

function post (request, response) {
  if (!request.account) return found(request, response, '/login')
  const handle = request.account.handle
  const comment = { replyTo: [] }
  const fields = ['context', 'form', 'replyTo[]', 'text']
  let id
  runSeries([
    readPostBody,
    validate,
    record
  ], function (error) {
    if (error) {
      if (error.statusCode === 400) {
        // TODO: Show errors on form page.
        response.statusCode = 400
        return response.end()
      }
      return internalError(request, response, error)
    }
    seeOther(request, response, '/comments/' + id)
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
          if (name === 'replyTo[]') comment.replyTo.push(value)
          else if (fields.includes(name)) comment[name] = value
        })
        .once('finish', done)
    )
  }

  function validate (done) {
    let error
    if (!comment.context || !DIGEST_RE.test(comment.context)) {
      error = new Error('invalid context')
      error.statusCode = 400
      return done(error)
    }
    if (!comment.form || !DIGEST_RE.test(comment.form)) {
      error = new Error('invalid form')
      error.statusCode = 400
      return done(error)
    }
    if (!comment.replyTo.every(element => UUID_RE.test(element))) {
      error = new Error('invalid replyTo')
      error.statusCode = 400
      return done(error)
    }
    // TODO: comment text length limit
    if (!comment.text) {
      error = new Error('invalid text')
      error.statusCode = 400
      return done(error)
    }
    done()
  }

  function record (done) {
    id = uuid.v4()
    request.record({
      type: 'comment',
      context: comment.context,
      date: new Date().toISOString(),
      form: comment.form,
      handle,
      id,
      replyTo: comment.replyTo,
      text: comment.text
    }, done)
  }
}
