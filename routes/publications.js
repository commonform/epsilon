const editionValidator = require('../validators/edition')
const escape = require('../util/escape')
const handleValidator = require('../validators/handle')
const head = require('./partials/head')
const header = require('./partials/header')
const html = require('./html')
const indexes = require('../indexes')
const internalError = require('./internal-error')
const loadComponents = require('commonform-load-components')
const methodNotAllowed = require('./method-not-allowed')
const nav = require('./partials/nav')
const notFound = require('./not-found')
const projectValidator = require('../validators/project')
const renderForm = require('./partials/form')
const runAuto = require('run-auto')

module.exports = (request, response) => {
  if (request.method !== 'GET') return methodNotAllowed(request, response)
  const publisher = request.parameters.publisher
  const project = request.parameters.project
  const edition = request.parameters.edition
  if (
    !handleValidator.valid(publisher) ||
    !projectValidator.valid(project) ||
    !editionValidator.valid(edition)
  ) return notFound(request, response)
  const tasks = {
    publication: done => indexes.publication.read({
      publisher, project, edition
    }, done),
    form: ['publication', (results, done) => {
      if (!results.publication) return done()
      indexes.form.read(results.publication.form, done)
    }]
  }
  runAuto(tasks, (error, data) => {
    if (error) return internalError(request, response, error)
    if (!data.publication) return notFound(request, response)
    const form = data.form
    loadComponents(form, {}, (error, loaded, resolutions) => {
      if (error) return internalError(request, response, error)
      response.setHeader('Content-Type', 'text/html')
      response.end(html`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    ${nav(request.account)}
    <main role=main>
      <h2>${escape(project)} ${escape(edition)}</h2>
      ${renderForm({
        form,
        loaded,
        resolutions
      })}
    </main>
  </body>
</html>
        `)
    })
  })
}
