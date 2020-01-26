const ANA = require('./ana')
const BOB = require('./bob')
const commonmark = require('commonform-commonmark')
const signin = require('./signin')
const signout = require('./signout')
const mail = require('../mail').events
const normalize = require('commonform-normalize')
const saveForm = require('./save-form')
const server = require('./server')
const tape = require('tape')
const webdriver = require('./webdriver')

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
      .then(() => saveForm({
        markup,
        port,
        browser,
        handle: ANA.handle,
        password: ANA.password
      }))
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

tape('reply', test => {
  const markup = 'form content'
  const form = commonmark.parse(markup).form
  const normalized = normalize(form)
  const digest = normalized.root
  server((port, done) => {
    let browser
    webdriver()
      .then(loaded => { browser = loaded })
      .then(() => signin({
        browser,
        port,
        handle: ANA.handle,
        password: ANA.password
      }))
      // Save form.
      .then(() => browser.$('=New Form'))
      .then(a => a.click())
      .then(() => browser.$('#editor'))
      .then(input => input.setValue(markup))
      .then(() => browser.$('#editForm button[type="submit"]'))
      .then(submit => submit.click())
      // Add comment.
      .then(() => browser.$('.commentButton'))
      .then(button => button.waitForDisplayed())
      .then(() => browser.$('.commentButton'))
      .then(button => button.click())
      .then(() => browser.$('.commentForm textarea[name="text"]'))
      .then(ta => ta.addValue('first comment'))
      .then(() => browser.$('.commentForm button[type="submit"]'))
      .then(button => button.click())
      // Sign out.
      .then(() => signout({ browser, port }))
      // Sign in as Bob.
      .then(() => signin({
        browser,
        port,
        handle: BOB.handle,
        password: BOB.password
      }))
      .then(() => browser.navigateTo('http://localhost:' + port + '/forms/' + digest))
      // Await e-mail notification.
      .then(() => {
        mail.once('sent', options => {
          test.equal(options.to, ANA.email, 'TO: Ana')
          test.assert(options.text.includes('replied'), 'replied')
          test.assert(options.text.includes('@' + BOB.handle), 'Bob')
          test.assert(options.text.includes('/comments/'), 'link')
          finish()
        })
      })
      // Add reply.
      .then(() => browser.$('.commentButton'))
      .then(button => button.waitForDisplayed())
      .then(() => browser.$('.commentButton'))
      .then(button => button.click())
      .then(() => browser.$('.commentForm textarea[name="text"]'))
      .then(ta => ta.addValue('first reply'))
      .then(() => browser.$('.commentForm button[type="submit"]'))
      .then(button => button.click())
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
