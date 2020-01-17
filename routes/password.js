const Busboy = require('busboy')
const UUID_RE = require('../util/uuid-re')
const authenticate = require('./authenticate')
const escape = require('../util/escape')
const head = require('./partials/head')
const header = require('./partials/header')
const internalError = require('./internal-error')
const mail = require('../mail')
const nav = require('./partials/nav')
const passwordInputs = require('./partials/password-inputs')
const passwordValidator = require('../validators/password')
const record = require('../storage/record')
const runSeries = require('run-series')
const storage = require('../storage')
const verifyPassword = require('../util/verify-password')

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
    ? `<p class=message>${escape(message)}</p>`
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
        <p>
          <label for=old>Old Password</label>
          <input name=old type=password required autofocus autocomplete=off>
        </p>
        ${passwordInputs({ label: 'New Password' })}
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
  storage.token.read(token, (error, tokenData) => {
    if (error) return internalError(request, response, error)
    if (!tokenData) return invalidToken(request, response)
    if (tokenData.action !== 'reset') {
      response.statusCode = 400
      response.end()
      return
    }
    var message = request.query.message || error
    var messageParagraph = message
      ? `<p class=message>${escape(message)}</p>`
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
        ${passwordInputs({ label: 'New Password', autofocus: true })}
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
  response.setHeader('Content-Type', 'text/html')
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
  var password, repeat, token, email, oldPassword
  runSeries([
    readPostBody,
    validateInputs,
    checkOldPassword,
    changePassword,
    sendEMail
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
    <main role=main>
      <h2>Change Password</h2>
      <p class=message>Password changed.</p>
    </main>
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
          fields: 4,
          parts: 1
        }
      })
        .on('field', function (name, value, truncated, encoding, mime) {
          if (name === 'password') password = value
          else if (name === 'repeat') repeat = value
          else if (name === 'token') token = value
          else if (name === 'old') oldPassword = value
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
    if (!passwordValidator.valid(password)) {
      error = new Error('invalid password')
      error.fieldName = 'password'
      return done(error)
    }
    done()
  }

  function checkOldPassword (done) {
    if (token) return done()
    authenticate(request, response, () => {
      if (!request.account) {
        var unauthorized = new Error('unauthorized')
        unauthorized.statusCode = 401
        return done(unauthorized)
      }
      var handle = request.account.handle
      verifyPassword(handle, oldPassword, (error) => {
        if (error) {
          var invalidOldPassword = new Error('invalid password')
          invalidOldPassword.statusCode = 400
          return done(invalidOldPassword)
        }
        return done()
      })
    })
  }

  function changePassword (done) {
    if (token) {
      return record({ type: 'useToken', token }, (error, tokenData) => {
        if (error) return done(error)
        if (!tokenData || tokenData.action !== 'reset') {
          var failed = new Error('invalid token')
          failed.statusCode = 401
          return done(failed)
        }
        var handle = tokenData.handle
        record({
          type: 'changePassword',
          handle,
          password
        }, (error, updated) => {
          if (error) return done(error)
          email = updated.email
          done()
        })
      })
    }
    email = request.account.email
    record({
      type: 'changePassword',
      handle: request.account.handle,
      password
    }, done)
  }

  function sendEMail (done) {
    // TODO: Improve password-change notification e-mails.
    mail({
      to: email,
      subject: 'Password Change',
      text: 'The password for your account was changed.'
    }, (error) => {
      // Log and eat errors.
      if (error) request.log.error(error)
      done()
    })
  }
}
