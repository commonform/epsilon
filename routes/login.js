var Busboy = require('busboy')
var clearCookie = require('./clear-cookie')
var escape = require('../util/escape')
var head = require('./partials/head')
var header = require('./partials/header')
var record = require('../storage/record')
var runSeries = require('run-series')
var seeOther = require('./see-other')
var setCookie = require('./set-cookie')
var verifyPassword = require('../util/verify-password')

module.exports = function (request, response) {
  var method = request.method
  if (method === 'GET') return get(request, response)
  if (method === 'POST') return post(request, response)
  response.statusCode = 405
  response.end()
}

function get (request, response, error) {
  clearCookie(response)
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
      <h2>Log In</h2>
      ${messageParagraph}
      <form action=/login method=post>
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
      <a href=/forgot>Forgot Handle</a>
      <a href=/reset>Reset Password</a>
    </main>
  </body>
</html>
  `.trim())
}

function post (request, response) {
  var handle, password, sessionID
  runSeries([
    readPostBody,
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

  function authenticate (done) {
    verifyPassword(handle, password, done)
  }

  function createSession (done) {
    record({ type: 'session', handle }, (error, id) => {
      if (error) return done(error)
      sessionID = id
      done()
    })
  }

  function issueCookie (done) {
    var expires = new Date(
      Date.now() + (30 * 24 * 60 * 60 * 1000) // thirty days
    )
    setCookie(response, sessionID, expires)
    done()
  }

  function redirect (done) {
    seeOther(request, response, '/')
    done()
  }
}
