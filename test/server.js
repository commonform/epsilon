const NDA = require('./nda')
const USER = require('./user')
const assert = require('assert')
const fs = require('fs')
const handler = require('../')
const http = require('http')
const path = require('path')
const pino = require('pino')
const pinoHTTP = require('pino-http')
const record = require('../storage/record')
const rimraf = require('rimraf')
const runSeries = require('run-series')
const uuid = require('uuid')

const handle = USER.handle
const password = USER.password
const email = USER.email

module.exports = (callback) => {
  assert(typeof callback === 'function')
  const log = pino({}, fs.createWriteStream('test-server.log'))
  let directory
  runSeries([
    (done) => {
      fs.mkdtemp('/tmp/', (error, tmp) => {
        if (error) return done(error)
        directory = tmp
        process.env.INDEX_DIRECTORY = path.join(tmp, 'indexes')
        process.env.LOG_DIRECTORY = path.join(tmp, 'log')
        done()
      })
    },
    (done) => record({ type: 'form', form: NDA.form }, done),
    (done) => record({ type: 'account', handle, email, password }, done),
    (done) => record({ type: 'confirmAccount', handle }, done)
  ], () => {
    const server = http.createServer((request, response) => {
      pinoHTTP({ logger: log, genReqId: uuid.v4 })(request, response)
      handler(request, response)
    })
    server.listen(0, function () {
      const port = this.address().port
      process.env.BASE_HREF = 'http://localhost:' + port
      process.env.ADMIN_EMAIL = 'admin@example.com'
      callback(port, () => {
        server.close(() => {
          rimraf.sync(directory)
        })
      })
    })
  })
}
