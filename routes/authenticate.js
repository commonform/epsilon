var cookie = require('cookie')
var internalError = require('./internal-error')
var runParallel = require('run-parallel')
var storage = require('../storage')

module.exports = function (request, response, handler) {
  var header = request.headers.cookie
  if (!header) return proceed()
  var parsed = cookie.parse(header)
  var sessionID = parsed.commonform
  if (!sessionID) return proceed()
  storage.session.read(sessionID, function (error, session) {
    if (error) return internalError(request, response, error)
    if (!session) {
      request.log.info('expired session')
      return proceed()
    }
    var handle = session.handle
    request.log.info({ sessionID, handle }, 'authenticated')
    request.session = session
    runParallel({
      account: function (done) {
        storage.account.read(handle, done)
      }
    }, function (error, results) {
      if (error) return internalError(request, response, error)
      var account = results.account
      if (account.confirmed) request.account = account
      proceed()
    })
  })

  function proceed () {
    handler(request, response)
  }
}
