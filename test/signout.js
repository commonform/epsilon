module.exports = (options, callback) => {
  const { browser, port } = options
  return browser.navigateTo('http://localhost:' + port + '/')
    .then(() => browser.$('#signout'))
    .then(element => element.click())
    .catch(callback)
}
