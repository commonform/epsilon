const has = require('has')
const runParallelLimit = require('run-parallel-limit')
const storage = require('./')

const universalValidations = [
  doesNotContainPassword
]

const typeSpecificValidations = {
  changeEMail: [handleExists],
  changePassword: [handleExists],
  confirmAccount: [handleExists],
  publication: [publicationDoesNotExist],
  session: [handleExists],
  useToken: [tokenExists]
}

module.exports = (entry, callback) => {
  const type = entry.type
  const validation = typeSpecificValidations[type]
  if (!validation) return setImmediate(callback)
  runParallelLimit(
    universalValidations
      .concat(validation)
      .map((validator) => (done) => {
        validator(entry, done)
      }),
    3,
    callback
  )
}

function doesNotContainPassword (entry, callback) {
  if (has(entry, 'password')) callback(new Error('entry contains password'))
  callback()
}

function handleExists (entry, callback) {
  storage.account.read(entry.handle, (error, account) => {
    if (error) return callback(error)
    if (!account) callback(new Error('no such handle'))
    callback()
  })
}

function tokenExists (entry, callback) {
  storage.token.read(entry.token, (error, data) => {
    if (error) return callback(error)
    if (!data) callback(new Error('no such token'))
    callback()
  })
}

function publicationDoesNotExist (entry, callback) {
  storage.publication.read({
    edition: entry.edition,
    project: entry.project,
    publisher: entry.publisher
  }, (error, data) => {
    if (error) return callback(error)
    if (data) return callback(new Error('publication exists'))
    callback()
  })
}
