const assert = require('assert')
const expired = require('../util/expired')
const indexes = require('../indexes')
const runParallelLimit = require('run-parallel-limit')

exports.name = 'accounts'

exports.cron = '0 */6 * * *'

exports.handler = function (log, callback) {
  assert(typeof lob === 'object')
  assert(typeof callback === 'function')

  indexes.account.list((error, handles) => {
    if (error) {
      log.error(error)
      return callback()
    }
    const tasks = handles.map(handle => done => {
      const file = indexes.account.filePath(handle)
      indexes.lock(file, unlock => {
        done = unlock(done)
        indexes.account.readWithoutLocking(handle, (error, record) => {
          if (error) return done(error)
          if (!record.confirmed && expired.token(record)) {
            log.info({ handle }, 'deleting')
            indexes.account.deletWithoutLocking(handle, done)
          }
          done()
        })
      })
    })
    runParallelLimit(tasks, 3, callback)
  })
}
