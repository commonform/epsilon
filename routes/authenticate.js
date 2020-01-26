const cookie = require('cookie')
const indexes = require('../indexes')
const internalError = require('./internal-error')
const runParallel = require('run-parallel')
const setCookie = require('./set-cookie')
const uuid = require('uuid')

module.exports = function (request, response, handler) {
  const header = request.headers.cookie
  if (!header) {
    createGuestSession()
    return proceed()
  }
  const parsed = cookie.parse(header)
  const sessionID = parsed.commonform
  if (!sessionID) {
    createGuestSession()
    return proceed()
  }
  indexes.session.read(sessionID, function (error, session) {
    if (error) return internalError(request, response, error)
    if (!session) {
      request.session = { id: sessionID }
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

  function createGuestSession () {
    const id = uuid.v4()
    const expires = new Date(
      Date.now() + (30 * 24 * 60 * 60 * 1000)
    )
    setCookie(response, id, expires)
    request.session = { id, expires }
  }
}
