const ANA = require('./ana')
const signin = require('./signin')
const server = require('./server')
const tape = require('tape')
const webdriver = require('./webdriver')

const handle = ANA.handle
const password = ANA.password

tape('publish', test => {
  const markup = 'applesauce test'
  const project = 'test'
  const edition = '1e'
  server((port, done) => {
    let browser
    webdriver()
      .then(loaded => { browser = loaded })
      .then(() => signin({ browser, port, handle, password }))
      // Save form.
      .then(() => browser.$('a=New Form'))
      .then(a => a.click())
      .then(() => browser.$('#editor'))
      .then(editor => editor.setValue(markup))
      .then(() => click('#editForm button[type="submit"]'))
      .then(() => { test.pass('submitted form') })
      .then(() => browser.pause(10000))
      // Publish.
      .then(() => addValue('#publishForm input[name="project"]', project))
      .then(() => addValue('#publishForm input[name="edition"]', edition))
      .then(() => click('#publishForm button[type="submit"]'))
      .then(() => { test.pass('submitted') })
      // Confirm
      .then(() => browser.$('h2'))
      .then(h2 => h2.getText())
      .then(text => { test.equal(text, 'Proofread and Publish') })
      .then(() => click('#publishForm button[type="submit"]'))
      .then(() => { test.pass('proofed') })
      .then(() => browser.$('h2'))
      .then(h2 => h2.getText())
      .then(text => test.equal(text, project + ' ' + edition, 'heading'))
      .then(finish)
      .catch(error => {
        test.fail(error)
        finish()
      })

    function addValue (selector, value) {
      return browser.$(selector)
        .then(element => element.waitForEnabled())
        .then(() => browser.$(selector))
        .then(element => element.addValue(value))
    }

    function click (selector) {
      return browser.$(selector)
        .then(element => element.waitForClickable())
        .then(() => browser.$(selector))
        .then(element => element.click())
    }

    function finish () {
      test.end()
      done()
    }
  })
})
