var mail = require('../mail').events
var server = require('./server')
var signup = require('./signup')
var tape = require('tape')
var webdriver = require('./webdriver')

tape('change e-mail', (test) => {
  var handle = 'tester'
  var password = 'test password'
  var oldEMail = 'old@example.com'
  var newEMail = 'new@example.com'
  server((port, done) => {
    var browser
    webdriver()
      .then((loaded) => { browser = loaded })
      .then(() => {
        signup({
          browser, port, handle, password, email: oldEMail
        }, (error) => {
          test.ifError(error, 'no signup error')
          browser.url('http://localhost:' + port)
            // Navigate to log-in page.
            .then(() => browser.$('a=Log In'))
            .then((a) => a.click())
            // Log in.
            .then(() => browser.$('input[name="handle"]'))
            .then((input) => input.addValue(handle))
            .then(() => browser.$('input[name="password"]'))
            .then((input) => input.addValue(password))
            .then(() => browser.$('button[type="submit"]'))
            .then((submit) => submit.click())
            // Navigate to password-change page.
            .then(() => browser.$('a=Account'))
            .then((a) => a.click())
            .then(() => browser.$('a=Change E-Mail'))
            .then((a) => a.click())
            // Submit password-change form.
            .then(() => browser.$('input[name="email"]'))
            .then((input) => input.addValue(newEMail))
            .then(() => {
              mail.once('sent', (options) => {
                test.equal(options.to, newEMail, 'TO: new email')
                test.equal(options.subject, 'Confirm Your E-Mail Change', 'confirm')
                browser.url(options.text)
                  .then(() => browser.$('p.message'))
                  .then((p) => p.getText())
                  .then((text) => {
                    test.assert(text.includes('changed'), 'changed')
                    test.end()
                    done()
                  })
              })
            })
            .then(() => browser.$('button[type="submit"]'))
            .then((submit) => submit.click())
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
