const ANA = require('./ana')
const BOB = require('./bob')
const http = require('http')
const login = require('./login')
const logout = require('./logout')
const server = require('./server')
const tape = require('tape')
const verifyLogin = require('./verify-login')
const webdriver = require('./webdriver')

const path = '/logout'

tape('GET ' + path, test => {
  server((port, done) => {
    http.request({ path, port })
      .once('response', response => {
        test.equal(response.statusCode, 405, '405')
        test.end()
        done()
      })
      .end()
  })
})

tape('log out', test => {
  server((port, done) => {
    let browser
    webdriver()
      .then(loaded => { browser = loaded })
      .then(() => login({
        browser,
        port,
        handle: ANA.handle,
        password: ANA.password
      }))
      .then(() => verifyLogin({
        browser,
        port,
        test,
        handle: ANA.handle,
        email: ANA.email
      }))
      .then(() => browser.$('#logout'))
      .then(element => element.click())
      .then(() => browser.navigateTo('http://localhost:' + port + '/edit'))
      .then(() => browser.$('h2'))
      .then(h2 => h2.getText())
      .then(text => test.equal(text, 'Log In', 'Log In'))
      .then(finish)
      .catch(error => {
        test.fail(error)
        finish()
      })
    function finish () {
      test.end()
      done()
    }
  })
})

tape('log in as ana, log in as bob', test => {
  server((port, done) => {
    let browser
    webdriver()
      .then(loaded => { browser = loaded })
      .then(() => login({
        browser,
        port,
        handle: ANA.handle,
        password: ANA.password
      }))
      .then(() => verifyLogin({
        browser,
        port,
        test,
        handle: ANA.handle,
        email: ANA.email
      }))
      .then(() => logout({ browser, port }))
      .then(() => login({
        browser,
        port,
        handle: BOB.handle,
        password: BOB.password
      }))
      .then(() => verifyLogin({
        browser,
        port,
        test,
        handle: BOB.handle,
        email: BOB.email
      }))
      .then(finish)
      .catch(error => {
        test.fail(error)
        finish()
      })
    function finish () {
      test.end()
      done()
    }
  })
})
