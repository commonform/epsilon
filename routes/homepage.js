var authenticate = require('./authenticate')
var escape = require('../util/escape')
var head = require('./partials/head')
var header = require('./partials/header')
var methodNotAllowed = require('./method-not-allowed')
var nav = require('./partials/nav')

module.exports = (request, response) => {
  if (request.method !== 'GET') return methodNotAllowed(request, response)
  authenticate(request, response, () => {
    response.setHeader('Content-Type', 'text/html')
    response.end(`
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
    `.trim())

    function welcome () {
      if (!request.session) return ''
      return `<p class=welcome>Welcome, ${escape(request.session.handle)}</p>`
    }
  })
}
