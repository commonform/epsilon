const authenticate = require('./authenticate')
const escape = require('../util/escape')
const found = require('./found')
const head = require('./partials/head')
const header = require('./partials/header')
const html = require('./html')
const methodNotAllowed = require('./method-not-allowed')
const nav = require('./partials/nav')

module.exports = (request, response) => {
  if (request.method !== 'GET') return methodNotAllowed(request, response)
  authenticate(request, response, () => {
    const account = request.account
    if (!account) return found(request, response, '/signin')
    response.setHeader('Content-Type', 'text/html')
    response.end(html`
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
      <a class=button href=/password>Change Password</a>
      <a class=button href=/email>Change E-Mail</a>
    </main>
  </body>
</html>
    `)
  })
}
