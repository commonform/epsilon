const ANA = require('./ana')
const commonmark = require('commonform-commonmark')
const http = require('http')
const signin = require('./signin')
const normalize = require('commonform-normalize')
const runParellel = require('run-parallel')
const saveForm = require('./save-form')
const server = require('./server')
const tape = require('tape')
const webdriver = require('./webdriver')

const path = '/edit'

const handle = ANA.handle
const password = ANA.password

tape('GET ' + path, test => {
  server((port, done) => {
    http.request({ path, port })
      .once('response', response => {
        test.equal(response.statusCode, 303, '303')
        test.end()
        done()
      })
      .end()
  })
})

tape('edit new form', test => {
  const markup = 'test form'
  const parsed = commonmark.parse(markup)
  const normalized = normalize(parsed.form)
  server((port, done) => {
    let browser
    webdriver()
      .then(loaded => { browser = loaded })
      .then(() => saveForm({ markup, port, browser, handle, password }))
      .then(() => browser.$('=test form'))
      .then(p => {
        test.assert(p, 'text appears')
        const path = '/forms/' + normalized.root + '.json'
        http.request({ port, path })
          .once('response', response => {
            test.equal(response.statusCode, 200, '200')
            const chunks = []
            response
              .on('data', chunk => { chunks.push(chunk) })
              .once('end', () => {
                const buffer = Buffer.concat(chunks)
                try {
                  var received = JSON.parse(buffer)
                } catch (error) {
                  test.ifError(error, 'JSON parse')
                }
                test.deepEqual(received, parsed.form, 'form as JSON')
                finish()
              })
          })
          .end()
      })
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

tape('edit existing form', test => {
  const markup = 'test form\n'
  const parsed = commonmark.parse(markup)
  const digest = normalize(parsed.form).root
  server((port, done) => {
    let browser
    webdriver()
      .then(loaded => { browser = loaded })
      .then(() => saveForm({ markup, port, browser, handle, password }))
      .then(() => browser.navigateTo('http://localhost:' + port + '/edit?digest=' + digest))
      .then(() => browser.$('#editor'))
      .then(textarea => textarea.getValue())
      .then(value => test.equal(value, markup, 'populates markup'))
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

tape('save nested form', test => {
  const markup = '# A\n\nA\n\n# B\n\nB\n'
  const parsed = commonmark.parse(markup)
  const normalized = normalize(parsed.form)
  const digests = Object.keys(normalized).filter(k => k !== 'root')
  server((port, done) => {
    let browser
    webdriver()
      .then(loaded => { browser = loaded })
      .then(() => saveForm({ markup, port, browser, handle, password }))
      .then(() => {
        runParellel(
          digests.map(digest => done => {
            const path = '/forms/' + digest + '.json'
            http.request({ port, path })
              .once('response', response => {
                test.equal(response.statusCode, 200, '200')
                done()
              })
              .end()
          }),
          finish
        )
      })
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

tape('save invalid markup', test => {
  const invalidMarkup = '<h1>invalid</h1>'
  server((port, done) => {
    let browser
    webdriver()
      .then(loaded => { browser = loaded })
      .then(() => signin({ browser, port, handle, password }))
      .then(() => new Promise(resolve => {
        setTimeout(resolve, 1000)
      }))
      .then(() => browser.$('a=New Form'))
      .then(a => a.click())
      .then(() => browser.$('#editor'))
      .then(input => input.setValue(invalidMarkup))
      .then(() => browser.$('#editForm button[type="submit"]'))
      .then(submit => submit.click())
      .then(() => browser.$('.error'))
      .then(element => element.getText())
      .then(text => test.assert(text.includes('markup'), 'markup error'))
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
