const passwordHashing = require('./password-hashing')
const securePassword = require('secure-password')
const storage = require('../storage')

module.exports = (handle, password, callback) => {
  const file = storage.account.filePath(handle)
  storage.lock(file, unlock => {
    callback = unlock(callback)
    storage.account.readWithoutLocking(handle, function (error, account) {
      if (error) {
        error.statusCode = 500
        return callback(error)
      }
      if (account === null || account.confirmed === false) {
        const invalid = new Error('invalid handle or password')
        invalid.statusCode = 401
        return callback(invalid)
      }
      const passwordHash = Buffer.from(account.passwordHash, 'hex')
      const passwordBuffer = Buffer.from(password, 'utf8')
      passwordHashing.verify(
        passwordBuffer, passwordHash, (error, result) => {
          if (error) {
            error.statusCode = 500
            return callback(error)
          }
          switch (result) {
            case securePassword.INVALID_UNRECOGNIZED_HASH:
              var unrecognized = new Error('unrecognized hash')
              unrecognized.statusCode = 500
              return callback(unrecognized)
            case securePassword.INVALID:
              var invalid = new Error('invalid password')
              invalid.statusCode = 403
              return callback(invalid)
            case securePassword.VALID_NEEDS_REHASH:
              return passwordHashing.hash(passwordBuffer, (error, newHash) => {
                if (error) {
                  error.statusCode = 500
                  return callback(error)
                }
                account.passwordHash = newHash.toString('hex')
                storage.account.writeWithoutLocking(handle, account, callback)
              })
            case securePassword.VALID:
              return callback(null)
            default:
              var otherError = new Error(
                'unexpected password hash result: ' + result
              )
              otherError.statusCode = 500
              return callback(otherError)
          }
        }
      )
    })
  })
}
