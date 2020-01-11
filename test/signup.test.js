var http = require('http')
var mail = require('../mail').events
var server = require('./server')
var tape = require('tape')

var path = '/signup'

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

tape('browse ' + path, (test) => {
  server((port, done) => {
    var browser
    require('./webdriver')()
      .then((loaded) => { browser = loaded })
      .then(() => browser.url('http://localhost:' + port))
      .then(() => browser.$('a=Sign Up'))
      .then((a) => a.click())
      .then(() => browser.$('h2'))
      .then((title) => title.getText())
      .then((text) => {
        test.equal(text, 'Sign Up', '<h2>Sign Up</h2>')
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

tape('sign up', (test) => {
  var EMAIL = 'test@example.com'
  var HANDLE = 'tester'
  var PASSWORD = 'test password'
  server((port, done) => {
    var browser
    require('./webdriver')()
      .then((loaded) => { browser = loaded })
      .then(() => browser.setTimeouts(1000))
      .then(() => browser.url('http://localhost:' + port))
      .then(() => browser.$('a=Sign Up'))
      .then((a) => a.click())
      .then(() => browser.$('input[name="email"]'))
      .then((input) => input.setValue(EMAIL))
      .then(() => browser.$('input[name="handle"]'))
      .then((input) => input.setValue(HANDLE))
      .then(() => browser.$('input[name="password"]'))
      .then((input) => input.setValue(PASSWORD))
      .then(() => browser.$('input[name="repeat"]'))
      .then((input) => input.setValue(PASSWORD))
      .then(() => browser.$('button[type="submit"]'))
      .then((submit) => submit.click())
      .catch((error) => {
        test.fail(error, 'catch')
        browser.deleteSession()
        test.end()
        done()
      })
    mail.once('sent', (options) => {
      test.equal(options.to, EMAIL, 'sends e-mail')
      test.equal(options.subject, 'Confirm Your Account', 'subject')
      test.assert(options.text.includes('/confirm?token='), 'link')
      browser.url(options.text)
        .then(() => browser.$('p.message'))
        .then((p) => p.getText())
        .then((text) => {
          test.equal(text, 'account confirmed', 'confirmed')
        })
        .then(() => browser.$('input[name="handle"]'))
        .then((input) => input.setValue(HANDLE))
        .then(() => browser.$('input[name="password"]'))
        .then((input) => input.setValue(PASSWORD))
        .then(() => browser.$('button[type="submit"]'))
        .then((submit) => submit.click())
        .then(() => browser.$('.welcome'))
        .then((p) => p.getText())
        .then((text) => {
          test.assert(text.includes(HANDLE), 'weclomed by handle')
          browser.deleteSession()
          test.end()
          done()
        })
        .catch((error) => {
          test.fail(error)
          browser.deleteSession()
          test.end()
          done()
        })
      mail.once('sent', (options) => {
        test.equal(options.subject, 'Sign Up', 'admin notification')
        test.assert(options.text.includes(HANDLE), 'includes handle')
        test.assert(options.text.includes(EMAIL), 'includes email')
      })
    })
  })
})
