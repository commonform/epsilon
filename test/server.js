var assert = require('assert')
var fs = require('fs')
var handler = require('../')
var http = require('http')
var pino = require('pino')
var pinoHTTP = require('pino-http')
var rimraf = require('rimraf')
var uuid = require('uuid')

module.exports = (callback) => {
  assert(typeof callback === 'function')
  var log = pino({}, fs.createWriteStream('test-server.log'))
  fs.mkdtemp('/tmp/', (ignore, directory) => {
    process.env.DIRECTORY = directory
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
}
