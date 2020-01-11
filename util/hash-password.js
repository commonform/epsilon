var passwordHashing = require('./password-hashing')

module.exports = (password, callback) => {
  var passwordBuffer = Buffer.from(password)
  passwordHashing.hash(passwordBuffer, (error, hashBuffer) => {
    if (error) return callback(error)
    callback(null, hashBuffer.toString('hex'))
  })
}
