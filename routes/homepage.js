var authenticate = require('./authenticate')
var escapeHTML = require('escape-html')

module.exports = (request, response) => {
  authenticate(request, response, () => {
    response.end(`
<!doctype html>
<html lang=en-US>
  <head>
    <meta charset=UTF-8>
    <title>Common Form</title>
  </head>
  <body>
    <h1>Common Form</h1>
    ${welcome()}
  </body>
</html>
    `.trim())

    function welcome () {
      if (!request.session) return ''
      return `<p class=welcome>Welcome, ${escapeHTML(request.session.handle)}</p>`
    }
  })
}
