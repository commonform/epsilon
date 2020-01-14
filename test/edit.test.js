var USER = require('./user')
var commonmark = require('commonform-commonmark')
var http = require('http')
var login = require('./login')
var normalize = require('commonform-normalize')
var runParellel = require('run-parallel')
var server = require('./server')
var tape = require('tape')
var webdriver = require('selenium-webdriver')

var path = '/edit'

var handle = USER.handle
var password = USER.password

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

tape.only('edit new form', (test) => {
  var markup = 'test form'
  var parsed = commonmark.parse(markup)
  var normalized = normalize(parsed.form)
  server(async (port, done) => {
    const driver = await new webdriver.Builder()
      .forBrowser('chrome')
      .build()
    try {
      const By = webdriver.By
      const Key = webdriver.Key
      const until = webdriver.until
      // Navigate to log-in page.
      await driver.get('http://localhost:' + port)
      const logInLink = await driver.wait(until.elementLocated(By.id('login')), 3000)
      await logInLink.click()
      test.pass('navigated to log-in form')
      // Submit log-in form.
      await new Promise((resolve) => setTimeout(resolve, 500))
      await Promise.all([
        driver.wait(until.elementLocated(By.name('handle')), 3000),
        driver.wait(until.elementLocated(By.name('password')), 3000)
      ])
      await driver.findElement(By.name('handle')).sendKeys(handle)
      await driver.findElement(By.name('password')).sendKeys(password)
      await driver.findElement(By.css('button')).click()
      test.pass('submitted log-in form')
      // Navigate to editor.
      await new Promise((resolve) => setTimeout(resolve, 500))
      const newFormLink = await driver.wait(until.elementLocated(By.id('newform')), 3000)
      await newFormLink.click()
      test.pass('navigated to editor')
      // Save form.
      await new Promise((resolve) => setTimeout(resolve, 500))
      const editor = await driver.wait(until.elementLocated(By.id('editor')), 3000)
      await editor.sendKeys(Key.CONTROL, 'a', Key.NULL, markup)
      await driver.findElement(By.css('*[type="submit"]')).click()
      test.pass('submitted form')
      var path = '/forms/' + normalized.root + '.json'
      await new Promise((resolve) => {
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
                resolve()
              })
          })
          .end()
      })
    } finally {
      driver.quit()
      done()
      test.end()
    }
  })
})

tape('edit existing form', (test) => {
  var markup = 'test form\n'
  var parsed = commonmark.parse(markup)
  var digest = normalize(parsed.form).root
  server((port, done) => {
    var browser
    webdriver()
      .then((loaded) => { browser = loaded })
      .then(() => saveForm({ markup, port, browser }))
      .then(() => browser.navigateTo('http://localhost:' + port + '/edit?digest=' + digest))
      .then(() => browser.$('#editor'))
      .then((textarea) => textarea.getValue())
      .then((value) => test.equal(value, markup, 'populates markup'))
      .then(finish)
      .catch((error) => {
        test.fail(error)
        finish()
      })
    function finish () {
      test.end()
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
      done()
    }
  })
})

function saveForm (options) {
  var markup = options.markup
  var port = options.port
  var browser = options.browser
  return login({ browser, port, handle, password })
    .then(() => browser.$('a=New Form'))
    .then((a) => a.click())
    .then(() => browser.$('#editor'))
    .then((input) => input.setValue(markup))
    .then(() => browser.$('button[type="submit"]'))
    .then((submit) => submit.click())
}

tape('save invalid markup', (test) => {
  var invalidMarkup = '<h1>invalid</h1>'
  server((port, done) => {
    var browser
    webdriver()
      .then((loaded) => { browser = loaded })
      .then(() => login({ browser, port, handle, password }))
      .then(() => browser.$('a=New Form'))
      .then((a) => a.click())
      .then(() => browser.$('#editor'))
      .then((input) => input.setValue(invalidMarkup))
      .then(() => browser.$('button[type="submit"]'))
      .then((submit) => submit.click())
      .then(() => browser.$('.error'))
      .then((element) => element.getText())
      .then((text) => test.assert(text.includes('markup'), 'markup error'))
      .then(finish)
      .catch((error) => {
        test.fail(error)
        finish()
      })
    function finish () {
      test.end()
      done()
    }
  })
})

tape('publish', (test) => {
  var markup = 'applesauce test'
  var project = 'test'
  var edition = '1e'
  server((port, done) => {
    var browser
    webdriver()
      .then((loaded) => { browser = loaded })
      .then(() => login({ browser, port, handle, password }))
      .then(() => browser.$('a=New Form'))
      .then((a) => a.click())
      .then(() => browser.$('#editor'))
      .then((input) => input.setValue(markup))
      .then(() => browser.$('input[name="project"]'))
      .then((input) => input.addValue(project))
      .then(() => browser.$('input[name="edition"]'))
      .then((input) => input.addValue(edition))
      .then(() => browser.$('button[type="submit"]'))
      .then((submit) => submit.click())
      .then(() => browser.navigateTo(
        'http://localhost:' + port + '/publications/' + [handle, project, edition].join('/')
      ))
      .then(() => browser.$('h2'))
      .then((h2) => h2.getText())
      .then((text) => test.equal(text, project + ' ' + edition, 'heading'))
      .then(finish)
      .catch((error) => {
        test.fail(error)
        finish()
      })
    function finish () {
      test.end()
      done()
    }
  })
})
