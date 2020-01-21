module.exports = options => {
  const { port, browser, digest, project, edition } = options
  return browser.navigateTo('http://localhost:' + port + '/forms/' + digest)
    // Publish.
    .then(() => addValue('input[name="project"]', project))
    .then(() => addValue('input[name="edition"]', edition))
    .then(() => click('#publishForm button[type="submit"]'))
    .then(() => click('#publishForm button[type="submit"]'))

  function addValue (selector, value) {
    return browser.$(selector)
      .then(element => element.waitForEnabled())
      .then(() => browser.$(selector))
      .then(element => element.addValue(value))
  }

  function click (selector) {
    return browser.$(selector)
      .then(element => element.waitForClickable())
      .then(() => browser.$(selector))
      .then(element => element.click())
  }
}
