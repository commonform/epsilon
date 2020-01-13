var Busboy = require('busboy')
var EMAIL_RE = require('../util/email-re')
var eMailInput = require('./partials/email-input')
var escape = require('../util/escape')
var handleValidator = require('../validators/handle')
var hashPassword = require('../util/hash-password')
var head = require('./partials/head')
var header = require('./partials/header')
var internalError = require('./internal-error')
var mail = require('../mail')
var methodNotAllowed = require('./method-not-allowed')
var passwordValidator = require('../validators/password')
var passwordInputs = require('./partials/password-inputs')
var runSeries = require('run-series')
var storage = require('../storage')

module.exports = function (request, response) {
  var method = request.method
  if (method === 'GET') return get(request, response)
  if (method === 'POST') return post(request, response)
  methodNotAllowed(request, response)
}

function get (request, response, data) {
  data = data || {}
  var error = data.error
  if (error) response.statusCode = 400
  response.setHeader('Content-Type', 'text/html')
  response.end(`
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
  `.trim())
}

function post (request, response) {
  var email, handle, password, repeat
  runSeries([
    readPostBody,
    validateInputs,
    checkForExistingAccount,
    createAccount,
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
    response.end(`
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
    `.trim())
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
    var error
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
        var handleTaken = new Error(
          `The handle “${handle}” is already taken.`
        )
        handleTaken.statusCode = 400
        return done(handleTaken)
      }
      return done()
    })
  }

  function createAccount (done) {
    hashPassword(password, (error, hash) => {
      if (error) return done(error)
      var account = {
        handle,
        email,
        passwordHash: hash,
        created: new Date().toISOString(),
        confirmed: false
      }
      runSeries([
        (done) => { storage.account.write(handle, account, done) },
        (done) => { storage.email.append(email, handle, done) }
      ], done)
    })
  }

  function generateConfirmToken (done) {
    storage.token.generate('confirm', { handle }, (error, success, token) => {
      if (error) return done(error)
      if (!success) return done(new Error('token collision'))
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
    }, (error) => {
      if (error) request.log.error(error)
      done()
    })
  }
}

function signUpForm (data) {
  data = data || {}
  var error = data.error
  var errorMessage = error ? `<p class=error>${escape(error.message)}</p>` : ''
  return `
    <form action=signup method=post>
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
  `.trim()

  function value (fieldName) {
    return data[fieldName] || ''
  }
}
