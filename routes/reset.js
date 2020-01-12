var Busboy = require('busboy')
var escape = require('../util/escape')
var head = require('./partials/head')
var header = require('./partials/header')
var mail = require('../mail')
var runSeries = require('run-series')
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
      <h2>Reset Password</h2>
      ${messageParagraph}
      <form action=reset method=post>
        <p>
          <label for=handle>Handle</label>
          <input name=handle type=text required autofocus autocomplete=off>
        </p>
        <button type=submit>Send E-Mail</button>
      </form>
    </main>
  </body>
</html>
  `.trim())
}

function post (request, response) {
  var handle
  runSeries([
    readPostBody,
    sendResetLink
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
    <main role=main>
      <h2>Reset Password</h2>
      <p class=message>An e-mail has been sent.</p>
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
          fieldNameSize: 6,
          fieldSize: 64,
          fields: 1,
          parts: 1
        }
      })
        .on('field', function (name, value, truncated, encoding, mime) {
          if (name === 'handle') handle = value.toLowerCase()
        })
        .once('finish', done)
    )
  }

  function sendResetLink (done) {
    storage.account.read(handle, (error, account) => {
      if (error) return done(error)
      if (!account) {
        var invalid = new Error('invalid handle')
        invalid.statusCode = 400
        return done(invalid)
      }
      var tokenID = uuid.v4()
      var token = { type: 'reset', handle }
      storage.token.write(tokenID, token, (error, token) => {
        if (error) return done(error)
        var href = `${process.env.BASE_HREF}/password?token=${tokenID}`
        // TODO: Flesh out password-reset e-mail text.
        mail({
          to: account.email,
          subject: 'Reset Your Password',
          text: href
        }, done)
      })
    })
  }
}
