var NDA = require('./nda')
var server = require('./server')
var tape = require('tape')
var webdriver = require('./webdriver')

tape('browse NDA', (test) => {
  server((port, done) => {
    var browser
    webdriver()
      .then((loaded) => { browser = loaded })
      .then(() => browser.navigateTo('http://localhost:' + port + '/forms/' + NDA.digest))
      .then(() => browser.$('=Mutual Nondisclosure'))
      .then((element) => test.assert(element, 'Mutual Nondisclosure'))
      .then(() => browser.$('=Entire Agreement'))
      .then((element) => test.assert(element, 'Entire Agreement'))
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
