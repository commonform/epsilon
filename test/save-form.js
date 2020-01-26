const login = require('./login')

module.exports = options => {
  const { markup, port, browser, handle, password } = options
  return login({ browser, port, handle, password })
    .then(() => browser.$('#edit'))
    .then(a => a.click())
    .then(() => browser.$('#editor'))
    .then(input => input.setValue(markup))
    .then(() => browser.$('#editForm button[type="submit"]'))
    .then(submit => submit.click())
}
