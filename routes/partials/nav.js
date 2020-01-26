const html = require('../html')

module.exports = session => {
  const handle = session && session.handle
  return html`
<nav role=navigation>
  ${!handle && '<a id=login class=button href=/login>Log In</a>'}
  ${!handle && '<a id=signup class=button href=/signup>Sign Up</a>'}
  ${handle && '<a id=edit class=button href=/edit>New Form</a>'}
  ${handle && logoutButton()}
  ${handle && '<a id=account class=button href=/account>Account</a>'}
</nav>
  `
}

function logoutButton () {
  return html`
<form id=logoutForm action=/logout method=post>
  <button id=logout type=submit>Log Out</button>
</form>
  `
}
