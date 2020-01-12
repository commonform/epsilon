var DIGEST_RE = require('../util/digest-re')
var head = require('./partials/head')
var header = require('./partials/header')
var internalError = require('./internal-error')
var methodNotAllowed = require('./method-not-allowed')
var nav = require('./partials/nav')
var notFound = require('./not-found')
var storage = require('../storage')

module.exports = (request, response) => {
  if (request.method !== 'GET') return methodNotAllowed(request, response)
  var digest = request.parameters.digest
  if (!DIGEST_RE.test(digest)) return notFound(request, response)
  storage.form.read(digest, (error, form) => {
    if (error) return internalError(error)
    if (!form) return notFound(request, response)
    response.setHeader('Content-Type', 'text/html')
    response.end(`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    ${nav(request.session)}
    <main role=main>
      <pre>${JSON.stringify(form)}</pre>
    </main>
  </body>
</html>
    `.trim())
  })
}
