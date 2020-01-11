var assert = require('assert')

module.exports = (options) => {
  assert(options.browser)
  assert(options.test)
  assert(Number.isSafeInteger(options.port))
  assert(typeof options.handle === 'string')
  assert(typeof options.email === 'string')
  var browser = options.browser
  var test = options.test
  var port = options.port
  var handle = options.handle
  var email = options.email
  return browser.url('http://localhost:' + port)
    .then(() => browser.$('a=Account'))
    .then((a) => a.click())
    .then(() => browser.$('.handle'))
    .then((element) => element.getText())
    .then((text) => test.equal(text, handle, '/account shows handle'))
    .then(() => browser.$('.email'))
    .then((element) => element.getText())
    .then((text) => test.equal(text, email, '/account shows e-mail'))
}
