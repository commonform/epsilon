const http = require('http')
const server = require('./server')
const tape = require('tape')

tape('GET /', test => {
  server((port, done) => {
    http.request({ path: '/', port })
      .once('response', response => {
        test.equal(response.statusCode, 200, '200')
        test.end()
        done()
      })
      .end()
  })
})
