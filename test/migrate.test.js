var server = require('./server')
var tape = require('tape')
var migrate = require('../migrate')

tape.only('migrate', (test) => {
  server((port, done) => {
    migrate(() => {
      test.end()
      done()
    })
  })
})
