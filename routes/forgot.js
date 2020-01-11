var Busboy = require('busboy')
var escapeHTML = require('escape-html')
var header = require('./partials/header')
var mail = require('../mail')
var runSeries = require('run-series')
var storage = require('../storage')

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
    ${header()}
    <main role=main>
      <h2>Forgot Handle</h2>
      ${messageParagraph}
      <form action=forgot method=post>
        <p>
          <label for=email>E-Mail</label>
          <input name=email type=email required autofocus autocomplete=off>
        </p>
        <button type=submit>Send Handle</button>
      </form>
    </main>
  </body>
</html>
  `.trim())
}

function post (request, response) {
  var email
  runSeries([
    readPostBody,
    sendEMail
  ], function (error) {
    if (error) {
      if (error.statusCode === 401) {
        response.statusCode = 401
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
  <head>
    <meta charset=UTF-8>
    <title>Common Form</title>
  </head>
  <body>
    ${header()}
    <main role=main>
      <h2>Forgot Handle</h2>
      <p class=message>If the e-mail you entered corresponds to an account, an e-mail was just sent to it.</p>
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
          if (name === 'email') email = value.toLowerCase()
        })
        .once('finish', done)
    )
  }

  function sendEMail (done) {
    storage.email.read(email, (error, handle) => {
      if (error) return done(error)
      if (handle === null) return done()
      storage.account.read(handle, function (error, account) {
        if (error) return done(error)
        if (account === null || !account.confirmed) return done()
        // TODO: Improve handle-reminder e-mails.
        mail({
          to: account.email,
          subject: 'Account Handle',
          text: handle
        }, done)
      })
    })
  }
}
