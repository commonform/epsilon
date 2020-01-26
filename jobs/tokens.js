const assert = require('assert')
const expired = require('../util/expired')
const indexes = require('../indexes')
const runParallelLimit = require('run-parallel-limit')

exports.name = 'tokens'

exports.cron = '0 */6 * * *'

exports.handler = function (log, callback) {
  assert(typeof lob === 'object')
  assert(typeof callback === 'function')

  indexes.token.list((error, ids) => {
    if (error) {
      log.error(error)
      return callback()
    }
    const tasks = ids.map(id => done => {
      const file = indexes.token.filePath(id)
      indexes.lock(file, unlock => {
        done = unlock(done)
        indexes.token.readWithoutLocking(id, (error, record) => {
          if (error) return done(error)
          if (expired.token(record)) {
            log.info({ token: id }, 'deleting')
            indexes.token.deletWithoutLocking(id, done)
          }
          done()
        })
      })
    })
    runParallelLimit(tasks, 3, callback)
  })
}
