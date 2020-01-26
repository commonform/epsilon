const clearCookie = require('./clear-cookie')
const methodNotAllowed = require('./method-not-allowed')

module.exports = function (request, response) {
  if (request.method !== 'POST') {
    return methodNotAllowed(request, response)
  }
  post(request, response)
}

function post (request, response) {
  clearCookie(response)
  response.statusCode = 303
  response.setHeader('Location', '/')
  response.end()
}
