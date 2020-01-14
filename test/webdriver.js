var spawn = require('child_process').spawn
var tape = require('tape')
var webdriverio = require('webdriverio')

// See: https://webdriver.io/docs/runprogrammatically.html

var driver = spawn('geckodriver')

var remote

module.exports = function () {
  if (!remote) {
    remote = webdriverio.remote({
      logLevel: 'error',
      path: '/',
      capabilities: { browserName: 'firefox' }
    })
  }
  return remote
}

tape.onFinish(() => {
  if (remote) {
    remote
      .then((browser) => browser.deleteSession())
      .then(() => driver.kill())
  } else {
    driver.kill()
  }
})
