const handleValidator = require('../validators/handle')
const indexes = require('../indexes')
const internalError = require('./internal-error')
const methodNotAllowed = require('./method-not-allowed')
const notFound = require('./not-found')
const projectValidator = require('../validators/project')
const runAuto = require('run-auto')
const seeOther = require('./see-other')

module.exports = (request, response) => {
  if (request.method !== 'GET') return methodNotAllowed(request, response)
  const publisher = request.parameters.publisher
  const draft = request.parameters.draft
  if (
    !handleValidator.valid(publisher) ||
    !projectValidator.valid(draft)
  ) return notFound(request, response)
  const tasks = {
    drafts: done => indexes.draft.read(publisher + '/' + draft, done)
  }
  runAuto(tasks, (error, data) => {
    if (error) return internalError(request, response, error)
    if (!data.drafts) return notFound(request, response)
    const last = data.drafts[data.drafts.length - 1]
    const digest = last.split('/')[1]
    seeOther(request, response, `/forms/${digest}`)
  })
}
