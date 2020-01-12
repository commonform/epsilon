module.exports = (request, response, location) => {
  response.statusCode = 302
  response.setHeader('Location', location)
  return response.end()
}
