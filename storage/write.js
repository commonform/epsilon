var TOKEN_LIFETIME = require('../constants/token-lifetime')
var async = require('async')
var expired = require('../util/expired')
var has = require('has')
var hashPassword = require('../util/hash-password')
var normalize = require('commonform-normalize')
var runSeries = require('run-series')
var storage = require('./')
var uuid = require('uuid')

var writers = {
  confirmAccount,
  changeEMail,
  changePassword,
  form,
  publication,
  confirmAccountToken,
  changeEMailToken,
  resetPasswordToken,
  session,
  useToken,
  account
}

module.exports = (entry, callback) => {
  var type = entry.type
  var writer = writers[type]
  if (!writer) return callback(new Error('no writer for type' + type))
  writer(entry, callback)
}

function form (entry, callback) {
  var form = entry.form
  var forms = mapAllForms(form)
  var queue = async.queue((task, done) => {
    storage.form.write(task.digest, task.form, done)
  }, 3)
  queue.drain(callback)
  Object.keys(forms).map((digest) => {
    queue.push({ digest, form: forms[digest] })
  })
}

function mapAllForms (form) {
  var forms = {}
  var normalized = normalize(form)
  recurse(form, normalized.root, normalized)
  return forms
  function recurse (form, digest, normalized) {
    forms[digest] = form
    form.content.forEach((element, index) => {
      if (has(element, 'form')) {
        var child = element.form
        var childDigest = normalized[digest].content[index].digest
        recurse(child, childDigest, normalized)
      }
    })
  }
}

function publication (entry, callback) {
  var edition = entry.edition
  var project = entry.project
  var publisher = entry.publisher
  var id = { publisher, project, edition }

  var digest = entry.digest
  var date = new Date().toISOString()
  var record = { digest, date }

  storage.publication.create(id, record, callback)
}

function account (entry, callback) {
  var handle = entry.handle
  var email = entry.email
  var password = entry.password
  var created = new Date().toISOString()
  var confirmed = false
  hashPassword(password, (error, passwordHash) => {
    if (error) return callback(error)
    var record = { handle, email, passwordHash, created, confirmed }
    runSeries([
      (done) => { storage.account.create(handle, record, done) },
      (done) => { storage.email.append(email, handle, done) }
    ], callback)
  })
}

function confirmAccount (entry, callback) {
  var handle = entry.handle
  storage.account.confirm(handle, callback)
}

function changeEMail (entry, callback) {
  var handle = entry.handle
  var email = entry.email
  var oldEMail
  runSeries([
    (done) => {
      storage.account.read(handle, (error, account) => {
        if (error) return done(error)
        oldEMail = account.email
        done()
      })
    },
    (done) => storage.account.update(handle, { email }, done),
    (done) => storage.email.remove(oldEMail, handle, done),
    (done) => storage.email.append(email, handle, done)
  ], callback)
}

function changePassword (entry, callback) {
  var handle = entry.handle
  var password = entry.password
  hashPassword(password, (error, passwordHash) => {
    if (error) return callback(error)
    storage.account.update(handle, { passwordHash }, callback)
  })
}

function confirmAccountToken (entry, callback) {
  var created = entry.created
  if (expired(created, TOKEN_LIFETIME)) return callback()
  var token = entry.token
  var handle = entry.handle
  var tokenData = { action: 'confirm', created, handle }
  storage.token.create(token, tokenData, callback)
}

function changeEMailToken (entry, callback) {
  var created = entry.created
  if (expired(created, TOKEN_LIFETIME)) return callback()
  var handle = entry.handle
  var token = entry.token
  var email = entry.email
  var tokenData = { action: 'email', created, handle, email }
  storage.token.create(token, tokenData, callback)
}

function resetPasswordToken (entry, callback) {
  var created = entry.created
  if (expired(created, TOKEN_LIFETIME)) return callback()
  var token = entry.token
  var handle = entry.handle
  var tokenData = { action: 'reset', created, handle }
  storage.token.create(token, tokenData, callback)
}

function useToken (entry, callback) {
  storage.token.use(entry.token, callback)
}

function session (entry, callback) {
  var handle = entry.handle
  var id = uuid.v4()
  var created = new Date().toISOString()
  storage.session.create(id, { handle, created }, (error, success) => {
    if (error) return callback(error)
    if (!success) return callback(new Error('session collision'))
    callback(null, id)
  })
}
