const EMAIL_RE = require('../util/email-re')
const confirmEMailNotification = require('../notifications/confirm-email')
const eMailInput = require('./partials/email-input')
const formRoute = require('./form-route')
const head = require('./partials/head')
const header = require('./partials/header')
const html = require('./html')
const indexes = require('../indexes')
const nav = require('./partials/nav')
const uuid = require('uuid')

const fields = {
  email: {
    filter: (e) => e.toLowerCase().trim(),
    validate: (e) => EMAIL_RE.test(e)
  }
}

module.exports = formRoute({
  action: '/email',
  requireAuthentication: true,
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
  <body>
    ${header()}
    ${nav(request)}
    <main role=main>
      <h2>Change E-Mail</h2>
      <form id=emailForm method=post>
        ${data.error}
        ${data.csrf}
        ${eMailInput({ autofocus: true })}
        ${data.email.error}
        <button type=submit>Change E-Mail</button>
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
    ${nav(request)}
    <main role=main>
      <h2>Change E-Mail</h2>
      <p class=message>Confirmation e-mail sent.</p>
    </main>
  </body>
</html>
  `)
}

function processBody (request, body, done) {
  const handle = request.account.handle
  const email = body.email
  indexes.email.read(email, (error, existingHandle) => {
    if (error) return done(error)
    if (existingHandle) {
      const error = new Error('e-mail already has an account')
      error.fieldName = 'email'
      error.statusCode = 400
      return done(error)
    }
    const token = uuid.v4()
    request.record({
      type: 'changeEMailToken',
      token,
      created: new Date().toISOString(),
      handle,
      email
    }, error => {
      if (error) return done(error)
      request.log.info({ token }, 'e-mail change token')
      confirmEMailNotification({
        to: email,
        url: `${process.env.BASE_HREF}/confirm?token=${token}`
      }, done)
    })
  })
}
