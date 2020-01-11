var http = require('http')
var server = require('./server')
var tape = require('tape')
var webdriver = require('./webdriver')

var path = '/login'

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
    webdriver()
      .then((loaded) => { browser = loaded })
      .then(() => browser.setTimeouts(1000))
      .then(() => browser.url('http://localhost:' + port))
      .then(() => browser.$('a=Log In'))
      .then((a) => a.click())
      .then(() => browser.$('h2'))
      .then((title) => title.getText())
      .then((text) => {
        test.equal(text, 'Log In', '<h2>Log In</h2>')
        test.end()
        browser.deleteSession()
        done()
      })
      .catch((error) => {
        test.fail(error)
        test.end()
        browser.deleteSession()
        done()
      })
  })
})

tape('log in with bad credentials', (test) => {
  server((port, done) => {
    var browser
    webdriver()
      .then((loaded) => { browser = loaded })
      .then(() => browser.setTimeouts(1000))
      .then(() => browser.url('http://localhost:' + port))
      .then(() => browser.$('a=Log In'))
      .then((a) => a.click())
      .then(() => browser.$('input[name="handle"]'))
      .then((input) => input.setValue('invalid'))
      .then(() => browser.$('input[name="password"]'))
      .then((input) => input.setValue('invalid'))
      .then(() => browser.$('button[type="submit"]'))
      .then((submit) => submit.click())
      .then(() => browser.$('p.message'))
      .then((p) => p.getText())
      .then((text) => {
        test.assert(text.includes('invalid'), 'invalid')
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
