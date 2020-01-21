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

tape('project page', test => {
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
      .then(() => browser.navigateTo(
        'http://localhost:' + port + '/' + handle + '/' + project
      ))
      .then(() => browser.$('h2'))
      .then(h2 => h2.getText())
      .then(text => {
        test.assert(text.includes(handle), 'publisher')
        test.assert(text.includes(project), 'project')
      })
      .then(() => browser.$('a=' + edition))
      .then(a => a.click())
      .then(() => browser.$('h2=' + project + ' ' + edition))
      .then(h2 => h2.waitForExist())
      .then(exists => test.assert(exists, 'lists edition'))
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
