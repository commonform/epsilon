const html = require('../html')

module.exports = session => {
  const handle = session && session.handle
  return html`
<nav role=navigation>
  ${!handle && '<a id=signin class=button href=/signin>Sign In</a>'}
  ${!handle && '<a id=signup class=button href=/signup>Sign Up</a>'}
  ${handle && '<a id=edit class=button href=/edit>New Form</a>'}
  ${handle && signoutButton()}
  ${handle && '<a id=account class=button href=/account>Account</a>'}
</nav>
  `
}

function signoutButton () {
  return html`
<form id=signoutForm action=/signout method=post>
  <button id=signout type=submit>Sign Out</button>
</form>
  `
}
