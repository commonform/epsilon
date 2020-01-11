var authenticate = require('./authenticate')
var escapeHTML = require('escape-html')
var head = require('./partials/head')
var header = require('./partials/header')
var nav = require('./partials/nav')

module.exports = (request, response) => {
  authenticate(request, response, () => {
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
      return `<p class=welcome>Welcome, ${escapeHTML(request.session.handle)}</p>`
    }
  })
}
