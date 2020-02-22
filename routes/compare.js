const DIGEST_RE = require('../util/digest-re')
const commonmark = require('commonform-commonmark')
const diffLines = require('diff').diffLines
const escape = require('../util/escape')
const head = require('./partials/head')
const header = require('./partials/header')
const html = require('./html')
const indexes = require('../indexes')
const internalError = require('./internal-error')
const methodNotAllowed = require('./method-not-allowed')
const nav = require('./partials/nav')
const notFound = require('./not-found')
const runAuto = require('run-auto')

module.exports = (request, response) => {
  if (request.method !== 'GET') return methodNotAllowed(request, response)
  const fromDigest = request.query.from
  const toDigest = request.query.to
  if (!DIGEST_RE.test(fromDigest) || !DIGEST_RE.test(toDigest)) {
    request.log.info('invalid digest')
    return notFound(request, response)
  }
  runAuto({
    from: fetchForm(fromDigest),
    to: fetchForm(toDigest)
  }, (error, results) => {
    if (error) {
      request.log.error(error)
      if (error.statusCode === 404) {
        return notFound(request, response)
      }
      return internalError(request, response, error)
    }
    const fromMarkup = commonmark.stringify(results.from)
    const toMarkup = commonmark.stringify(results.to)
    const diff = diffLines(fromMarkup, toMarkup)
    response.setHeader('Content-Type', 'text/html')
    response.end(html`
<!doctype html>
<html lang=en-US>
  ${head()}
  <body>
    ${header()}
    ${nav(request)}
    <main role=main>
      ${renderDiff(diff)}
    </main>
  </body>
</html>
    `)
  })

  function fetchForm (digest) {
    return done => {
      indexes.form.read(digest, (error, form) => {
        if (error) return done(error)
        if (!form) {
          const error = new Error('not found')
          error.statusCode = 404
          return done(error)
        }
        done(null, form)
      })
    }
  }
}

function renderDiff (diff) {
  return diff
    .map(element => {
      const value = escape(element.value)
      if (element.added) return `<p><ins>${value}</ins></p>`
      if (element.removed) return `<p><del>${value}</del></p>`
      return `<p>${value}</p>`
    })
    .join('\n')
}
