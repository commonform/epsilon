const USER = require('./user')
const http = require('http')
const login = require('./login')
const server = require('./server')
const tape = require('tape')
const verifyLogin = require('./verify-login')
const webdriver = require('./webdriver')

const path = '/account'

tape('GET ' + path, (test) => {
  server((port, done) => {
    http.request({ path, port })
      .once('response', (response) => {
        test.equal(response.statusCode, 302, '302')
        test.equal(response.headers.location, '/login', 'redirect')
        test.end()
        done()
      })
      .end()
  })
})

tape('browse ' + path, (test) => {
  const email = USER.email
  const handle = USER.handle
  const password = USER.password
  server((port, done) => {
    let browser
    webdriver()
      .then((loaded) => { browser = loaded })
      .then(() => login({ browser, port, handle, password }))
      .then(() => verifyLogin({
        browser, test, port, email, handle
      }))
      .then(() => finish())
      .catch((error) => {
        test.fail(error, 'catch')
        finish()
      })
    function finish () {
      test.end()
      done()
    }
  })
})
