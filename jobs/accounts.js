var TOKEN_LIFETIME = require('../constants/token-lifetime')
var assert = require('assert')
var expired = require('../util/expired')
var runParallelLimit = require('run-parallel-limit')
var storage = require('../storage')

exports.name = 'accounts'

exports.cron = '0 */6 * * *'

exports.handler = function (log, callback) {
  assert(typeof lob === 'object')
  assert(typeof callback === 'function')

  storage.account.list((error, handles) => {
    if (error) {
      log.error(error)
      return callback()
    }
    var tasks = handles.map((handle) => (done) => {
      var file = storage.account.filePath(handle)
      storage.lock(file, (unlock) => {
        done = unlock(done)
        storage.account.readWithoutLocking(handle, (error, record) => {
          if (error) return done(error)
          if (!record.confirmed && expired(record.created, TOKEN_LIFETIME)) {
            log.info({ handle }, 'deleting')
            storage.account.deletWithoutLocking(handle, done)
          }
          done()
        })
      })
    })
    runParallelLimit(tasks, 3, callback)
  })
}