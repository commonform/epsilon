module.exports = (session) => {
  var handle = session && session.handle
  return `
    <nav role=navigation>
      <ul>
        ${!handle ? '<li><a href=/login>Log In</a></li>' : ''}
        ${!handle ? '<li><a href=/signup>Sign Up</a></li>' : ''}
        ${handle ? '<li><a href=/edit>Edit</a></li>' : ''}
        ${handle ? '<li><a href=/logout>Log Out</a></li>' : ''}
        ${handle ? '<li><a href=/account>Account</a></li>' : ''}
      </ul>
    </nav>
  `.trim()
}
