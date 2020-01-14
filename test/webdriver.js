var webdriverio = require('webdriverio')

// See: https://webdriver.io/docs/runprogrammatically.html

var remote = webdriverio.remote({
  logLevel: 'error',
  host: 'localhost',
  port: 9515,
  path: '/',
  capabilities: { browserName: 'chrome' }
})

module.exports = function () {
  return remote
}
