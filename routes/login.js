var Busboy = require('busboy')
var clearCookie = require('./clear-cookie')
var escapeHTML = require('escape-html')
var passwordHashing = require('./password-hashing')
var runSeries = require('run-series')
var securePassword = require('secure-password')
var seeOther = require('./see-other')
var setCookie = require('./set-cookie')
var storage = require('../storage')
var uuid = require('uuid')

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
    ? `<p class=message>${escapeHTML(message)}</p>`
    : ''
  response.setHeader('Content-Type', 'text/html')
  response.end(`
<!doctype html>
<html lang=en-US>
  <head>
    <meta charset=UTF-8>
    <title>Common Form</title>
  </head>
  <body>
    <h1>Common Form</h1>
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
    <p>
      <a href=/forgot>Forgot Handle</a>
    </p>
  </body>
</html>
  `.trim())
}

function post (request, response) {
  var handle, password, account, sessionID
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
    storage.account.read(handle, function (error, read) {
      if (error) return done(error)
      account = read
      if (account === null || account.confirmed === false) {
        var invalid = new Error('invalid handle or password')
        invalid.statusCode = 401
        return done(invalid)
      }
      var passwordHash = Buffer.from(account.passwordHash, 'hex')
      var passwordBuffer = Buffer.from(password, 'utf8')
      passwordHashing.verify(
        passwordBuffer, passwordHash,
        function (error, result) {
          if (error) return done(error)
          switch (result) {
            case securePassword.INVALID_UNRECOGNIZED_HASH:
              var unrecognized = new Error(
                'securePassword.INVALID_UNRECOGNIZED_HASH'
              )
              return done(unrecognized)
            case securePassword.INVALID:
              var invalid = new Error('invalid password')
              invalid.statusCode = 403
              return done(invalid)
            case securePassword.VALID_NEEDS_REHASH:
              return passwordHashing.hash(passwordBuffer, function (error, newHash) {
                if (error) return done(error)
                account.passwordHash = newHash.toString('hex')
                storage.account.write(
                  handle, account, function (error) {
                    if (error) return done(error)
                    done()
                  }
                )
              })
            case securePassword.VALID: return done()
          }
        }
      )
    })
  }

  function createSession (done) {
    sessionID = uuid.v4()
    storage.session.write(sessionID, {
      handle,
      created: new Date().toISOString()
    }, done)
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
