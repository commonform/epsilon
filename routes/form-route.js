const Busboy = require('busboy')
const escape = require('../util/escape')
const internalError = require('./internal-error')
const methodNotAllowed = require('./method-not-allowed')
const runSeries = require('run-series')

module.exports = options => {
  const {
    form,
    fields,
    processBody,
    onGet,
    onPost,
    onSuccess
  } = options

  if (typeof form !== 'function') {
    throw new TypeError('missing form function')
  }

  if (typeof processBody !== 'function') {
    throw new TypeError('missing processBody function')
  }

  if (typeof onSuccess !== 'function') {
    throw new TypeError('missing onSuccess function')
  }

  const fieldNames = Object.keys(fields)
  fieldNames.forEach(fieldName => {
    const description = fields[fieldName]
    if (typeof description.validate !== 'function') {
      throw new TypeError('missing validate function for ' + fieldName)
    }
    if (!description.display) {
      description.display = fieldName
    }
  })

  return (request, response) => {
    const method = request.method
    if (method === 'GET') return get(request, response)
    if (method === 'POST') return post(request, response)
    methodNotAllowed(request, response)
  }

  function get (request, response, body, error) {
    if (onGet) onGet(request, response)
    response.setHeader('Content-Type', 'text/html')
    const data = {}
    if (body) {
      fieldNames.forEach(fieldName => {
        data[fieldName] = {
          value: body[fieldName],
          error: error && error.fieldName === fieldName
            ? `<p class=error>${escape(error.message)}</p>`
            : ''
        }
      })
    } else {
      fieldNames.forEach(fieldName => {
        data[fieldName] = { value: '', error: false }
      })
    }
    if (error && !error.fieldName) {
      data.error = `<p class=error>${escape(error.message)}</p>`
    }
    response.end(form(data))
  }

  function post (request, response) {
    if (onPost) onPost(request, response)

    const body = {}
    runSeries([
      parse,
      validate,
      process
    ], error => {
      if (error) {
        const statusCode = error.statusCode
        if (statusCode >= 400 && statusCode < 500) {
          response.statusCode = statusCode
          return get(request, response, body, error)
        }
        return internalError(request, response, error)
      }
      onSuccess(request, response, body)
    })

    function parse (done) {
      request.pipe(
        new Busboy({
          headers: request.headers,
          limits: {
            fieldNameSize: Math.max(fieldNames.map(n => n.length)),
            fields: fieldNames.length,
            parts: 1
          }
        })
          .on('field', function (name, value, truncated, encoding, mime) {
            const description = fields[name]
            if (!description) return
            body[name] = description.filter
              ? description.filter(value)
              : value
          })
          .once('finish', done)
      )
    }

    function validate (done) {
      for (let index = 0; index < fieldNames.length; index++) {
        const fieldName = fieldNames[index]
        const description = fields[fieldName]
        const valid = description.validate(body[fieldName], body)
        if (valid) continue
        const error = new Error('invalid ' + description.displayName)
        error.statusCode = 401
        return done(error)
      }
      done()
    }

    function process (done) {
      processBody(request, body, done)
    }
  }
}
