const mail = require('../mail')
const markdown = require('../util/markdown')

module.exports = (options, callback) => {
  const { to, handle } = options
  const subject = 'Common Form Password Change'
  const text = `
The password for your "${handle}" account on commonform.org was changed.
  `.trim()
  const html = markdown(text)
  mail({ to, subject, text, html }, callback)
}
