var UUID_RE = require('../util/uuid-re')
var head = require('./partials/head')
var header = require('./partials/header')
var internalError = require('./internal-error')
var methodNotAllowed = require('./method-not-allowed')
var nav = require('./partials/nav')
var seeOther = require('./see-other')
var storage = require('../storage')

module.exports = function (request, response) {
  if (request.method !== 'GET') return methodNotAllowed(request, response)

  var token = request.query.token
  if (!UUID_RE.test(token)) return invalidToken(request, response)

  storage.token.use(token, (error, record) => {
    if (error) return internalError(request, response, error)
    var type = record.type
    if (!record) return invalidToken(request, response)
    if (type !== 'confirm' && type !== 'email') {
      response.statusCode = 400
      return response.end()
    }
    var handle = record.handle
    if (type === 'confirm') {
      storage.account.confirm(handle, (error) => {
        if (error) return internalError(request, response, error)
        seeOther(request, response, '/login')
      })
    }
    if (type === 'email') {
      var email = record.email
      storage.account.update(handle, { email }, (error) => {
        if (error) return internalError(error)
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
