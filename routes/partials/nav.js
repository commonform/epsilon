module.exports = (session) => {
  var handle = session && session.handle
  return `
    <nav role=navigation>
      ${!handle ? '<a id=login class=button href=/login>Log In</a>' : ''}
      ${!handle ? '<a id=signup class=button href=/signup>Sign Up</a>' : ''}
      ${handle ? '<a id=newform class=button href=/edit>New Form</a>' : ''}
      ${handle ? '<a id=logout class=button href=/logout>Log Out</a>' : ''}
      ${handle ? '<a id=account class=button href=/account>Account</a>' : ''}
    </nav>
  `.trim()
}
