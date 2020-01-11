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
    <h1>Common Form</h1>
    <h2>Not Found</h2>
  </body>
</html>
  `.trim())
}
