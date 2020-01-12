var escapeHTML = require('escape-html')

module.exports = (options) => {
  options = options || {}
  var label = options.label || 'Password'
  return `
<p>
  <label for=password>${escapeHTML(label)}</label>
  <input name=password type=password required autocomplete=off ${options.autofocus ? 'autofocus' : ''}>
</p>
<p>
  <label for=repeat>Repeat</label>
  <input name=repeat type=password required autocomplete=off>
</p>
  `.trim()
}
