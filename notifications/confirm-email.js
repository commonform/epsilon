const mail = require('../mail')
const markdown = require('../util/markdown')

module.exports = (options, callback) => {
  const { to, url } = options
  const subject = 'Confirm E-Mail Change'
  const text = `
To confirm the new e-mail address for your account on commonform.org, follow this link:

${url}
  `.trim()
  const html = markdown(text)
  mail({ to, subject, text, html }, callback)
}
