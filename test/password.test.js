var mail = require('../mail').events
var server = require('./server')
var signup = require('./signup')
var tape = require('tape')
var verifyLogin = require('./verify-login')
var webdriver = require('./webdriver')

tape('change password', (test) => {
  var handle = 'tester'
  var oldPassword = 'old password'
  var newPassword = 'new password'
  var email = 'tester@example.com'
  server((port, done) => {
    var browser
    webdriver()
      .then((loaded) => { browser = loaded })
      .then(() => browser.setTimeouts(1000))
      .then(() => {
        signup({
          browser, port, handle, password: oldPassword, email
        }, (error) => {
          test.ifError(error, 'no signup error')
          browser.url('http://localhost:' + port)
            // Navigate to log-in page.
            .then(() => browser.$('a=Log In'))
            .then((a) => a.click())
            // Log in.
            .then(() => browser.$('input[name="handle"]'))
            .then((input) => input.setValue(handle))
            .then(() => browser.$('input[name="password"]'))
            .then((input) => input.setValue(oldPassword))
            .then(() => browser.$('button[type="submit"]'))
            .then((submit) => submit.click())
            // Navigate to password-change page.
            .then(() => browser.$('a=Change Password'))
            .then((a) => a.click())
            // Submit password-change form.
            .then(() => browser.$('input[name="old"]'))
            .then((input) => input.setValue(oldPassword))
            .then(() => browser.$('input[name="password"]'))
            .then((input) => input.setValue(newPassword))
            .then(() => browser.$('input[name="repeat"]'))
            .then((input) => input.setValue(newPassword))
            .then(() => {
              mail.once('sent', (options) => {
                test.equal(options.to, email, 'email')
                test.equal(options.subject, 'Password Change', 'Password Change')
              })
            })
            .then(() => browser.$('button[type="submit"]'))
            .then((submit) => submit.click())
            .then(() => browser.$('p.message'))
            .then((p) => p.getText())
            .then((text) => {
              test.assert(text.includes('changed'), 'changed')
            })
            // Log out.
            .then(() => browser.$('a=Log Out'))
            .then((a) => a.click())
            // Log in with new password.
            .then(() => browser.$('input[name="handle"]'))
            .then((input) => input.setValue(handle))
            .then(() => browser.$('input[name="password"]'))
            .then((input) => input.setValue(newPassword))
            .then(() => browser.$('button[type="submit"]'))
            .then((submit) => submit.click())
            .then(() => verifyLogin({
              browser, test, port, handle, email
            }))
            .then(() => {
              browser.deleteSession()
              test.end()
              done()
            })
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
