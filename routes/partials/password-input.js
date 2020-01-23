const escape = require('../../util/escape')
const html = require('../html')
const passwordValidator = require('../../validators/password')

module.exports = options => {
  options = options || {}
  const label = options.label || 'Password'
  return html`
<p>
  <label for=password>${escape(label)}</label>
  <input
      name=password
      type=password
      required
      autocomplete=off
      ${options.autofocus ? 'autofocus' : ''}>
</p>
<p>${escape(passwordValidator.html)}</p>
  `
}
