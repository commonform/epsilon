var header = require('./partials/header')

module.exports = (request, response) => {
  response.statusCode = 404
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
      <h2>Not Found</h2>
    </main>
  </body>
</html>
  `.trim())
}
