var commonmark = require('commonform-commonmark')
var http = require('http')
var login = require('./login')
var normalize = require('commonform-normalize')
var promisify = require('util').promisify
var runParellel = require('run-parallel')
var server = require('./server')
var signup = promisify(require('./signup'))
var tape = require('tape')
var webdriver = require('./webdriver')

var path = '/edit'

tape('GET ' + path, (test) => {
  server((port, done) => {
    http.request({ path, port })
      .once('response', (response) => {
        test.equal(response.statusCode, 302, '302')
        test.end()
        done()
      })
      .end()
  })
})

tape('edit new form', (test) => {
  var markup = 'test form'
  var parsed = commonmark.parse(markup)
  var normalized = normalize(parsed.form)
  server((port, done) => {
    var browser
    webdriver()
      .then((loaded) => { browser = loaded })
      .then(() => browser.setTimeouts(1000))
      .then(() => saveForm({ markup, port, browser }))
      .then(() => browser.$('=test form'))
      .then((p) => {
        test.assert(p, 'text appears')
        var path = '/forms/' + normalized.root + '.json'
        http.request({ port, path })
          .once('response', (response) => {
            test.equal(response.statusCode, 200, '200')
            var chunks = []
            response
              .on('data', (chunk) => { chunks.push(chunk) })
              .once('end', () => {
                var buffer = Buffer.concat(chunks)
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
      .catch((error) => {
        test.fail(error)
        finish()
      })
    function finish () {
      test.end()
      browser.deleteSession()
      done()
    }
  })
})

tape('save nested form', (test) => {
  var markup = '# A\n\nA\n\n# B\n\nB\n'
  var parsed = commonmark.parse(markup)
  var normalized = normalize(parsed.form)
  var digests = Object.keys(normalized).filter((k) => k !== 'root')
  server((port, done) => {
    var browser
    webdriver()
      .then((loaded) => { browser = loaded })
      .then(() => browser.setTimeouts(1000))
      .then(() => saveForm({ markup, port, browser }))
      .then(() => {
        runParellel(
          digests.map((digest) => (done) => {
            var path = '/forms/' + digest + '.json'
            http.request({ port, path })
              .once('response', (response) => {
                test.equal(response.statusCode, 200, '200')
                done()
              })
              .end()
          }),
          finish
        )
      })
      .catch((error) => {
        test.fail(error)
        finish()
      })
    function finish () {
      test.end()
      browser.deleteSession()
      done()
    }
  })
})

function saveForm (options) {
  var markup = options.markup
  var port = options.port
  var browser = options.browser
  var handle = 'tester'
  var email = 'test@example.com'
  var password = 'test password'
  return browser.setTimeouts(1000)
    .then(() => signup({
      browser, port, handle, email, password
    }))
    .then(() => login({ browser, port, handle, password }))
    .then(() => browser.$('a=Edit'))
    .then((a) => a.click())
    .then(() => browser.$('#editor'))
    .then((input) => input.setValue(markup))
    .then(() => browser.$('button[type="submit"]'))
    .then((submit) => submit.click())
}
