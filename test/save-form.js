const login = require('./login')

module.exports = options => {
  const { markup, port, browser, handle, password } = options
  return login({ browser, port, handle, password })
    .then(() => browser.$('a=New Form'))
    .then(a => a.click())
    .then(() => browser.$('#editor'))
    .then(input => input.setValue(markup))
    .then(() => browser.$('button[type="submit"]'))
    .then(submit => submit.click())
}
