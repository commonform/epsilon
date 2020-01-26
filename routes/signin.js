const formRoute = require('./form-route')
const head = require('./partials/head')
const header = require('./partials/header')
const html = require('./html')
const indexes = require('../indexes')
const runSeries = require('run-series')
const seeOther = require('./see-other')
const setCookie = require('./set-cookie')
const uuid = require('uuid')
const verifyPassword = require('../util/verify-password')

const fields = {
  handle: {
    filter: (e) => e.toLowerCase().trim(),
    validate: x => x.length !== 0
  },
  password: {
    validate: x => x.length !== 0
  }
}

module.exports = formRoute({
  form,
  fields,
  processBody,
  onSuccess
})

function form (request, data) {
  return html`
<!doctype html>
<html lang=en-US>
  ${head()}
    ${header()}
    <main role=main>
      <h2>Log In</h2>
      <form id=signinForm method=post>
        ${data.error}
        <p>
          <label for=handle>Handle</label>
          <input name=handle type=text required autofocus>
        </p>
        ${data.handle.error}
        <p>
          <label for=password>Password</label>
          <input name=password type=password required>
        </p>
        ${data.password.error}
        <button type=submit>Log In</button>
      </form>
      <a href=/handle>Forgot Handle</a>
      <a href=/reset>Reset Password</a>
    </main>
  </body>
</html>
  `
}

function processBody (request, body, done) {
  const { handle, password } = body

  let sessionID
  runSeries([
    authenticate,
    createSession
  ], error => {
    if (error) return done(error)
    done(null, sessionID)
  })

  function authenticate (done) {
    verifyPassword(handle, password, (verifyError, account) => {
      if (verifyError) {
        const statusCode = verifyError.statusCode
        if (statusCode === 500) return done(verifyError)
        if (!account) return done(verifyError)
        request.log.info(verifyError, 'authentication error')
        const failures = account.failures + 1
        if (failures >= 5) {
          return request.record({
            type: 'lockAccount',
            handle
          }, recordError => {
            if (recordError) return done(recordError)
            done(verifyError)
          })
        }
        return indexes.account.update(
          handle, { failures },
          (updateError) => {
            if (updateError) return done(updateError)
            done(verifyError)
          }
        )
      }
      request.log.info('verified credentials')
      done()
    })
  }

  function createSession (done) {
    sessionID = uuid.v4()
    request.record({ type: 'session', handle, id: sessionID }, error => {
      if (error) return done(error)
      request.log.info({ id: sessionID }, 'recorded session')
      done()
    })
  }
}

function onSuccess (request, response, body, sessionID) {
  const expires = new Date(
    Date.now() + (30 * 24 * 60 * 60 * 1000) // thirty days
  )
  setCookie(response, sessionID, expires)
  request.log.info({ expires }, 'set cookie')
  seeOther(request, response, '/')
}
