const html = require('../html')
const passwordValidator = require('../../validators/password')

module.exports = () => {
  return html`
<p>
  <label for=repeat>Repeat</label>
  <input
      name=repeat
      type=password
      pattern="${passwordValidator.pattern}"
      required
      autocomplete=off>
</p>
  `
}
