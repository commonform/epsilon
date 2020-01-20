const DIGEST_RE = require('../util/digest-re')
const authenticate = require('./authenticate')
const editionValidator = require('../validators/edition')
const escape = require('../util/escape')
const head = require('./partials/head')
const header = require('./partials/header')
const internalError = require('./internal-error')
const loadComponents = require('commonform-load-components')
const methodNotAllowed = require('./method-not-allowed')
const nav = require('./partials/nav')
const notFound = require('./not-found')
const projectValidator = require('../validators/project')
const pump = require('pump')
const renderForm = require('./partials/form')
const runAuto = require('run-auto')
const storage = require('../storage')

module.exports = (request, response) => {
  if (request.method !== 'GET') return methodNotAllowed(request, response)
  authenticate(request, response, () => {
    let digest = request.parameters.digest
    let json
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
    runAuto({
      form: done => {
        storage.form.read(digest, (error, form) => {
          if (error) return done(error)
          if (!form) {
            const error = new Error('not found')
            error.statusCode = 404
            return done(error)
          }
          done(null, form)
        })
      },
      loaded: ['form', (results, done) => {
        loadComponents(results.form, {}, (error, form, resolutions) => {
          if (error) return done(error)
          done(null, { form, resolutions })
        })
      }],
      comments: (done) => {
        storage.formComment.find({ context: digest }, done)
      }
    }, (error, results) => {
      if (error) {
        if (error.statusCode === 404) {
          return notFound(request, response)
        }
        return internalError(request, response, error)
      }
      response.setHeader('Content-Type', 'text/html')
      response.end(`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    ${nav(request.session)}
    <main role=main>
      <a class=button href=/edit?digest=${escape(digest)}>Edit this Form</a>
      ${renderForm({
        account: request.account,
        comments: results.comments,
        form: results.form,
        loaded: results.loaded.form,
        resolutions: results.loaded.resolutions
      })}
      ${request.account ? publishForm(digest) : ''}
    </main>
  </body>
  <script src=/comments.js></script>
</html>
      `.trim())
    })
  })
}

function publishForm (digest) {
  return `
<form id=publishForm action=/publications method=post>
  <input type=hidden name=digest value="${escape(digest)}">
  <label for=project>Project Name</label>
  <input name=project type=text>
  <p>${projectValidator.html}</p>
  <label for=edition>Edition</label>
  <input name=edition type=text>
  <p>${editionValidator.html}</p>
  <button type=submit>Publish</button>
</form>
  `.trim()
}
