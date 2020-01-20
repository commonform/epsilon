const escape = require('../../util/escape')
const html = require('../html')

module.exports = options => {
  return html`
<p>
  <label for=email>E-Mail</label>
  <input
      name=email
      type=email
      value="${escape(options.value) || ''}"
      ${options.autofocus ? 'autofocus' : ''}
      required>
</p>
  `
}
