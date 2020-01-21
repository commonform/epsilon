module.exports = (options, callback) => {
  const { browser, port } = options
  return browser.navigateTo('http://localhost:' + port + '/logout')
    .then(() => browser.$('=Log In'))
    .then(element => element.waitForExist())
    .catch(callback)
}
