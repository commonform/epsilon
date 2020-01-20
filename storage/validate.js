const arrayEqual = require('array-equal')
const has = require('has')
const normalize = require('commonform-normalize')
const runParallelLimit = require('run-parallel-limit')
const storage = require('./')

const universalValidations = [
  doesNotContainPassword
]

const typeSpecificValidations = {
  comment: [formExists, formInContext, validReply],
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

function formExists (entry, callback) {
  storage.form.read(entry.form, (error, data) => {
    if (error) return callback(error)
    if (!data) return callback(new Error('no such form'))
    callback()
  })
}

function formInContext (entry, callback) {
  if (entry.context === entry.form) return callback()
  storage.form.read(entry.context, (error, context) => {
    if (error) return callback(error)
    const normalized = normalize(context)
    const digests = Object.keys(normalized)
    if (!digests.includes(entry.form)) {
      return callback(new Error('form not in context'))
    }
    callback()
  })
}

function validReply (entry, callback) {
  if (entry.replyTo.length === 0) return callback()
  const parentID = entry.replyTo[0]
  storage.entry.read(parentID, (error, parent) => {
    if (error) return callback(error)
    var isReply = (
      entry.context === parent.context &&
      entry.form === parent.form &&
      arrayEqual(entry.replyTo.slice(1), parent.replyTo)
    )
    if (!isReply) {
      return callback(new Error('does not match parent'))
    }
    callback()
  })
}
