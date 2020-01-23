const MESSAGE_TYPES = require('../constants/message-types')
const arrayEqual = require('array-equal')
const assert = require('assert')
const has = require('has')
const indexes = require('./')
const normalize = require('commonform-normalize')
const runParallelLimit = require('run-parallel-limit')

const universalValidations = [
  doesNotContainPassword
]

const typeSpecificValidations = {
  account: [handleDoesNotExist, eMailDoesNotHaveAccount],
  comment: [formExists, formInContext, validReply],
  changeEMail: [handleExists],
  changePassword: [handleExists],
  confirmAccount: [handleExists],
  lockAccount: [handleExists],
  publication: [formExists, publicationDoesNotExist],
  session: [handleExists],
  useToken: [tokenExists]
}

Object.keys(typeSpecificValidations).forEach(key => {
  assert(MESSAGE_TYPES.includes(key), 'Unknown Message Type: ' + key)
})

module.exports = (entry, callback) => {
  const type = entry.type
  const validation = typeSpecificValidations[type]
  if (!validation) return setImmediate(callback)
  runParallelLimit(
    universalValidations
      .concat(validation)
      .map(validator => done => {
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
  indexes.account.exists(entry.handle, (error, exists) => {
    if (error) return callback(error)
    if (!exists) callback(new Error('no such handle'))
    callback()
  })
}

function handleDoesNotExist (entry, callback) {
  indexes.account.exists(entry.handle, (error, exists) => {
    if (error) return callback(error)
    const handleTaken = new Error('handle taken')
    handleTaken.handleTaken = true
    handleTaken.statusCode = 401
    handleTaken.fieldName = 'handle'
    if (exists) return callback(handleTaken)
    callback()
  })
}

function tokenExists (entry, callback) {
  indexes.token.exists(entry.token, (error, exists) => {
    if (error) return callback(error)
    if (!exists) callback(new Error('no such token'))
    callback()
  })
}

function publicationDoesNotExist (entry, callback) {
  indexes.publication.exists({
    edition: entry.edition,
    project: entry.project,
    publisher: entry.publisher
  }, (error, exists) => {
    if (error) return callback(error)
    if (exists) {
      const exists = new Error('publication already exists')
      exists.exists = true
      exists.statusCode = 401
      return callback(exists)
    }
    callback()
  })
}

function formExists (entry, callback) {
  indexes.form.exists(entry.form, (error, exists) => {
    if (error) return callback(error)
    if (!exists) return callback(new Error('no such form'))
    callback()
  })
}

function formInContext (entry, callback) {
  if (entry.context === entry.form) return callback()
  indexes.form.read(entry.context, (error, context) => {
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
  indexes.comment.read(parentID, (error, parent) => {
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

function eMailDoesNotHaveAccount (entry, callback) {
  indexes.email.read(entry.email, (error, handle) => {
    if (error) return callback(error)
    if (!handle) return callback()
    const hasAccount = new Error('e-mail address has an account')
    hasAccount.hasAccount = true
    hasAccount.statusCode = 401
    hasAccount.fieldName = 'email'
    callback(hasAccount)
  })
}
