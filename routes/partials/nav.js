module.exports = (session) => {
  const handle = session && session.handle
  return `
<nav role=navigation>
  ${!handle ? '<a class=button href=/login>Log In</a>' : ''}
  ${!handle ? '<a class=button href=/signup>Sign Up</a>' : ''}
  ${handle ? '<a class=button href=/edit>New Form</a>' : ''}
  ${handle ? '<a class=button href=/logout>Log Out</a>' : ''}
  ${handle ? '<a class=button href=/account>Account</a>' : ''}
</nav>
  `.trim()
}
