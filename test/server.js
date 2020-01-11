var assert = require('assert')
var fs = require('fs')
var http = require('http')
var handler = require('../')
var rimraf = require('rimraf')

module.exports = function testServer (callback) {
  assert(typeof callback === 'function')
  fs.mkdtemp('/tmp/', function withDirectory (ignore, directory) {
    process.env.DIRECTORY = directory
    var server = http.createServer(handler)
    server.listen(0, function () {
      callback(this.address().port, function () {
        server.close(function () {
          rimraf.sync(directory)
        })
      })
    })
  })
}
