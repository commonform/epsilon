const Busboy = require('busboy')
const EMAIL_RE = require('../util/email-re')
const authenticate = require('./authenticate')
const confirmEMailNotification = require('../notifications/confirm-email')
const eMailInput = require('./partials/email-input')
const escape = require('../util/escape')
const head = require('./partials/head')
const header = require('./partials/header')
const html = require('./html')
const nav = require('./partials/nav')
const runSeries = require('run-series')
const uuid = require('uuid')

module.exports = function (request, response) {
  const method = request.method
  const isGET = method === 'GET'
  const isPOST = method === 'POST'
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
  const handle = request.session && request.session.handle
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
    ${nav(request.session)}
    <main role=main>
      <h2>Change E-Mail</h2>
      ${messageParagraph}
      <form method=post>
        ${eMailInput({ autofocus: true })}
        <button type=submit>Change E-Mail</button>
      </form>
    </main>
  </body>
</html>
  `)
}

function post (request, response) {
  const handle = request.account.handle
  let newEMail
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
    response.end(html`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    ${nav(request.session)}
    <main role=main>
      <h2>Change E-Mail</h2>
      <p class=message>E-Mail changed.</p>
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
    let error
    if (!EMAIL_RE.test(newEMail)) {
      error = new Error('invalid e-mail address')
      error.fieldName = 'email'
      error.statusCode = 400
      return done(error)
    }
    done()
  }

  function sendConfirmationLink (done) {
    const token = uuid.v4()
    request.record({
      type: 'changeEMailToken',
      token,
      created: new Date().toISOString(),
      handle,
      email: newEMail
    }, error => {
      if (error) return done(error)
      request.log.info({ token }, 'e-mail change token')
      confirmEMailNotification({
        to: newEMail,
        url: `${process.env.BASE_HREF}/confirm?token=${token}`
      }, done)
    })
  }
}
