const UUID_RE = require('../util/uuid-re')
const head = require('./partials/head')
const header = require('./partials/header')
const internalError = require('./internal-error')
const methodNotAllowed = require('./method-not-allowed')
const nav = require('./partials/nav')
const record = require('../storage/record')
const seeOther = require('./see-other')

module.exports = function (request, response) {
  if (request.method !== 'GET') return methodNotAllowed(request, response)

  var token = request.query.token
  if (!UUID_RE.test(token)) return invalidToken(request, response)

  record({ type: 'useToken', token }, (error, tokenData) => {
    if (error) return internalError(request, response, error)
    if (!tokenData) return invalidToken(request, response)
    var action = tokenData.action
    if (action !== 'confirm' && action !== 'email') {
      response.statusCode = 400
      return response.end()
    }
    var handle = tokenData.handle
    if (action === 'confirm') {
      record({ type: 'confirmAccount', handle }, (error) => {
        if (error) return internalError(request, response, error)
        seeOther(request, response, '/login')
      })
    }
    if (action === 'email') {
      var email = tokenData.email
      record({ type: 'changeEMail', handle, email }, (error) => {
        if (error) return internalError(request, response, error)
        response.setHeader('Content-Type', 'text/html')
        response.end(`
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
        `.trim())
      })
    }
  })
}

function invalidToken (request, response) {
  response.statusCode = 400
  response.setHeader('Content-Type', 'text/html')
  return response.end(`
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
  `.trim())
}
