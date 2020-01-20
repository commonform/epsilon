const head = require('./partials/head')
const header = require('./partials/header')
const html = require('./html')

module.exports = (request, response) => {
  response.statusCode = 404
  response.setHeader('Content-Type', 'text/html')
  response.end(html`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    <main role=main>
      <h2>Not Found</h2>
    </main>
  </body>
</html>
  `)
}
