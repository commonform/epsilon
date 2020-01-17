const notFound = require('./routes/not-found')
const parseURL = require('url-parse')
const publications = require('./routes/publications')
const routes = require('./routes')

const PUBLICATION_PATH = /^\/([a-z0-9]+)\/([a-z0-9]+)\/([0-9eucd]+)$/

module.exports = (request, response) => {
  const parsed = parseURL(request.url, true)
  const pathname = parsed.pathname
  request.pathname = pathname
  request.query = parsed.query
  const route = routes.get(pathname)
  request.parameters = route.params
  if (route.handler) return route.handler(request, response)
  const match = PUBLICATION_PATH.exec(pathname)
  if (match) {
    request.parameters = {
      publisher: match[1],
      project: match[2],
      edition: match[3]
    }
    return publications(request, response)
  }
  notFound(request, response)
}
