const signin = require('./signin')

module.exports = options => {
  const { markup, port, browser, handle, password } = options
  return signin({ browser, port, handle, password })
    .then(() => browser.$('#edit'))
    .then(a => a.click())
    .then(() => browser.$('#editor'))
    .then(input => input.setValue(markup))
    .then(() => browser.$('#editForm button[type="submit"]'))
    .then(submit => submit.click())
}
