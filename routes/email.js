var Busboy = require('busboy')
var EMAIL_RE = require('../util/email-re')
var authenticate = require('./authenticate')
var eMailInput = require('./partials/email-input')
var escape = require('../util/escape')
var head = require('./partials/head')
var header = require('./partials/header')
var mail = require('../mail')
var nav = require('./partials/nav')
var runSeries = require('run-series')
var storage = require('../storage')

module.exports = function (request, response) {
  var method = request.method
  var isGET = method === 'GET'
  var isPOST = method === 'POST'
  if (isGET || isPOST) {
    return authenticate(request, response, () => {
      if (!request.session) {
        response.statusCode = 401
        return response.end()
      }
      if (isPOST) return post(request, response)
      return get(request, response)
    })
  }
  response.statusCode = 405
  response.end()
}

function get (request, response) {
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
      <h2>Change E-Mail</h2>
      ${messageParagraph}
      <form action=email method=post>
        ${eMailInput({ autofocus: true })}
        <button type=submit>Change E-Mail</button>
      </form>
    </main>
  </body>
</html>
  `.trim())
}

function post (request, response) {
  var handle = request.account.handle
  var newEMail
  runSeries([
    readPostBody,
    validateInputs,
    sendConfirmationLink
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
    <h2>Change E-Mail</h2>
    <p class=message>E-Mail changed.</p>
  </body>
</html>
    `.trim())
  })

  function readPostBody (done) {
    request.pipe(
      new Busboy({
        headers: request.headers,
        limits: {
          fieldNameSize: 5,
          fieldSize: 64,
          fields: 1,
          parts: 1
        }
      })
        .on('field', function (name, value, truncated, encoding, mime) {
          if (name === 'email') newEMail = value.trim().toLowerCase()
        })
        .once('finish', done)
    )
  }

  function validateInputs (done) {
    var error
    if (!EMAIL_RE.test(newEMail)) {
      error = new Error('invalid e-mail address')
      error.fieldName = 'email'
      error.statusCode = 400
      return done(error)
    }
    done()
  }

  function sendConfirmationLink (done) {
    var properties = { handle, email: newEMail }
    storage.token.generate('email', properties, (error, success, token) => {
      if (error) return done(error)
      if (!success) return done(new Error('token collision'))
      request.log.info({ token }, 'e-mail change token')
      // TODO: Flesh out confirmation-link e-mail text.
      mail({
        to: newEMail,
        subject: 'Confirm Your E-Mail Change',
        text: `${process.env.BASE_HREF}/confirm?token=${token}`
      }, done)
    })
  }
}
