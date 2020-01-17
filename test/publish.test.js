const USER = require('./user')
const login = require('./login')
const server = require('./server')
const tape = require('tape')
const webdriver = require('./webdriver')

const handle = USER.handle
const password = USER.password

tape('publish', (test) => {
  const markup = 'applesauce test'
  const project = 'test'
  const edition = '1e'
  server((port, done) => {
    var browser
    webdriver()
      .then((loaded) => { browser = loaded })
      .then(() => login({ browser, port, handle, password }))
      // Save form.
      .then(() => browser.$('a=New Form'))
      .then((a) => a.click())
      .then(() => browser.$('#editor'))
      .then((input) => input.setValue(markup))
      .then(() => browser.$('button[type="submit"]'))
      .then((submit) => submit.click())
      // Publish.
      .then(() => browser.$('input[name="project"]'))
      .then((input) => input.addValue(project))
      .then(() => browser.$('input[name="edition"]'))
      .then((input) => input.addValue(edition))
      .then(() => browser.$('button[type="submit"]'))
      .then((submit) => submit.click())
      .then(() => browser.$('h2'))
      .then((h2) => h2.getText())
      .then((text) => test.equal(text, project + ' ' + edition, 'heading'))
      .then(finish)
      .catch((error) => {
        test.fail(error)
        finish()
      })
    function finish () {
      test.end()
      done()
    }
  })
})
