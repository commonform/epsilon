const assert = require('assert')

module.exports = (options, callback) => {
  assert(options.browser)
  assert(Number.isSafeInteger(options.port))
  assert(typeof options.handle === 'string')
  assert(typeof options.password === 'string')
  const browser = options.browser
  const port = options.port
  const handle = options.handle
  const password = options.password
  return browser.navigateTo('http://localhost:' + port)
    .then(() => browser.$('a=Log In'))
    .then((a) => a.click())
    .then(() => browser.$('input[name="handle"]'))
    .then((input) => input.addValue(handle))
    .then(() => browser.$('input[name="password"]'))
    .then((input) => input.addValue(password))
    .then(() => browser.$('button[type="submit"]'))
    .then((submit) => submit.click())
    .catch(callback)
}
