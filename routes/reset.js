const Busboy = require('busboy')
const escape = require('../util/escape')
const head = require('./partials/head')
const header = require('./partials/header')
const mail = require('../mail')
const record = require('../storage/record')
const runSeries = require('run-series')
const storage = require('../storage')
const uuid = require('uuid')

module.exports = function (request, response) {
  const method = request.method
  if (method === 'GET') return get(request, response)
  if (method === 'POST') return post(request, response)
  response.statusCode = 405
  response.end()
}

function get (request, response, error) {
  const message = request.query.message || error
  const messageParagraph = message
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
        const invalid = new Error('invalid handle')
        invalid.statusCode = 400
        return done(invalid)
      }
      const token = uuid.v4()
      record({
        type: 'resetPasswordToken',
        token,
        created: new Date().toISOString(),
        handle
      }, (error) => {
        if (error) return done(error)
        const href = `${process.env.BASE_HREF}/password?token=${token}`
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
