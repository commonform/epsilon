var http = require('http')
var server = require('./server')
var tape = require('tape')

var path = '/logout'

tape('GET ' + path, (test) => {
  server((port, done) => {
    http.request({ path, port })
      .once('response', (response) => {
        test.equal(response.statusCode, 303, '303')
        test.assert(response.headers['set-cookie'], 'Set-Cookie')
        test.end()
        done()
      })
      .end()
  })
})
