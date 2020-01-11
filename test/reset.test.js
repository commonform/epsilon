var http = require('http')
var mail = require('../mail').events
var server = require('./server')
var signup = require('./signup')
var tape = require('tape')
var verifyLogin = require('./verify-login')
var webdriver = require('./webdriver')

var path = '/reset'

tape('GET ' + path, (test) => {
  server((port, done) => {
    http.request({ path, port })
      .once('response', (response) => {
        test.equal(response.statusCode, 200, '200')
        test.end()
        done()
      })
      .end()
  })
})

tape('reset password', (test) => {
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
            .then(() => browser.$('a=Log In'))
            .then((a) => a.click())
            .then(() => browser.$('a=Reset Password'))
            .then((a) => a.click())
            .then(() => browser.$('input[name="handle"]'))
            .then((input) => input.setValue(handle))
            .then(() => browser.$('button[type="submit"]'))
            .then((submit) => submit.click())
            .catch((error) => {
              test.fail(error, 'catch')
              finish()
            })
          mail.once('sent', (options) => {
            test.equal(options.to, email, 'sent mail')
            test.equal(options.subject, 'Reset Your Password', 'reset')
            browser.url(options.text)
              // Fill reset form.
              .then(() => browser.$('input[name="password"]'))
              .then((input) => input.setValue(password))
              .then(() => browser.$('input[name="repeat"]'))
              .then((input) => input.setValue(password))
              .then(() => browser.$('button[type="submit"]'))
              .then((submit) => submit.click())
              // Navigate to log-in form.
              .then(() => browser.$('a=Log In'))
              .then((a) => a.click())
              // Fill log-in form.
              .then(() => browser.$('input[name="handle"]'))
              .then((input) => input.setValue(handle))
              .then(() => browser.$('input[name="password"]'))
              .then((input) => input.setValue(password))
              .then(() => browser.$('button[type="submit"]'))
              .then((submit) => submit.click())
              .then(() => verifyLogin({
                browser, port, test, handle, email
              }))
              .then(() => finish())
              .catch((error) => {
                test.fail(error, 'catch')
                finish()
              })
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
