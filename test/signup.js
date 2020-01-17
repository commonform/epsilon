const assert = require('assert')
const mail = require('../mail').events

module.exports = (options, callback) => {
  assert(options.browser)
  assert(Number.isSafeInteger(options.port))
  assert(typeof options.handle === 'string')
  assert(typeof options.password === 'string')
  assert(typeof options.email === 'string')
  var browser = options.browser
  var port = options.port
  var handle = options.handle
  var password = options.password
  var email = options.email
  browser.navigateTo('http://localhost:' + port)
    .then(() => browser.$('a=Sign Up'))
    .then((a) => a.click())
    .then(() => browser.$('input[name="email"]'))
    .then((input) => input.addValue(email))
    .then(() => browser.$('input[name="handle"]'))
    .then((input) => input.addValue(handle))
    .then(() => browser.$('input[name="password"]'))
    .then((input) => input.addValue(password))
    .then(() => browser.$('input[name="repeat"]'))
    .then((input) => input.addValue(password))
    .then(() => browser.$('button[type="submit"]'))
    .then((submit) => submit.click())
    .catch(callback)
  mail.once('sent', (options) => {
    if (options.subject !== 'Confirm Your Account') {
      return callback(new Error('no confirmation e-mail'))
    }
    browser.navigateTo(options.text)
      .then(() => { callback() })
      .catch(callback)
  })
}
