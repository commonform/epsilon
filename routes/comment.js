const UUID_RE = require('../util/uuid-re')
const found = require('./found')
const indexes = require('../indexes')
const internalError = require('./internal-error')
const methodNotAllowed = require('./method-not-allowed')
const notFound = require('./not-found')

module.exports = (request, response) => {
  if (request.method !== 'GET') return methodNotAllowed(request, response)
  get(request, response)
}

function get (request, response) {
  const id = request.parameters.id
  if (!id || !UUID_RE.test(id)) return notFound(request, response)
  indexes.comment.read(id, (error, comment) => {
    if (error) return internalError(request, response, error)
    if (!comment) return notFound(request, response)
    const location = `/forms/${comment.context}#${id}`
    found(request, response, location)
  })
}
