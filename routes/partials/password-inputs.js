var escapeHTML = require('escape-html')

module.exports = (label) => {
  label = label || 'Password'
  return `
<p>
  <label for=password>${escapeHTML(label)}</label>
  <input name=password type=password required autofocus autocomplete=off>
</p>
<p>
  <label for=repeat>Repeat</label>
  <input name=repeat type=password required autofocus autocomplete=off>
</p>
  `.trim()
}
