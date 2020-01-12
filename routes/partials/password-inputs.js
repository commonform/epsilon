var escape = require('../../util/escape')
var passwordCriteria = require('../password-criteria')

module.exports = (options) => {
  options = options || {}
  var label = options.label || 'Password'
  return `
<p>
  <label for=password>${escape(label)}</label>
  <input name=password type=password required autocomplete=off ${options.autofocus ? 'autofocus' : ''}>
</p>
<p>
  <label for=repeat>Repeat</label>
  <input name=repeat type=password required autocomplete=off>
</p>
<p>${escape(passwordCriteria.explanation)}</p>
  `.trim()
}
