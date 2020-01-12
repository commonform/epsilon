var assert = require('assert')

module.exports = (options, callback) => {
  assert(options.browser)
  assert(Number.isSafeInteger(options.port))
  assert(typeof options.handle === 'string')
  assert(typeof options.password === 'string')
  var browser = options.browser
  var port = options.port
  var handle = options.handle
  var password = options.password
  return browser.url('http://localhost:' + port)
    .then(() => browser.$('a=Log In'))
    .then((a) => a.click())
    .then(() => browser.$('input[name="handle"]'))
    .then((input) => input.setValue(handle))
    .then(() => browser.$('input[name="password"]'))
    .then((input) => input.setValue(password))
    .then(() => browser.$('button[type="submit"]'))
    .then((submit) => submit.click())
    .catch(callback)
}