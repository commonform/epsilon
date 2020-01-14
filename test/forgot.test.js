var USER = require('./user')
var http = require('http')
var mail = require('../mail').events
var server = require('./server')
var tape = require('tape')
var webdriver = require('./webdriver')

var path = '/forgot'
var handle = USER.handle
var email = USER.email

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

tape('discover handle', (test) => {
  server((port, done) => {
    var browser
    webdriver()
      .then((loaded) => { browser = loaded })
      .then(() => browser.url('http://localhost:' + port))
      .then(() => browser.$('a=Log In'))
      .then((a) => a.click())
      .then(() => browser.$('a=Forgot Handle'))
      .then((a) => a.click())
      .then(() => browser.$('input[name="email"]'))
      .then((input) => input.addValue(email))
      .then(() => browser.$('button[type="submit"]'))
      .then((submit) => submit.click())
      .catch((error) => {
        test.fail(error, 'catch')
        finish()
      })
    mail.once('sent', (options) => {
      test.equal(options.to, email, 'sent mail')
      test.equal(options.text, handle, 'mailed handle')
      finish()
    })
    function finish () {
      test.end()
      browser.deleteSession()
      done()
    }
  })
})
