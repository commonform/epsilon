var commonmark = require('commonform-commonmark')
var http = require('http')
var login = require('./login')
var merkleize = require('commonform-merkleize')
var promisify = require('util').promisify
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
  var handle = 'tester'
  var email = 'test@example.com'
  var password = 'test password'
  var markup = 'test form'
  var parsed = commonmark.parse(markup)
  var merkle = merkleize(parsed.form)
  server((port, done) => {
    var browser
    webdriver()
      .then((loaded) => { browser = loaded })
      .then(() => browser.setTimeouts(1000))
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
      .then(() => browser.$('=test form'))
      .then((p) => {
        test.assert(p, 'text appears')
        var path = '/forms/' + merkle.digest + '.json'
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
