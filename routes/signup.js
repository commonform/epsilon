const EMAIL_RE = require('../util/email-re')
const confirmAccountNotification = require('../notifications/confirm-account')
const eMailInput = require('./partials/email-input')
const escape = require('../util/escape')
const formRoute = require('./form-route')
const handleValidator = require('../validators/handle')
const hashPassword = require('../util/hash-password')
const head = require('./partials/head')
const header = require('./partials/header')
const html = require('./html')
const mail = require('../mail')
const passwordInput = require('./partials/password-input')
const passwordRepeatInput = require('./partials/password-repeat-input')
const passwordValidator = require('../validators/password')
const runSeries = require('run-series')
const uuid = require('uuid')

const fields = {
  email: {
    filter: (e) => e.toLowerCase().trim(),
    validate: (e) => EMAIL_RE.test(e)
  },
  handle: {
    filter: (e) => e.toLowerCase().trim(),
    validate: handleValidator.valid
  },
  password: {
    validate: passwordValidator.valid
  },
  repeat: {
    validate: (value, body) => value === body.password
  }
}

module.exports = formRoute({ form, fields, processBody, onSuccess })

function processBody (request, body, done) {
  const { handle, email, password } = body
  runSeries([
    done => {
      hashPassword(password, (error, passwordHash) => {
        if (error) return done(error)
        request.record({
          type: 'account',
          handle,
          email,
          created: new Date().toISOString(),
          passwordHash
        }, error => {
          if (error) return done(error)
          request.log.info('recorded account')
          done()
        })
      })
    },
    done => {
      const token = uuid.v4()
      request.record({
        type: 'confirmAccountToken',
        token,
        created: new Date().toISOString(),
        handle
      }, error => {
        if (error) return done(error)
        request.log.info('recorded token')
        confirmAccountNotification({
          to: email,
          handle,
          url: `${process.env.BASE_HREF}/confirm?token=${token}`
        }, error => {
          if (error) return done(error)
          request.log.info('e-mailed token')
          done()
        })
      })
    },
    done => {
      if (!process.env.ADMIN_EMAIL) return done()
      mail({
        to: process.env.ADMIN_EMAIL,
        subject: 'Sign Up',
        text: `Handle: ${handle}\nE-Mail: ${email}\n`
      }, error => {
        if (error) request.log.error(error)
        done()
      })
    }
  ], done)
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
      <h2>Success</h2>
      <p class=message>Check your e-mail for a link to confirm your new account.</p>
    </main>
  </body>
</html>
  `)
}

function form (request, data) {
  return html`
<!doctype html>
<html lang=en-US>
  ${head()}
    ${header()}
    <main role=main>
      <h2>Sign Up</h2>
      <form id=signupForm method=post>
        ${data.error}
        ${eMailInput({ autofocus: true, value: data.email.value })}
        ${data.email.error}
        <p>
          <label for=handle>Handle</label>
          <input
              name=handle
              type=text
              pattern="${handleValidator.pattern}"
              value="${escape(data.handle.value)}"
              autofocus
              required>
        </p>
        ${data.handle.error}
        <p>${handleValidator.html}</p>
        ${passwordInput()}
        ${data.password.error}
        ${passwordRepeatInput()}
        ${data.repeat.error}
        <button type=submit>Join</button>
      </form>
    </main>
  </body>
</html>
  `
}
