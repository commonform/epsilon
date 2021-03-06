const DIGEST_RE = require('../util/digest-re')
const csrf = require('../util/csrf')
const editionValidator = require('../validators/edition')
const escape = require('../util/escape')
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
const pump = require('pump')
const renderForm = require('./partials/form')
const runAuto = require('run-auto')

module.exports = (request, response) => {
  if (request.method !== 'GET') return methodNotAllowed(request, response)
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
      indexes.form.createRawReadStream(digest),
      response
    )
  }
  runAuto({
    form: done => {
      indexes.form.read(digest, (error, form) => {
        if (error) return done(error)
        if (!form) {
          const error = new Error('not found')
          error.statusCode = 404
          return done(error)
        }
        done(null, form)
      })
    },
    drafts: done => {
      indexes.formDraft.read(digest, done)
    },
    loaded: ['form', (results, done) => {
      loadComponents(results.form, {}, (error, form, resolutions) => {
        if (error) return done(error)
        done(null, { form, resolutions })
      })
    }],
    comments: done => {
      indexes.formComment.find({ context: digest }, done)
    }
  }, (error, results) => {
    if (error) {
      if (error.statusCode === 404) {
        return notFound(request, response)
      }
      return internalError(request, response, error)
    }
    response.setHeader('Content-Type', 'text/html')
    response.end(html`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    ${nav(request)}
    <main role=main>
      <a class=button href=/edit?digest=${escape(digest)}>Edit this Form</a>
      ${renderDrafts(results.drafts)}
      ${renderForm({
        session: request.session,
        account: request.account,
        comments: results.comments,
        form: results.form,
        loaded: results.loaded.form,
        resolutions: results.loaded.resolutions
      })}
      ${request.account ? draftForm(request, digest) : ''}
      ${request.account ? publishForm(request, digest) : ''}
    </main>
  </body>
  <script src=/comments.js></script>
</html>
    `)
  })
}

function renderDrafts (drafts) {
  if (!drafts || drafts.length === 0) return ''
  let items = ''
  const seen = new Set()
  drafts.forEach(entry => {
    if (seen.has(entry)) return
    const [publisher, draft] = entry.split('/')
    seen.add(entry)
    const text = escape(publisher) + '’s ' + escape(draft)
    const url = `/${publisher}/drafts/${draft}`
    items += `<li><a href="${url}">${text}</a></li>`
  })
  return `<h2>Drafts</h2><ul id=drafts>${items}</ul>`
}

function draftForm (request, digest) {
  return html`
<form id=draftForm action=/drafts method=post>
  <h2>Save Draft</h2>
  ${csrf.inputs({ action: '/drafts', sessionID: request.session.id })}
  <input type=hidden name=form value="${escape(digest)}">
  <label for=draft>Draft Name</label>
  <input type=text name=draft pattern="${projectValidator.pattern}">
  <button type=submit>Save Draft</button>
</form>
  `
}

function publishForm (request, digest) {
  return html`
<form id=publishForm action=/publications method=post>
  <h2>Publish Form</h2>
  ${csrf.inputs({ action: '/publications', sessionID: request.session.id })}
  <input type=hidden name=form value="${escape(digest)}">
  <label for=project>Project Name</label>
  <input name=project type=text>
  <p>${projectValidator.html}</p>
  <label for=edition>Edition</label>
  <input name=edition type=text>
  <p>${editionValidator.html}</p>
  <button type=submit>Publish</button>
</form>
  `
}
