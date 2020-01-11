var http = require('http')
var server = require('./server')
var tape = require('tape')
var webdriver = require('./webdriver')

var path = '/not-found'

tape('GET ' + path, (test) => {
  server((port, done) => {
    http.request({ path, port })
      .once('response', (response) => {
        test.equal(response.statusCode, 404, '404')
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
      .then(() => browser.url('http://localhost:' + port + path))
      .then(() => browser.$('h2'))
      .then((title) => title.getText())
      .then((text) => {
        test.equal(text, 'Not Found')
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
