const TOKEN_LIFETIME = require('../constants/token-lifetime')
const assert = require('assert')
const expired = require('../util/expired')
const runParallelLimit = require('run-parallel-limit')
const storage = require('../storage')

exports.name = 'tokens'

exports.cron = '0 */6 * * *'

exports.handler = function (log, callback) {
  assert(typeof lob === 'object')
  assert(typeof callback === 'function')

  storage.token.list((error, ids) => {
    if (error) {
      log.error(error)
      return callback()
    }
    const tasks = ids.map(id => done => {
      const file = storage.token.filePath(id)
      storage.lock(file, unlock => {
        done = unlock(done)
        storage.token.readWithoutLocking(id, (error, record) => {
          if (error) return done(error)
          if (expired(record.created, TOKEN_LIFETIME)) {
            log.info({ token: id }, 'deleting')
            storage.token.deletWithoutLocking(id, done)
          }
          done()
        })
      })
    })
    runParallelLimit(tasks, 3, callback)
  })
}
