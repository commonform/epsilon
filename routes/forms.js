var DIGEST_RE = require('../util/digest-re')
var form = require('./partials/form')
var head = require('./partials/head')
var header = require('./partials/header')
var internalError = require('./internal-error')
var loadComponents = require('commonform-load-components')
var methodNotAllowed = require('./method-not-allowed')
var nav = require('./partials/nav')
var notFound = require('./not-found')
var pump = require('pump')
var storage = require('../storage')

module.exports = (request, response) => {
  if (request.method !== 'GET') return methodNotAllowed(request, response)
  var digest = request.parameters.digest
  var json
  if (digest.endsWith('.json')) {
    json = true
    digest = digest.replace(/\.json$/, '')
  }
  if (!DIGEST_RE.test(digest)) return notFound(request, response)
  if (json) {
    response.setHeader('Content-Type', 'application/json')
    return pump(
      storage.form.createRawReadStream(digest),
      response
    )
  }
  storage.form.read(digest, (error, rawForm) => {
    if (error) return internalError(request, response, error)
    if (!rawForm) return notFound(request, response)
    loadComponents(rawForm, {}, (error, loadedForm, resolutions) => {
      if (error) return internalError(request, response, error)
      response.setHeader('Content-Type', 'text/html')
      response.end(`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    ${nav(request.session)}
    <main role=main>
      ${form(rawForm, { form: loadedForm, resolutions })}
    </main>
  </body>
</html>
      `.trim())
    })
  })
}
