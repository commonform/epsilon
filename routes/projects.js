const handleValidator = require('../validators/handle')
const head = require('./partials/head')
const header = require('./partials/header')
const html = require('./html')
const indexes = require('../indexes')
const internalError = require('./internal-error')
const methodNotAllowed = require('./method-not-allowed')
const nav = require('./partials/nav')
const notFound = require('./not-found')
const projectValidator = require('../validators/project')
const runAuto = require('run-auto')

module.exports = (request, response) => {
  if (request.method !== 'GET') return methodNotAllowed(request, response)
  const { publisher, project } = request.parameters
  if (
    !handleValidator.valid(publisher) ||
    !projectValidator.valid(project)
  ) return notFound(request, response)
  const tasks = {
    editions: done => indexes.projectEdition.read(
      publisher + '/' + project, done
    )
  }
  runAuto(tasks, (error, results) => {
    if (error) return internalError(request, response, error)
    if (!results.editions) return notFound(request, response)
    response.setHeader('Content-Type', 'text/html')
    response.end(html`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    ${nav(request)}
    <main role=main>
      <h2>${publisher} ${project}</h2>
      <ul>
      ${results.editions.map(edition => `
        <li>
          <a href="/${publisher}/${project}/${edition}">
            ${edition}
          </a>
        </li>
      `)}
      </ul>
    </main>
  </body>
</html>
    `)
  })
}
