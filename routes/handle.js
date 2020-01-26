const EMAIL_RE = require('../util/email-re')
const formRoute = require('./form-route')
const handleNotification = require('../notifications/handle')
const head = require('./partials/head')
const header = require('./partials/header')
const html = require('./html')
const indexes = require('../indexes')

const fields = {
  email: {
    filter: (e) => e.toLowerCase().trim(),
    validate: (e) => EMAIL_RE.test(e)
  }
}

module.exports = formRoute({ form, fields, processBody, onSuccess })

function form (request, data) {
  return html`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    <main role=main>
      <h2>Forgot Handle</h2>
      <form id=handleForm method=post>
        ${data.error}
        <p>
          <label for=email>E-Mail</label>
          <input
              name=email
              type=email
              required
              autofocus
              autocomplete=off>
        </p>
        ${data.email.error}
        <button type=submit>Send Handle</button>
      </form>
    </main>
  </body>
</html>
  `
}

function onSuccess (request, response, body) {
  response.setHeader('Content-Type', 'text/html')
  response.end(html`
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
  `)
}

function processBody (request, body, done) {
  const email = body.email
  indexes.email.read(email, (error, handle) => {
    if (error) return done(error)
    if (!handle) return done()
    handleNotification({
      to: email,
      handle
    }, done)
  })
}
