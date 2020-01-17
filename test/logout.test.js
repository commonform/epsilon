const USER = require('./user')
const http = require('http')
const login = require('./login')
const server = require('./server')
const tape = require('tape')
const verifyLogin = require('./verify-login')
const webdriver = require('./webdriver')

const path = '/logout'
const handle = USER.handle
const password = USER.password
const email = USER.email

tape('GET ' + path, (test) => {
  server((port, done) => {
    http.request({ path, port })
      .once('response', (response) => {
        test.equal(response.statusCode, 303, '303')
        test.assert(response.headers['set-cookie'], 'Set-Cookie')
        test.end()
        done()
      })
      .end()
  })
})

tape('log out', (test) => {
  server((port, done) => {
    var browser
    webdriver()
      .then((loaded) => { browser = loaded })
      .then(() => login({ browser, port, handle, password }))
      .then(() => verifyLogin({ browser, port, test, handle, email }))
      .then(() => browser.$('=Log Out'))
      .then((element) => element.click())
      .then(() => browser.navigateTo('http://localhost:' + port + '/edit'))
      .then(() => browser.$('h2'))
      .then((h2) => h2.getText())
      .then((text) => test.equal(text, 'Log In', 'Log In'))
      .then(finish)
      .catch((error) => {
        test.fail(error)
        finish()
      })
    function finish () {
      test.end()
      done()
    }
  })
})
