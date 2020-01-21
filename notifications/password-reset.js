const mail = require('../mail')
const markdown = require('../util/markdown')

module.exports = (options, callback) => {
  const { to, handle, url } = options
  const subject = 'Common Form Password Reset'
  const text = `
To reset the password for your "${handle}" account on commonform.org, visit this link:

${url}
  `.trim()
  const html = markdown(text)
  mail({ to, subject, text, html }, callback)
}
