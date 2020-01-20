const Busboy = require('busboy')
const escape = require('../util/escape')
const head = require('./partials/head')
const header = require('./partials/header')
const mail = require('../mail')
const runParallelLimit = require('run-parallel-limit')
const runSeries = require('run-series')
const storage = require('../storage')

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
      <h2>Forgot Handle</h2>
      ${messageParagraph}
      <form action=handles method=post>
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
  let email
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
  ${head()}
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
    storage.email.read(email, (error, handles) => {
      if (error) return done(error)
      if (handles.length === 0) return done()
      const tasks = handles.map((handle) => (done) => {
        storage.account.read(handle, (error, account) => {
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
      runParallelLimit(tasks, 3, done)
    })
  }
}
