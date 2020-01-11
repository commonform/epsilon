module.exports = (request, response) => {
  response.end(`
<!doctype html>
<html lang=en-US>
  <head>
    <meta charset=UTF-8>
    <title>Common Form</title>
  </head>
  <body>
    <h1>Common Form</h1>
  </body>
</html>
  `.trim())
}
