var authenticate = require('./authenticate')
var escapeHTML = require('escape-html')

module.exports = (request, response) => {
  authenticate(request, response, () => {
    var handle = request.session && request.session.handle
    response.end(`
<!doctype html>
<html lang=en-US>
  <head>
    <meta charset=UTF-8>
    <title>Common Form</title>
  </head>
  <body>
    <header role=banner>
      <h1>Common Form</h1>
    </header>
    <nav role=navigation>
      <ul>
        ${handle ? '<li><a href=/logout>Log Out</a></li>' : ''}
        ${!handle ? '<li><a href=/login>Log In</a></li>' : ''}
        ${!handle ? '<li><a href=/signup>Sign Up</a></li>' : ''}
      </ul>
    </nav>
    <main role=main>
      ${welcome()}
    </main>
  </body>
</html>
    `.trim())

    function welcome () {
      if (!request.session) return ''
      return `<p class=welcome>Welcome, ${escapeHTML(request.session.handle)}</p>`
    }
  })
}
