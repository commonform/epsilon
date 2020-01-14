var USER = require('./user')
var http = require('http')
var login = require('./login')
var server = require('./server')
var tape = require('tape')
var verifyLogin = require('./verify-login')
var webdriver = require('./webdriver')

var path = '/account'

tape('GET ' + path, (test) => {
  server((port, done) => {
    http.request({ path, port })
      .once('response', (response) => {
        test.equal(response.statusCode, 302, '302')
        test.equal(response.headers.location, '/login', 'redirect')
        test.end()
        done()
      })
      .end()
  })
})

tape('browse ' + path, (test) => {
  var email = USER.email
  var handle = USER.handle
  var password = USER.password
  server((port, done) => {
    var browser
    webdriver()
      .then((loaded) => { browser = loaded })
      .then(() => browser.setTimeouts(1000))
      .then(() => login({ browser, port, handle, password }))
      .then(() => verifyLogin({
        browser, test, port, email, handle
      }))
      .then(() => finish())
      .catch((error) => {
        test.fail(error, 'catch')
        finish()
      })
    function finish () {
      test.end()
      browser.deleteSession()
      done()
    }
  })
})
