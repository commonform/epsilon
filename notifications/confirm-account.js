const mail = require('../mail')
const markdown = require('../util/markdown')

module.exports = ({ to, handle, url }, callback) => {
  const subject = 'Confirm Common Form Account'
  const text = `
To confirm "${handle}" account on commonform.org, visit this link:

${url}
  `.trim()
  const html = markdown(text)
  mail({ to, subject, text, html }, callback)
}
