const Busboy = require('busboy')
const clearCookie = require('./clear-cookie')
const escape = require('../util/escape')
const head = require('./partials/head')
const header = require('./partials/header')
const html = require('./html')
const runSeries = require('run-series')
const seeOther = require('./see-other')
const setCookie = require('./set-cookie')
const uuid = require('uuid')
const verifyPassword = require('../util/verify-password')

module.exports = function (request, response) {
  const method = request.method
  if (method === 'GET') return get(request, response)
  if (method === 'POST') return post(request, response)
  response.statusCode = 405
  response.end()
}

function get (request, response, error) {
  clearCookie(response)
  const message = request.query.message || error
  const messageParagraph = message
    ? `<p class=message>${escape(message)}</p>`
    : ''
  response.setHeader('Content-Type', 'text/html')
  response.end(html`
<!doctype html>
<html lang=en-US>
  ${head()}
    ${header()}
    <main role=main>
      <h2>Log In</h2>
      ${messageParagraph}
      <form method=post>
        <p>
          <label for=handle>Handle</label>
          <input name=handle type=text required autofocus>
        </p>
        <p>
          <label for=password>Password</label>
          <input name=password type=password required>
        </p>
        <button type=submit>Log In</button>
      </form>
      <a href=/handle>Forgot Handle</a>
      <a href=/reset>Reset Password</a>
    </main>
  </body>
</html>
  `)
}

function post (request, response) {
  let handle, password, sessionID
  runSeries([
    readPostBody,
    validateInputs,
    authenticate,
    createSession,
    issueCookie,
    redirect
  ], function (error) {
    if (error) {
      if (error.statusCode === 401) {
        response.statusCode = 401
        return get(request, response, error.message)
      }
      request.log.error(error)
      response.statusCode = error.statusCode || 500
      response.end()
    }
  })

  function readPostBody (done) {
    request.pipe(
      new Busboy({
        headers: request.headers,
        limits: {
          fieldNameSize: 8,
          fieldSize: 128,
          fields: 2,
          parts: 1
        }
      })
        .on('field', function (name, value, truncated, encoding, mime) {
          if (name === 'handle') handle = value.toLowerCase()
          else if (name === 'password') password = value
        })
        .once('finish', done)
    )
  }

  function validateInputs (done) {
    let error
    if (!password) {
      error = new Error('missing password')
      error.fieldName = 'password'
      return done(error)
    }
    if (!handle) {
      error = new Error('missing handle')
      error.fieldName = 'handle'
      return done(error)
    }
    done()
  }

  function authenticate (done) {
    verifyPassword(handle, password, (error) => {
      if (error) return done(error)
      request.log.info('verified credentials')
      done()
    })
  }

  function createSession (done) {
    sessionID = uuid.v4()
    request.record({ type: 'session', handle, id: sessionID }, error => {
      if (error) return done(error)
      request.log.info({ id: sessionID }, 'recorded session')
      done()
    })
  }

  function issueCookie (done) {
    const expires = new Date(
      Date.now() + (30 * 24 * 60 * 60 * 1000) // thirty days
    )
    setCookie(response, sessionID, expires)
    request.log.info({ expires }, 'set cookie')
    done()
  }

  function redirect (done) {
    seeOther(request, response, '/')
    done()
  }
}
