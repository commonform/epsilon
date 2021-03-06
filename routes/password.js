const Busboy = require('busboy')
const UUID_RE = require('../util/uuid-re')
const csrf = require('../util/csrf')
const escape = require('../util/escape')
const hashPassword = require('../util/hash-password')
const head = require('./partials/head')
const header = require('./partials/header')
const html = require('./html')
const indexes = require('../indexes')
const internalError = require('./internal-error')
const nav = require('./partials/nav')
const passwordChangeNotification = require('../notifications/password-change')
const passwordInput = require('./partials/password-input')
const passwordRepeatInput = require('./partials/password-repeat-input')
const passwordValidator = require('../validators/password')
const runSeries = require('run-series')
const verifyPassword = require('../util/verify-password')

const action = '/password'

module.exports = function (request, response) {
  const method = request.method
  if (method === 'GET') return get(request, response)
  if (method === 'POST') return post(request, response)
  response.statusCode = 405
  response.end()
}

function get (request, response) {
  if (request.query.token) return getWithToken(request, response)
  getAuthenticated(request, response)
}

function getAuthenticated (request, response) {
  const handle = request.account && request.account.handle
  if (!handle) {
    response.statusCode = 401
    response.end()
    return
  }
  const message = request.query.message
  const messageParagraph = message
    ? `<p class=message>${escape(message)}</p>`
    : ''
  response.setHeader('Content-Type', 'text/html')
  response.end(html`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    ${nav(request)}
    <main role=main>
      <h2>Change Password</h2>
      ${messageParagraph}
      <form id=passwordForm method=post>
        ${csrf.inputs({ action, sessionID: request.session.id })}
        <p>
          <label for=old>Old Password</label>
          <input name=old type=password required autofocus autocomplete=off>
        </p>
        ${passwordInput({ label: 'New Password' })}
        ${passwordRepeatInput()}
        <button type=submit>Change Password</button>
      </form>
    </main>
  </body>
</html>
  `)
}

function getWithToken (request, response) {
  const token = request.query.token
  if (!UUID_RE.test(token)) return invalidToken(request, response)
  indexes.token.read(token, (error, tokenData) => {
    if (error) return internalError(request, response, error)
    if (!tokenData) return invalidToken(request, response)
    if (tokenData.action !== 'reset') {
      response.statusCode = 400
      response.end()
      return
    }
    const message = request.query.message || error
    const messageParagraph = message
      ? `<p class=message>${escape(message)}</p>`
      : ''
    response.setHeader('Content-Type', 'text/html')
    response.end(html`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    ${nav(request)}
    <main role=main>
      <h2>Change Password</h2>
      ${messageParagraph}
      <form id=passwordForm method=post>
        ${csrf.inputs({ action, sessionID: request.session.id })}
        <input type=hidden name=token value="${token}">
        ${passwordInput({ label: 'New Password', autofocus: true })}
        ${passwordRepeatInput()}
        <button type=submit>Change Password</button>
      </form>
    </main>
  </body>
</html>
    `)
  })
}

function invalidToken (request, response) {
  response.statusCode = 400
  response.setHeader('Content-Type', 'text/html')
  return response.end(html`
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
  `)
}

function post (request, response) {
  let handle
  const body = {}
  const fieldNames = [
    'password', 'repeat', 'token', 'old',
    'csrftoken', 'csrfnonce'
  ]
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
    response.end(html`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    ${nav(request)}
    <main role=main>
      <h2>Change Password</h2>
      <p class=message>Password changed.</p>
    </main>
  </body>
</html>
    `)
  })

  function readPostBody (done) {
    request.pipe(
      new Busboy({
        headers: request.headers,
        limits: {
          fieldNameSize: Math.max(fieldNames.map(x => x.length)),
          fields: fieldNames.length,
          parts: 1
        }
      })
        .on('field', function (name, value, truncated, encoding, mime) {
          if (fieldNames.includes(name)) body[name] = value
        })
        .once('finish', done)
    )
  }

  function validateInputs (done) {
    let error
    const token = body.token
    if (token && !UUID_RE.test(token)) {
      error = new Error('invalid token')
      error.fieldName = 'token'
      return done(error)
    }
    const password = body.password
    const repeat = body.repeat
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
    const old = body.old
    if (!token && !old) {
      error = new Error('missing old password')
      error.fieldName = 'old'
      return done(error)
    }
    csrf.verify({
      action: '/password',
      sessionID: request.session.id,
      token: body.csrftoken,
      nonce: body.csrfnonce
    }, done)
  }

  function checkOldPassword (done) {
    const token = body.token
    if (token) return done()
    if (!request.account) {
      const unauthorized = new Error('unauthorized')
      unauthorized.statusCode = 401
      return done(unauthorized)
    }
    handle = request.account.handle
    verifyPassword(handle, body.old, error => {
      if (error) {
        const invalidOldPassword = new Error('invalid password')
        invalidOldPassword.statusCode = 400
        return done(invalidOldPassword)
      }
      return done()
    })
  }

  function changePassword (done) {
    const token = body.token
    if (token) {
      return indexes.token.read(token, (error, tokenData) => {
        if (error) return done(error)
        if (!tokenData || tokenData.action !== 'reset') {
          const failed = new Error('invalid token')
          failed.statusCode = 401
          return done(failed)
        }
        request.record({ type: 'useToken', token }, error => {
          if (error) return done(error)
          handle = tokenData.handle
          recordChange()
        })
      })
    }

    recordChange()

    function recordChange () {
      hashPassword(body.password, (error, passwordHash) => {
        if (error) return done(error)
        request.record({
          type: 'changePassword',
          handle,
          passwordHash
        }, done)
      })
    }
  }

  function sendEMail (done) {
    indexes.account.read(handle, (error, account) => {
      if (error) return done(error)
      passwordChangeNotification({
        to: account.email,
        handle
      }, error => {
        // Log and eat errors.
        if (error) request.log.error(error)
        done()
      })
    })
  }
}
