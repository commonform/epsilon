const NDA = require('./nda')
const server = require('./server')
const tape = require('tape')
const webdriver = require('./webdriver')

tape('browse NDA', test => {
  server((port, done) => {
    let browser
    webdriver()
      .then(loaded => { browser = loaded })
      .then(() => browser.navigateTo('http://localhost:' + port + '/forms/' + NDA.digest))
      .then(() => browser.$('=Mutual Nondisclosure'))
      .then(element => test.assert(element, 'Mutual Nondisclosure'))
      .then(() => browser.$('=Entire Agreement'))
      .then(element => test.assert(element, 'Entire Agreement'))
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
