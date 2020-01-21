const ANA = require('./ana')
const commonmark = require('commonform-commonmark')
const normalize = require('commonform-normalize')
const publish = require('./publish')
const saveForm = require('./save-form')
const server = require('./server')
const tape = require('tape')
const webdriver = require('./webdriver')

const handle = ANA.handle
const password = ANA.password

tape('publisher page', test => {
  const markup = 'applesauce test'
  const digest = normalize(commonmark.parse(markup).form).root
  const project = 'test'
  const edition = '1e'
  server((port, done) => {
    let browser
    webdriver()
      .then(loaded => { browser = loaded })
      .then(() => saveForm({
        markup, browser, port, handle, password
      }))
      .then(() => publish({
        port, browser, digest, project, edition
      }))
      // Browse own publisher page.
      .then(() => browser.navigateTo('http://localhost:' + port + '/' + handle))
      .then(() => browser.$('h2'))
      .then(h2 => h2.getText())
      .then(text => { test.equal(text, handle, 'handle <h2>') })
      .then(() => browser.$('=' + project + ' ' + edition))
      .then(element => element.waitForExist())
      .then(exists => test.assert(exists, 'links to edition'))
      .then(finish)
      .catch(error => {
        test.fail(error)
        finish()
      })

    function finish () {
      test.end()
      done()
    }
  })
})
