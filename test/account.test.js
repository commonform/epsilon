var http = require('http')
var server = require('./server')
var signup = require('./signup')
var tape = require('tape')
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
  var handle = 'tester'
  var password = 'test password'
  var email = 'tester@example.com'
  server((port, done) => {
    var browser
    webdriver()
      .then((loaded) => { browser = loaded })
      .then(() => browser.setTimeouts(1000))
      .then(() => {
        signup({
          browser, port, handle, password, email
        }, (error) => {
          test.ifError(error, 'no signup error')
          browser.url('http://localhost:' + port)
            // Log in.
            .then(() => browser.$('a=Log In'))
            .then((a) => a.click())
            .then(() => browser.$('input[name="handle"]'))
            .then((input) => input.setValue(handle))
            .then(() => browser.$('input[name="password"]'))
            .then((input) => input.setValue(password))
            .then(() => browser.$('button[type="submit"]'))
            .then((submit) => submit.click())
            // Navigate to account page.
            .then(() => browser.$('a=Account'))
            .then((a) => a.click())
            // Check page contents.
            .then(() => browser.$('.handle'))
            .then((element) => element.getText())
            .then((text) => test.equal(text, handle, 'handle'))
            .then(() => browser.$('.email'))
            .then((element) => element.getText())
            .then((text) => test.equal(text, email, 'email'))
            .then(() => finish())
            .catch((error) => {
              test.fail(error, 'catch')
              finish()
            })
        })
      })
    function finish () {
      test.end()
      browser.deleteSession()
      done()
    }
  })
})
