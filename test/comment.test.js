const USER = require('./user')
const commonmark = require('commonform-commonmark')
const normalize = require('commonform-normalize')
const saveForm = require('./save-form')
const server = require('./server')
const tape = require('tape')
const webdriver = require('./webdriver')

const handle = USER.handle
const password = USER.password

tape('comment', test => {
  const markup = `
# First
This is the first child.

# Second
This is the second child.
  `.trim()
  const form = commonmark.parse(markup).form
  const normalized = normalize(form)
  const parentDigest = normalized.root
  const firstChildDigest = normalized[parentDigest].content[0].digest
  const comment = 'test comment'
  server((port, done) => {
    let browser
    webdriver()
      .then(loaded => { browser = loaded })
      .then(() => saveForm({ markup, port, browser, handle, password }))
      .then(() => browser.$('.commentButton'))
      .then(button => button.waitForDisplayed())
      .then(() => browser.$('.commentButton'))
      .then(button => button.click())
      // Add comment.
      .then(() => browser.$('.commentForm textarea[name="text"]'))
      .then(ta => ta.addValue(comment))
      .then(() => browser.$('.commentForm button[type="submit"]'))
      .then(button => button.click())
      // Browse the parent form.
      .then(() => browser.navigateTo('http://localhost:' + port + '/forms/' + parentDigest))
      // Verify the comment appears on the form.
      .then(() => browser.$('aside.comment'))
      .then(element => element.waitForExist())
      .then(() => browser.$('aside.comment p'))
      .then(p => p.getText())
      .then(text => { test.equal(text, comment) })
      // Browse the child form.
      .then(() => browser.navigateTo('http://localhost:' + port + '/forms/' + firstChildDigest))
      // Verify the comment appears on the child form.
      .then(() => browser.$('aside.comment'))
      .then(element => element.waitForExist())
      .then(() => browser.$('aside.comment p'))
      .then(p => p.getText())
      .then(text => { test.equal(text, comment) })
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
