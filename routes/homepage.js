const authenticate = require('./authenticate')
const escape = require('../util/escape')
const head = require('./partials/head')
const header = require('./partials/header')
const html = require('./html')
const methodNotAllowed = require('./method-not-allowed')
const nav = require('./partials/nav')

module.exports = (request, response) => {
  if (request.method !== 'GET') return methodNotAllowed(request, response)
  authenticate(request, response, () => {
    response.setHeader('Content-Type', 'text/html')
    response.end(html`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    ${nav(request.session)}
    <main role=main>
      ${welcome()}
    </main>
  </body>
</html>
    `)

    function welcome () {
      if (!request.session) return ''
      return `<p class=welcome>Welcome, ${escape(request.session.handle)}</p>`
    }
  })
}
