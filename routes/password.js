var Busboy = require('busboy')
var UUID_RE = require('../util/uuid-re')
var authenticate = require('./authenticate')
var escapeHTML = require('escape-html')
var hashPassword = require('../util/hash-password')
var head = require('./partials/head')
var header = require('./partials/header')
var internalError = require('./internal-error')
var nav = require('./partials/nav')
var passwordCriteria = require('./password-criteria')
var passwordInputs = require('./partials/password-inputs')
var runSeries = require('run-series')
var storage = require('../storage')

module.exports = function (request, response) {
  var method = request.method
  if (method === 'GET') return get(request, response)
  if (method === 'POST') return post(request, response)
  response.statusCode = 405
  response.end()
}

function get (request, response) {
  authenticate(request, response, () => {
    if (request.query.token) return getWithToken(request, response)
    getAuthenticated(request, response)
  })
}

function getAuthenticated (request, response) {
  var handle = request.session && request.session.handle
  if (!handle) {
    response.statusCode = 401
    response.end()
    return
  }
  var message = request.query.message
  var messageParagraph = message
    ? `<p class=message>${escapeHTML(message)}</p>`
    : ''
  response.setHeader('Content-Type', 'text/html')
  response.end(`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    <main role=main>
      <h2>Change Password</h2>
      ${messageParagraph}
      <form action=password method=post>
        ${passwordInputs('New Password')}
        <button type=submit>Change Password</button>
      </form>
    </main>
  </body>
</html>
  `.trim())
}

function getWithToken (request, response) {
  var token = request.query.token
  if (!UUID_RE.test(token)) return invalidToken(request, response)
  storage.token.read(token, (error, record) => {
    if (error) return internalError(error)
    if (!record) return invalidToken(request, response)
    if (record.type !== 'reset') {
      response.statusCode = 400
      response.end()
      return
    }
    var message = request.query.message || error
    var messageParagraph = message
      ? `<p class=message>${escapeHTML(message)}</p>`
      : ''
    response.setHeader('Content-Type', 'text/html')
    response.end(`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    <main role=main>
      <h2>Change Password</h2>
      ${messageParagraph}
      <form action=password method=post>
        <input type=hidden name=token value="${token}">
        ${passwordInputs('New Password')}
        <button type=submit>Change Password</button>
      </form>
    </main>
  </body>
</html>
    `.trim())
  })
}

function invalidToken (request, response) {
  response.statusCode = 400
  return response.end(`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    <main role=main>
      <h2>Change Password</h2>
      <p class=message>The link you followed is invalid or expired.</p>
    </main>
  </body>
</html>
  `.trim())
}

function post (request, response) {
  var password, repeat, token
  runSeries([
    readPostBody,
    validateInputs,
    changePassword
  ], function (error) {
    if (error) {
      if (error.statusCode === 400) {
        response.statusCode = 400
        return get(request, response, error.message)
      }
      request.log.error(error)
      response.statusCode = error.statusCode || 500
      return response.end()
    }
    response.setHeader('Content-Type', 'text/html')
    response.end(`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    ${nav(request.session)}
    <h2>Change Password</h2>
    <p class=message>Password changed.</p>
  </body>
</html>
    `.trim())
  })

  function readPostBody (done) {
    request.pipe(
      new Busboy({
        headers: request.headers,
        limits: {
          fieldNameSize: 8,
          fieldSize: 64,
          fields: 3,
          parts: 1
        }
      })
        .on('field', function (name, value, truncated, encoding, mime) {
          if (name === 'password') password = value
          else if (name === 'repeat') repeat = value
          else if (name === 'token') token = value
        })
        .once('finish', done)
    )
  }

  function validateInputs (done) {
    var error
    if (token && !UUID_RE.test(token)) {
      error = new Error('invalid token')
      error.fieldName = 'token'
      return done(error)
    }
    if (password !== repeat) {
      error = new Error('passwords did not match')
      error.fieldName = 'repeat'
      return done(error)
    }
    if (!passwordCriteria.validate(password)) {
      error = new Error('invalid password')
      error.fieldName = 'password'
      return done(error)
    }
    done()
  }

  function changePassword (done) {
    if (token) {
      return storage.token.use(token, 'reset', (error, success, record) => {
        if (error) return done(error)
        if (!success) {
          var failed = new Error('invalid token')
          failed.statusCode = 401
          return done(failed)
        }
        var handle = record.handle
        hashPassword(password, (error, hash) => {
          if (error) return done(error)
          var properties = { passwordHash: hash }
          storage.account.update(handle, properties, (error, updated) => {
            if (error) return done(error)
            done()
          })
        })
      })
    }
    authenticate(request, response, () => {
      if (!request.session) {
        var unauthorized = new Error('unauthorized')
        unauthorized.statusCode = 401
        return done(unauthorized)
      }
      hashPassword(password, (error, hash) => {
        if (error) return done(error)
        var properties = { passwordHash: hash }
        var handle = request.session.handle
        storage.account.update(handle, properties, (error, updated) => {
          if (error) return done(error)
          done()
        })
      })
    })
  }
}
