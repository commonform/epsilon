const ANA = require('./ana')
const signin = require('./signin')
const server = require('./server')
const tape = require('tape')
const webdriver = require('./webdriver')

const handle = ANA.handle
const password = ANA.password

tape('draft', test => {
  const markup = 'applesauce test'
  const draft = 'test'
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
      .then(() => addValue('#draftForm input[name="draft"]', draft))
      .then(() => click('#draftForm button[type="submit"]'))
      .then(() => { test.pass('submitted') })
      // Browse
      .then(() => browser.navigateTo('http://localhost:' + port + '/' + ANA.handle + '/drafts/' + draft))
      .then(() => browser.$('#drafts'))
      .then(drafts => drafts.waitForExist())
      .then(() => browser.$('#drafts li:first-child'))
      .then(li => li.getText())
      .then(text => test.assert(text.includes(ANA.handle)))
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
