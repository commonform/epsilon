const cookie = require('cookie')
const indexes = require('../indexes')
const internalError = require('./internal-error')
const runParallel = require('run-parallel')

module.exports = function (request, response, handler) {
  const header = request.headers.cookie
  if (!header) return proceed()
  const parsed = cookie.parse(header)
  const sessionID = parsed.commonform
  if (!sessionID) return proceed()
  indexes.session.read(sessionID, function (error, session) {
    if (error) return internalError(request, response, error)
    if (!session) {
      request.log.info({ id: sessionID }, 'expired session')
      return proceed()
    }
    const handle = session.handle
    request.log.info({ sessionID, handle }, 'authenticated')
    request.session = session
    runParallel({
      account: function (done) {
        indexes.account.read(handle, done)
      }
    }, function (error, results) {
      if (error) return internalError(request, response, error)
      const account = results.account
      if (!account) {
        return internalError(
          request, response, new Error('could not load account')
        )
      }
      if (account.confirmed) request.account = account
      proceed()
    })
  })

  function proceed () {
    handler(request, response)
  }
}
