const mail = require('../mail')
const markdown = require('../util/markdown')

module.exports = ({ to, handle }, callback) => {
  const subject = 'Common Form Handle Reminder'
  const text = `
The e-mail address ${to} has the handle "${handle}" on commonform.org
  `.trim()
  const html = markdown(text)
  mail({ to, subject, text, html }, callback)
}
