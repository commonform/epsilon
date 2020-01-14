var NDA = require('./nda')
var USER = require('./user')
var assert = require('assert')
var fs = require('fs')
var handler = require('../')
var hashPassword = require('../util/hash-password')
var http = require('http')
var pino = require('pino')
var pinoHTTP = require('pino-http')
var rimraf = require('rimraf')
var runParallel = require('run-parallel')
var storage = require('../storage')
var uuid = require('uuid')

var handle = USER.handle
var password = USER.password
var email = USER.email

module.exports = (callback) => {
  assert(typeof callback === 'function')
  var log = pino({}, fs.createWriteStream('test-server.log'))
  fs.mkdtemp('/tmp/', (ignore, directory) => {
    process.env.DIRECTORY = directory
    runParallel([
      (done) => storage.form.create(NDA.digest, NDA.form, done),
      (done) => {
        hashPassword(password, function (_, passwordHash) {
          var account = {
            handle,
            email,
            created: new Date().toISOString(),
            confirmed: true,
            passwordHash
          }
          runParallel([
            (done) => storage.account.write(handle, account, done),
            (done) => storage.email.append(email, handle, done)
          ], done)
        })
      }
    ], () => {
      var server = http.createServer((request, response) => {
        pinoHTTP({ logger: log, genReqId: uuid.v4 })(request, response)
        handler(request, response)
      })
      server.listen(0, function () {
        var port = this.address().port
        process.env.BASE_HREF = 'http://localhost:' + port
        process.env.ADMIN_EMAIL = 'admin@example.com'
        callback(port, () => {
          server.close(() => {
            rimraf.sync(directory)
          })
        })
      })
    })
  })
}
