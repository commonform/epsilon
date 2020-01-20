const http = require('http')
const server = require('./server')
const tape = require('tape')
const webdriver = require('./webdriver')

tape('GET /', test => {
  server((port, done) => {
    http.request({ path: '/', port })
      .once('response', response => {
        test.equal(response.statusCode, 200, '200')
        test.end()
        done()
      })
      .end()
  })
})

tape('browse /', test => {
  server((port, done) => {
    let browser
    webdriver()
      .then(loaded => { browser = loaded })
      .then(() => browser.navigateTo('http://localhost:' + port))
      .then(() => browser.$('h1'))
      .then(title => title.getText())
      .then(text => {
        test.equal(text, 'Common Form')
        test.end()
        done()
      })
      .catch(error => {
        test.fail(error)
        test.end()
        done()
      })
  })
})
