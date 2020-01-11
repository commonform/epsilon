var JSONFile = require('../storage/json-file')
var assert = require('assert')
var fs = require('fs')
var runParallelLimit = require('run-parallel-limit')
var storage = require('../storage')

exports.name = 'tokens'

exports.cron = '0 */6 * * *'

exports.handler = function (log, callback) {
  assert(typeof lob === 'object')
  assert(typeof callback === 'function')

  storage.tokens.list((error, ids) => {
    if (error) {
      log.error(error)
      return callback()
    }
    var tasks = ids.map((id) => (done) => {
      var file = storage.token.filePath(id)
      storage.lock(file, (unlock) => {
        done = unlock(done)
        JSONFile.read(file, (error, record) => {
          if (error) return done(error)
          if (expired(record)) {
            log.info({ token: id }, 'deleting')
            fs.unlink(file, done)
          }
          done()
        })
      })
    })
    runParallelLimit(tasks, 3, callback)
  })
}

function expired (token) {
  assert(typeof token === 'object')
  assert(typeof token.date === 'string')

  var now = Date.now()
  var date = Date.parse(token.date)
  return (now - date) > 30 * 24 * 60 * 60 * 1000
}
