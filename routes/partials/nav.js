const csrf = require('../../util/csrf')
const html = require('../html')

module.exports = request => {
  const account = request.account
  const handle = account && account.handle
  return html`
<nav role=navigation>
  ${!handle && '<a id=signin class=button href=/signin>Sign In</a>'}
  ${!handle && '<a id=signup class=button href=/signup>Sign Up</a>'}
  ${handle && '<a id=edit class=button href=/edit>New Form</a>'}
  ${handle && signoutButton(request)}
  ${handle && '<a id=account class=button href=/account>Account</a>'}
</nav>
  `
}

function signoutButton (request) {
  const csrfInputs = csrf.inputs({
    action: '/signout',
    sessionID: request.session.id
  })
  return html`
<form id=signoutForm action=/signout method=post>
  ${csrfInputs}
  <button id=signout type=submit>Sign Out</button>
</form>
  `
}
