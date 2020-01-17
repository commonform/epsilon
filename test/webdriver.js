const spawn = require('child_process').spawn
const tape = require('tape')
const webdriverio = require('webdriverio')

// See: https://webdriver.io/docs/runprogrammatically.html

const driver = spawn('geckodriver')

let remote

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
