const mail = require('../mail').events
const server = require('./server')
const signup = require('./signup')
const tape = require('tape')
const verifyLogin = require('./verify-login')
const webdriver = require('./webdriver')

tape('change password', (test) => {
  var handle = 'tester'
  var oldPassword = 'old password'
  var newPassword = 'new password'
  var email = 'tester@example.com'
  server((port, done) => {
    var browser
    webdriver()
      .then((loaded) => { browser = loaded })
      .then(() => {
        signup({
          browser, port, handle, password: oldPassword, email
        }, (error) => {
          test.ifError(error, 'no signup error')
          browser.navigateTo('http://localhost:' + port)
            // Navigate to log-in page.
            .then(() => browser.$('a=Log In'))
            .then((a) => a.click())
            // Log in.
            .then(() => browser.$('input[name="handle"]'))
            .then((input) => input.addValue(handle))
            .then(() => browser.$('input[name="password"]'))
            .then((input) => input.addValue(oldPassword))
            .then(() => browser.$('button[type="submit"]'))
            .then((submit) => submit.click())
            // Navigate to password-change page.
            .then(() => browser.$('a=Account'))
            .then((a) => a.click())
            .then(() => browser.$('a=Change Password'))
            .then((a) => a.click())
            // Submit password-change form.
            .then(() => browser.$('input[name="old"]'))
            .then((input) => input.addValue(oldPassword))
            .then(() => browser.$('input[name="password"]'))
            .then((input) => input.addValue(newPassword))
            .then(() => browser.$('input[name="repeat"]'))
            .then((input) => input.addValue(newPassword))
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
            .then((input) => input.addValue(handle))
            .then(() => browser.$('input[name="password"]'))
            .then((input) => input.addValue(newPassword))
            .then(() => browser.$('button[type="submit"]'))
            .then((submit) => submit.click())
            .then(() => verifyLogin({
              browser, test, port, handle, email
            }))
            .then(() => {
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
      done()
    }
  })
})
