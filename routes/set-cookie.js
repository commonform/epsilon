const cookie = require('cookie')

module.exports = function (response, value, expires) {
  response.setHeader(
    'Set-Cookie',
    cookie.serialize('commonform', value, {
      expires,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV !== 'test'
    })
  )
}
