var UUID_RE = require('../util/uuid-re')
var internalError = require('./internal-error')
var seeOther = require('./see-other')
var storage = require('../storage')

module.exports = function (request, response) {
  if (request.method !== 'GET') {
    response.statusCode = 405
    return response.end()
  }

  var token = request.query.token
  if (!UUID_RE.test(token)) {
    response.statusCode = 400
    return response.end(`
<!doctype html>
<html lang=en-US>
  <head>
    <meta charset=UTF-8>
    <title>Common Form</title>
  </head>
  <body>
    <h1>Common Form</h1>
    <h2>Account Confirmation</h2>
    <p class=message>The link you followed is invalid or expired.</p>
  </body>
</html>
    `.trim())
  }

  storage.token.use(token, 'confirm', (error, success, record) => {
    if (error) return internalError(request, response, error)
    if (!success) {
      response.statusCode = 400
      return response.end()
    }
    var handle = record.handle
    storage.account.confirm(handle, (error) => {
      if (error) return internalError(request, response, error)
      var location = (
        '/login?message=' +
        encodeURIComponent('account confirmed')
      )
      seeOther(request, response, location)
    })
  })
}
