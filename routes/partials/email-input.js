var escape = require('../../util/escape')

module.exports = (options) => {
  return `
<p>
  <label for=email>E-Mail</label>
  <input
      name=email
      type=email
      value="${escape(options.value) || ''}"
      ${options.autofocus ? 'autofocus' : ''}
      required>
</p>
  `.trim()
}
