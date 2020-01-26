const mail = require('../mail')
const markdown = require('../util/markdown')

module.exports = ({ to, comment }, callback) => {
  const subject = 'Common Form Mention'
  const text = `
@${comment.handle} mentioned you in a comment on commonform.org.

To read their comment, visit https://commonform.org/comments/${comment.id}
  `.trim()
  const html = markdown(text)
  mail({ to, subject, text, html }, callback)
}
