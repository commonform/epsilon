const Busboy = require('busboy')
const DIGEST_RE = require('../util/digest-re')
const csrf = require('../util/csrf')
const editionValidator = require('../validators/edition')
const escape = require('../util/escape')
const found = require('./found')
const head = require('./partials/head')
const header = require('./partials/header')
const html = require('./html')
const indexes = require('../indexes')
const internalError = require('./internal-error')
const loadComponents = require('commonform-load-components')
const methodNotAllowed = require('./method-not-allowed')
const nav = require('./partials/nav')
const projectValidator = require('../validators/project')
const renderForm = require('./partials/form')
const runSeries = require('run-series')
const seeOther = require('./see-other')

module.exports = (request, response) => {
  const method = request.method
  const isPOST = method === 'POST'
  if (!isPOST) return methodNotAllowed(request, response)
  if (!request.account) return found(request, response, '/signin')
  post(request, response)
}

function post (request, response) {
  const handle = request.account.handle
  const body = {}
  const fields = ['form', 'project', 'edition', 'proofed']
    .concat('csrftoken', 'csrfnonce')
  let form
  runSeries([
    readPostBody,
    validateInputs,
    verifyForm,
    recordPublication
  ], function (error) {
    if (error) {
      if (error.statusCode === 400) {
        // TODO: Show errors on form page.
        response.statusCode = 400
        return response.end()
      }
      return internalError(request, response, error)
    }
    if (body.proofed) {
      const url = '/' + [handle, body.project, body.edition].join('/')
      return seeOther(request, response, url)
    }
    loadComponents(form, {}, (error, loadedForm, resolutions) => {
      if (error) return internalError(request, response, error)
      response.setHeader('Content-Type', 'text/html')
      response.end(html`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    ${nav(request)}
    <main role=main>
      <h2>Proofread and Publish</h2>
      ${confirmationForm()}
      ${renderForm({
        session: request.session,
        form,
        loaded: loadedForm,
        resolutions
      })}
    </main>
  </body>
</html>
      `)
    })
  })

  function confirmationForm () {
    const csrfInputs = csrf.inputs({
      action: '/publications',
      sessionID: request.session.id
    })
    return html`
<form id=publishForm method=post>
  ${csrfInputs}
  <table>
    <tr>
      <td>Handle</td>
      <td>${escape(request.account.handle)}</td>
    </tr>
    <tr>
      <th>Project</th>
      <td>${escape(body.project)}</td>
    </tr>
    <tr>
      <th>Edition</th>
      <td>${escape(body.edition)}</td>
    </tr>
    <tr>
      <th>Form</th>
      <td><a href="/forms/${escape(body.form)}">${escape(body.form)}</a></td>
    </tr>
  </table>
  <input type=hidden name=form value="${escape(body.form)}">
  <input type=hidden name=project value="${escape(body.project)}">
  <input type=hidden name=edition value="${escape(body.edition)}">
  <input type=hidden name=proofed value=true>
  <button type=submit>Publish</button>
</form>
    `
  }

  function readPostBody (done) {
    request.pipe(
      new Busboy({
        headers: request.headers,
        limits: {
          fieldNameSize: Math.max(fields.map(x => x.length)),
          fields: fields.length,
          parts: 1
        }
      })
        .on('field', function (name, value, truncated, encoding, mime) {
          if (fields.includes(name)) body[name] = value
        })
        .once('finish', done)
    )
  }

  function validateInputs (done) {
    const form = body.form
    const project = body.project
    const edition = body.edition
    if (!DIGEST_RE.test(form)) return done('invalid form digest')
    if (project && !projectValidator.valid(project)) return done('invalid project name')
    if (edition && !editionValidator.valid(edition)) return done('invalid edition')
    if (project && !edition) return done('missing edition')
    if (edition && !project) return done('missing project name')
    csrf.verify({
      action: '/publications',
      sessionID: request.session.id,
      token: body.csrftoken,
      nonce: body.csrfnonce
    }, done)
  }

  function verifyForm (done) {
    indexes.form.read(body.form, (error, read) => {
      if (error) return done(error)
      if (!read) return done('unknown form')
      form = read
      done()
    })
  }

  function recordPublication (done) {
    if (!body.proofed) return done()
    request.record({
      type: 'publication',
      publisher: handle,
      project: body.project,
      edition: body.edition,
      form: body.form
    }, done)
  }
}
