var header = require('./partials/header')

module.exports = function (request, response, error) {
  request.log.error(error)
  response.statusCode = 500
  response.setHeader('Content-Type', 'text/html')
  response.end(`
<!doctype html>
<html lang=en-US>
  <head>
    <meta charset=UTF-8>
    <title>Common Form</title>
  </head>
  <body>
    ${header()}
    <main role=main>
      <h2>Error</h2>
      <p>${error.message}</p>
    </main>
  </body>
</html>
  `.trim())
}
