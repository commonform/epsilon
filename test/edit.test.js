var http = require('http')
var promisify = require('util').promisify
var login = require('./login')
var server = require('./server')
var signup = promisify(require('./signup'))
var tape = require('tape')
var webdriver = require('./webdriver')

var path = '/edit'

tape('GET ' + path, (test) => {
  server((port, done) => {
    http.request({ path, port })
      .once('response', (response) => {
        test.equal(response.statusCode, 302, '302')
        test.end()
        done()
      })
      .end()
  })
})

tape('edit new form', (test) => {
  var handle = 'tester'
  var email = 'test@example.com'
  var password = 'test password'
  server((port, done) => {
    var browser
    webdriver()
      .then((loaded) => { browser = loaded })
      .then(() => browser.setTimeouts(1000))
      .then(() => signup({
        browser, port, handle, email, password
      }))
      .then(() => login({ browser, port, handle, password }))
      .then(() => browser.$('a=Edit'))
      .then((a) => a.click())
      .then(() => browser.$('#editor'))
      .then((input) => input.setValue('test form'))
      .then(() => browser.$('button[type="submit"]'))
      .then((submit) => submit.click())
      .then(() => browser.$('=test form'))
      .then((p) => {
        test.assert(p, 'text appears')
        finish()
      })
      .catch((error) => {
        test.fail(error)
        finish()
      })
    function finish () {
      test.end()
      browser.deleteSession()
      done()
    }
  })
})
