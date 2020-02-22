const ANA = require('./ana')
const BOB = require('./bob')
const commonmark = require('commonform-commonmark')
const normalize = require('commonform-normalize')
const saveForm = require('./save-form')
const server = require('./server')
const signout = require('./signout')
const tape = require('tape')
const webdriver = require('./webdriver')

tape('compare', test => {
  const first = '# Heading\n\nThis is the first form.'
  const firstForm = commonmark.parse(first).form
  const firstDigest = normalize(firstForm).root
  const second = '# Heading\n\nThis is the second form.'
  const secondForm = commonmark.parse(second).form
  const secondDigest = normalize(secondForm).root
  server((port, done) => {
    let browser
    webdriver()
      .then(loaded => { browser = loaded })
      .then(() => saveForm({
        markup: first,
        port,
        browser,
        handle: ANA.handle,
        password: ANA.password
      }))
      .then(() => browser.$('.commentButton'))
      .then(button => button.waitForDisplayed())
      .then(() => signout({ browser, port }))
      .then(() => saveForm({
        markup: second,
        port,
        browser,
        handle: BOB.handle,
        password: BOB.password
      }))
      .then(() => browser.$('.commentButton'))
      .then(button => button.waitForDisplayed())
      .then(() => signout({ browser, port }))
      // Browse the comparison.
      .then(() => browser.navigateTo(
        'http://localhost:' + port +
        '/compare?from=' + firstDigest + '&to=' + secondDigest
      ))
      .then(() => browser.$('ins'))
      .then((ins) => ins.getText())
      .then((text) => test.assert(text.includes('second'), '<ins> has "second"'))
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
