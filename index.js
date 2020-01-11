var notFound = require('./routes/not-found')
var parseURL = require('url-parse')
var routes = require('./routes')

module.exports = (request, response) => {
  var parsed = parseURL(request.url, true)
  request.query = parsed.query
  var route = routes.get(parsed.pathname)
  request.parameters = route.params
  if (route.handler) return route.handler(request, response)
  notFound(request, response)
}
