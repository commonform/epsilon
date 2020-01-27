const Busboy = require('busboy')
const clearCookie = require('./clear-cookie')
const csrf = require('../util/csrf')
const methodNotAllowed = require('./method-not-allowed')

module.exports = function (request, response) {
  if (request.method !== 'POST') {
    return methodNotAllowed(request, response)
  }
  post(request, response)
}

function post (request, response) {
  const body = {}
  const fields = ['csrftoken', 'csrfnonce']
  request.pipe(
    new Busboy({
      headers: request.headers,
      limits: {
        fieldNameSize: Math.max(fields.map(n => n.length)),
        fields: 2,
        parts: 1
      }
    })
      .on('field', function (name, value, truncated, encoding, mime) {
        if (fields.includes(name)) body[name] = value
      })
      .once('finish', onceParsed)
  )

  function onceParsed () {
    csrf.verify({
      action: '/signout',
      sessionID: request.session.id,
      token: body.csrftoken,
      nonce: body.csrfnonce
    }, error => {
      if (error) return redirect()
      clearCookie(response)
      redirect()
    })
  }

  function redirect () {
    response.statusCode = 303
    response.setHeader('Location', '/')
    response.end()
  }
}
