module.exports = (options) => {
  return `
<p>
  <label for=email>E-Mail</label>
  <input
      name=email
      type=email
      value="${options.email || ''}"
      ${options.autofocus ? 'autofocus' : ''}
      required>
</p>
  `.trim()
}
