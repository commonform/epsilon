var http = require('http')
var server = require('./server')
var tape = require('tape')

tape('GET /', (test) => {
  server((port, done) => {
    http.request({ path: '/', port })
      .once('response', (response) => {
        test.equal(response.statusCode, 200)
        test.end()
        done()
      })
      .end()
  })
})

tape('browse /', (test) => {
  server((port, done) => {
    var browser
    require('./webdriver')()
      .then((loaded) => { browser = loaded })
      .then(() => browser.url('http://localhost:' + port))
      .then(() => browser.$('h1'))
      .then((title) => title.getText())
      .then((text) => {
        test.equal(text, 'Common Form')
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
