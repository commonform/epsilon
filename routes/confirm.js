const UUID_RE = require('../util/uuid-re')
const head = require('./partials/head')
const header = require('./partials/header')
const html = require('./html')
const internalError = require('./internal-error')
const methodNotAllowed = require('./method-not-allowed')
const nav = require('./partials/nav')
const seeOther = require('./see-other')
const storage = require('../storage')

module.exports = function (request, response) {
  if (request.method !== 'GET') return methodNotAllowed(request, response)

  const token = request.query.token
  if (!UUID_RE.test(token)) return invalidToken(request, response)

  storage.token.read(token, (error, tokenData) => {
    if (error) return internalError(request, response, error)
    if (!tokenData) return invalidToken(request, response)
    request.record({ type: 'useToken', token }, error => {
      if (error) return internalError(request, response, error)
      if (!tokenData) return invalidToken(request, response)
      const action = tokenData.action
      if (action !== 'confirm' && action !== 'email') {
        response.statusCode = 400
        return response.end()
      }
      const handle = tokenData.handle
      if (action === 'confirm') {
        request.record({ type: 'confirmAccount', handle }, error => {
          if (error) return internalError(request, response, error)
          seeOther(request, response, '/login')
        })
      }
      if (action === 'email') {
        const email = tokenData.email
        request.record({ type: 'changeEMail', handle, email }, error => {
          if (error) return internalError(request, response, error)
          response.setHeader('Content-Type', 'text/html')
          response.end(html`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    ${nav(request.session)}
    <main role=main>
      <h2>E-Mail Change</h2>
      <p class=message>The e-mail address for your account was successfully changed.</p>
    </main>
  </body>
</html>
          `)
        })
      }
    })
  })
}

function invalidToken (request, response) {
  response.statusCode = 400
  response.setHeader('Content-Type', 'text/html')
  return response.end(html`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    <main role=main>
      <h2>Confirmation</h2>
      <p class=message>The link you followed is invalid or expired.</p>
    </main>
  </body>
</html>
  `)
}
