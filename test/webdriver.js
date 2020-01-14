var path = require('path')
var spawn = require('child_process').spawn
var tape = require('tape')
var webdriverio = require('webdriverio')

// See: https://webdriver.io/docs/runprogrammatically.html

var chromedriver = spawn(
  path.join(__dirname, '..', 'node_modules', '.bin', 'chromedriver')
)

var remote

module.exports = function () {
  if (!remote) {
    remote = webdriverio.remote({
      logLevel: 'error',
      host: 'localhost',
      port: 9515,
      path: '/',
      capabilities: { browserName: 'chrome' }
    })
  }
  return remote
}

tape.onFinish(() => {
  remote
    .then((browser) => browser.deleteSession())
    .then(() => chromedriver.kill())
})
