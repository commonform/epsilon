const head = require('./partials/head')
const header = require('./partials/header')
const html = require('./html')

module.exports = function (request, response, error) {
  request.log.error(error)
  response.statusCode = 500
  response.setHeader('Content-Type', 'text/html')
  response.end(html`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    <main role=main>
      <h2>Error</h2>
      <p>${error.message}</p>
    </main>
  </body>
</html>
  `)
}
