const USER = require('./user')
const http = require('http')
const mail = require('../mail').events
const server = require('./server')
const tape = require('tape')
const webdriver = require('./webdriver')

const path = '/handles'
const handle = USER.handle
const email = USER.email

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
    let browser
    webdriver()
      .then((loaded) => { browser = loaded })
      .then(() => browser.navigateTo('http://localhost:' + port))
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
      done()
    }
  })
})
