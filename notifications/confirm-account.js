const mail = require('../mail')
const markdown = require('../util/markdown')

module.exports = (options, callback) => {
  const { to, handle, url } = options
  const subject = 'Confirm Common Form Account'
  const text = `
To confirm "${handle}" account on commonform.org, visit this link:

${url}
  `.trim()
  const html = markdown(text)
  mail({ to, subject, text, html }, callback)
}
