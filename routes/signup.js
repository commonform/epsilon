const Busboy = require('busboy')
const EMAIL_RE = require('../util/email-re')
const eMailInput = require('./partials/email-input')
const escape = require('../util/escape')
const handleValidator = require('../validators/handle')
const hashPassword = require('../util/hash-password')
const head = require('./partials/head')
const header = require('./partials/header')
const html = require('./html')
const internalError = require('./internal-error')
const mail = require('../mail')
const methodNotAllowed = require('./method-not-allowed')
const passwordInputs = require('./partials/password-inputs')
const passwordValidator = require('../validators/password')
const runSeries = require('run-series')
const storage = require('../storage')
const uuid = require('uuid')

module.exports = function (request, response) {
  const method = request.method
  if (method === 'GET') return get(request, response)
  if (method === 'POST') return post(request, response)
  methodNotAllowed(request, response)
}

function get (request, response, data) {
  data = data || {}
  const error = data.error
  if (error) response.statusCode = 400
  response.setHeader('Content-Type', 'text/html')
  response.end(html`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    <main role=main>
      <h2>Sign Up</h2>
      ${signUpForm(data)}
    </main>
  </body>
</html>
  `)
}

function post (request, response) {
  let email, handle, password, repeat
  runSeries([
    readPostBody,
    validateInputs,
    checkForExistingAccount,
    recordAccount,
    generateConfirmToken,
    sendAdminEMail
  ], function (error) {
    if (error) {
      if (error.statusCode === 400) {
        return get(request, response, {
          email, handle, password, repeat, error
        })
      } else {
        return internalError(request, response, error)
      }
    }
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
  })

  function readPostBody (done) {
    request.pipe(
      new Busboy({
        headers: request.headers,
        limits: {
          fieldNameSize: 8,
          fieldSize: 128,
          fields: 4,
          parts: 1
        }
      })
        .on('field', function (fieldName, value, truncated, encoding, mime) {
          if (fieldName === 'email') email = value.toLowerCase()
          else if (fieldName === 'handle') handle = value.toLowerCase()
          else if (fieldName === 'password') password = value
          else if (fieldName === 'repeat') repeat = value
        })
        .once('finish', done)
    )
  }

  function validateInputs (done) {
    let error
    if (!EMAIL_RE.test(email)) {
      error = new Error('invalid e-mail address')
      error.fieldName = 'email'
      return done(error)
    }
    if (!handle || !handleValidator.valid(handle)) {
      error = new Error('Invalid handle.')
      error.fieldName = 'handle'
      return done(error)
    }
    if (password !== repeat) {
      error = new Error('passwords did not match')
      error.fieldName = 'repeat'
      return done(error)
    }
    if (!passwordValidator.valid(password)) {
      error = new Error('invalid password')
      error.fieldName = 'password'
      return done(error)
    }
    done()
  }

  function checkForExistingAccount (done) {
    storage.account.read(handle, function (error, account) {
      if (error) return done(error)
      if (account) {
        const handleTaken = new Error(
          `The handle “${handle}” is already taken.`
        )
        handleTaken.statusCode = 400
        return done(handleTaken)
      }
      return done()
    })
  }

  function recordAccount (done) {
    hashPassword(password, (error, passwordHash) => {
      if (error) return done(error)
      request.record({
        type: 'account',
        handle,
        email,
        created: new Date().toISOString(),
        passwordHash
      }, done)
    })
  }

  function generateConfirmToken (done) {
    const token = uuid.v4()
    request.record({
      type: 'confirmAccountToken',
      token,
      created: new Date().toISOString(),
      handle
    }, error => {
      if (error) return done(error)
      // TODO: Flesh out confirmation-link e-mail text.
      mail({
        to: email,
        subject: 'Confirm Your Account',
        text: `${process.env.BASE_HREF}/confirm?token=${token}`
      }, done)
    })
  }

  function sendAdminEMail (done) {
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
}

function signUpForm (data) {
  data = data || {}
  const error = data.error
  const errorMessage = error ? `<p class=error>${escape(error.message)}</p>` : ''
  return html`
<form method=post>
  ${errorMessage}
  ${eMailInput({ autofocus: true, value: data.email })}
  <p>
    <label for=handle>Handle</label>
    <input
        name=handle
        type=text
        pattern="${handleValidator.pattern}"
        value="${value('handle')}"
        autofocus
        required>
  </p>
  <p>${handleValidator.html}</p>
  ${passwordInputs()}
  <button type=submit>Join</button>
</form>
  `

  function value (fieldName) {
    return data[fieldName] || ''
  }
}
