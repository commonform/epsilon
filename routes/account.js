var authenticate = require('./authenticate')
var escape = require('../util/escape')
var found = require('./found')
var head = require('./partials/head')
var header = require('./partials/header')
var methodNotAllowed = require('./method-not-allowed')
var nav = require('./partials/nav')

module.exports = (request, response) => {
  if (request.method !== 'GET') return methodNotAllowed(request, response)
  authenticate(request, response, () => {
    var account = request.account
    if (!account) return found(request, response, '/login')
    response.end(`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    ${nav(request.session)}
    <main role=main>
      <h2>Account</h2>
      <table>
        <tr>
          <th>Handle</th>
          <td class=handle>${escape(account.handle)}</td>
        </tr>
        <tr>
          <th>E-Mail</th>
          <td class=email>${escape(account.email)}</td>
        </tr>
        <tr>
          <th>Joined</th>
          <td class=joined>${escape(new Date(account.created).toISOString())}</td>
        </tr>
      </table>
      <a href=/password>Change Password</a>
      <a href=/email>Change E-Mail</a>
    </main>
  </body>
</html>
    `.trim())
  })
}
