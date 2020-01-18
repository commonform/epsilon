const NDA = require('./nda')
const USER = require('./user')
const assert = require('assert')
const flushWriteStream = require('flush-write-stream')
const fs = require('fs')
const handler = require('../')
const http = require('http')
const journal = require('../storage/journal')
const path = require('path')
const pino = require('pino')
const pinoHTTP = require('pino-http')
const pump = require('pump')
const rimraf = require('rimraf')
const runSeries = require('run-series')
const uuid = require('uuid')
const validate = require('../storage/validate')
const write = require('../storage/write')

const handle = USER.handle
const password = USER.password
const email = USER.email

module.exports = (callback) => {
  assert(typeof callback === 'function')
  const log = pino({}, fs.createWriteStream('test-server.log'))
  let directory
  let journalInstance
  runSeries([
    (done) => {
      fs.mkdtemp('/tmp/', (error, tmp) => {
        if (error) return done(error)
        directory = tmp
        process.env.INDEX_DIRECTORY = path.join(tmp, 'indexes')
        process.env.LOG_DIRECTORY = path.join(tmp, 'log')
        journalInstance = journal()
        done()
      })
    },
    (done) => journalInstance.initialize(done),
    (done) => journalInstance.write({ type: 'form', form: NDA.form }, done),
    (done) => journalInstance.write({ type: 'account', handle, email, password }, done),
    (done) => journalInstance.write({ type: 'confirmAccount', handle }, done)
  ], () => {
    const entries = journalInstance.watch()
    pump(entries, flushWriteStream.obj((entry, _, done) => {
      write(entry, done)
    }))
    const server = http.createServer((request, response) => {
      pinoHTTP({ logger: log, genReqId: uuid.v4 })(request, response)
      request.record = (entry, callback) => {
        validate(entry, (error) => {
          if (error) return callback(error)
          journalInstance.write(entry, callback)
        })
      }
      handler(request, response)
    })
    server.listen(0, function () {
      const port = this.address().port
      process.env.BASE_HREF = 'http://localhost:' + port
      process.env.ADMIN_EMAIL = 'admin@example.com'
      callback(port, () => {
        entries.destroy()
        server.close(() => {
          rimraf.sync(directory)
        })
      })
    })
  })
}
