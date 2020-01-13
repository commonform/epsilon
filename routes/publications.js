var editionValidator = require('../validators/edition')
var escape = require('../util/escape')
var form = require('./partials/form')
var handleValidator = require('../validators/handle')
var head = require('./partials/head')
var header = require('./partials/header')
var internalError = require('./internal-error')
var loadComponents = require('commonform-load-components')
var methodNotAllowed = require('./method-not-allowed')
var nav = require('./partials/nav')
var notFound = require('./not-found')
var projectValidator = require('../validators/project')
var runAuto = require('run-auto')
var storage = require('../storage')

module.exports = (request, response) => {
  if (request.method !== 'GET') return methodNotAllowed(request, response)
  var publisher = request.parameters.publisher
  var project = request.parameters.project
  var edition = request.parameters.edition
  if (
    !handleValidator.valid(publisher) ||
    !projectValidator.valid(project) ||
    !editionValidator.valid(edition)
  ) return notFound(request, response)
  var tasks = {
    publication: (done) => storage.publication.read({
      publisher, project, edition
    }, done),
    form: ['publication', (results, done) => {
      if (!results.publication) return done()
      storage.form.read(results.publication.digest, done)
    }]
  }
  runAuto(tasks, (error, data) => {
    if (error) return internalError(request, response, error)
    if (!data.publication) return notFound(request, response)
    var rawForm = data.form
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
      <h2>${escape(project)} ${escape(edition)}</h2>
      ${form(rawForm, { form: loadedForm, resolutions })}
    </main>
  </body>
</html>
        `.trim())
    })
  })
}
