const escape = require('../util/escape')
const handleValidator = require('../validators/handle')
const head = require('./partials/head')
const header = require('./partials/header')
const html = require('./html')
const indexes = require('../indexes')
const internalError = require('./internal-error')
const methodNotAllowed = require('./method-not-allowed')
const nav = require('./partials/nav')
const notFound = require('./not-found')
const runAuto = require('run-auto')
const runParallelLimit = require('run-parallel-limit')

module.exports = (request, response) => {
  if (request.method !== 'GET') return methodNotAllowed(request, response)
  const publisher = request.parameters.publisher
  if (
    !handleValidator.valid(publisher)
  ) return notFound(request, response)
  const tasks = {
    publisher: done => indexes.account.read(publisher, done),
    slugs: done => indexes.publisherPublication.read(publisher, done),
    publications: ['slugs', (results, done) => {
      const tasks = results.slugs.map(slug => done => {
        const [project, edition] = slug.split('/')
        indexes.publication.read({
          publisher, project, edition
        }, (error, publication) => {
          if (error) return done(error)
          publication.project = project
          publication.edition = edition
          done(null, publication)
        })
      })
      runParallelLimit(tasks, 3, done)
    }]
  }
  runAuto(tasks, (error, results) => {
    if (error) return internalError(request, response, error)
    if (!results.publisher) return notFound(request, response)
    response.setHeader('Content-Type', 'text/html')
    response.end(html`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    ${nav(request.session)}
    <main role=main>
      <h2>${escape(publisher)}</h2>
      <ul>
      ${results.publications.map(publication => `
        <li>
          <a href="/${publication.publisher}/${publication.project}/${publication.edition}"
            >${publication.project} ${publication.edition}</a>
        </li>
      `)}
      </ul>
    </main>
  </body>
</html>
    `)
  })
}
