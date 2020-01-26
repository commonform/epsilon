const escape = require('../util/escape')
const formRoute = require('./form-route')
const head = require('./partials/head')
const header = require('./partials/header')
const html = require('./html')
const indexes = require('../indexes')
const passwordResetNotification = require('../notifications/password-reset')
const uuid = require('uuid')
const validHandle = require('../validators/handle')

const fields = {
  handle: {
    validate: validHandle.valid
  }
}

function form (request, data) {
  return html`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    <main role=main>
      <h2>Reset Password</h2>
      <form id=resetForm method=post>
        ${data.error}
        <p>
          <label for=handle>Handle</label>
          <input
              name=handle
              value="${escape(data.handle.value)}"
              type=text
              pattern="${escape(validHandle.pattern)}"
              required
              autofocus
              autocomplete=off>
        </p>
        ${data.handle.error}
        <button type=submit>Send E-Mail</button>
      </form>
    </main>
  </body>
</html>
  `
}

function processBody (request, body, done) {
  const handle = body.handle
  indexes.account.read(handle, (error, account) => {
    if (error) return done(error)
    if (!account) {
      const invalid = new Error('invalid handle')
      invalid.statusCode = 400
      return done(invalid)
    }
    const token = uuid.v4()
    request.record({
      type: 'resetPasswordToken',
      token,
      created: new Date().toISOString(),
      handle
    }, error => {
      if (error) return done(error)
      const url = `${process.env.BASE_HREF}/password?token=${token}`
      passwordResetNotification({
        to: account.email,
        handle,
        url
      }, done)
    })
  })
}

function onSuccess (request, response) {
  response.setHeader('Content-Type', 'text/html')
  response.end(html`
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
  `)
}

module.exports = formRoute({ form, fields, processBody, onSuccess })
