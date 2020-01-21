const TOKEN_LIFETIME = require('../constants/token-lifetime')
const async = require('async')
const expired = require('../util/expired')
const has = require('has')
const normalize = require('commonform-normalize')
const runSeries = require('run-series')
const storage = require('./')

const writers = {
  confirmAccount,
  changeEMail,
  changePassword,
  comment,
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
  const type = entry.type
  const writer = writers[type]
  if (!writer) return callback(new Error('no writer for type' + type))
  writer(entry, callback)
}

function form (entry, callback) {
  const form = entry.form
  const forms = mapAllForms(form)
  const queue = async.queue((task, done) => {
    storage.form.write(task.digest, task.form, done)
  }, 3)
  queue.error((error, _) => {
    queue.kill()
    callback(error)
  })
  queue.drain(callback)
  Object.keys(forms).map(digest => {
    queue.push({ digest, form: forms[digest] })
  })
}

function mapAllForms (form) {
  const forms = {}
  const normalized = normalize(form)
  recurse(form, normalized.root, normalized)
  return forms
  function recurse (form, digest, normalized) {
    forms[digest] = form
    form.content.forEach((element, index) => {
      if (has(element, 'form')) {
        const child = element.form
        const childDigest = normalized[digest].content[index].digest
        recurse(child, childDigest, normalized)
      }
    })
  }
}

function publication (entry, callback) {
  const edition = entry.edition
  const project = entry.project
  const publisher = entry.publisher
  const id = { publisher, project, edition }

  const form = entry.form
  const date = new Date().toISOString()
  const record = { form, date }

  const line = project + '/' + edition

  runSeries([
    done => storage.publication.write(id, record, done),
    done => storage.publisherPublication.append(publisher, line, done),
    done => storage.projectEdition.append(
      publisher + '/' + project, edition, done
    )
  ], callback)
}

function account (entry, callback) {
  const handle = entry.handle
  const email = entry.email
  const passwordHash = entry.passwordHash
  const created = entry.created
  const confirmed = false
  const record = { handle, email, passwordHash, created, confirmed }
  runSeries([
    done => { storage.account.write(handle, record, done) },
    done => { storage.email.append(email, handle, done) }
  ], callback)
}

function confirmAccount (entry, callback) {
  const handle = entry.handle
  storage.account.confirm(handle, callback)
}

function changeEMail (entry, callback) {
  const handle = entry.handle
  const email = entry.email
  let oldEMail
  runSeries([
    done => {
      storage.account.read(handle, (error, account) => {
        if (error) return done(error)
        oldEMail = account.email
        done()
      })
    },
    done => storage.account.update(handle, { email }, done),
    done => storage.email.remove(oldEMail, handle, done),
    done => storage.email.append(email, handle, done)
  ], callback)
}

function changePassword (entry, callback) {
  const handle = entry.handle
  const passwordHash = entry.passwordHash
  storage.account.update(handle, { passwordHash }, callback)
}

function confirmAccountToken (entry, callback) {
  const created = entry.created
  if (expired(created, TOKEN_LIFETIME)) return callback()
  const token = entry.token
  const handle = entry.handle
  const tokenData = { action: 'confirm', created, handle }
  storage.token.write(token, tokenData, callback)
}

function changeEMailToken (entry, callback) {
  const created = entry.created
  if (expired(created, TOKEN_LIFETIME)) return callback()
  const handle = entry.handle
  const token = entry.token
  const email = entry.email
  const tokenData = { action: 'email', created, handle, email }
  storage.token.write(token, tokenData, callback)
}

function resetPasswordToken (entry, callback) {
  const created = entry.created
  if (expired(created, TOKEN_LIFETIME)) return callback()
  const token = entry.token
  const handle = entry.handle
  const tokenData = { action: 'reset', created, handle }
  storage.token.write(token, tokenData, callback)
}

function useToken (entry, callback) {
  storage.token.use(entry.token, callback)
}

function session (entry, callback) {
  const handle = entry.handle
  const id = entry.id
  const created = new Date().toISOString()
  storage.session.write(id, { handle, created }, (error, success) => {
    if (error) return callback(error)
    if (!success) return callback(new Error('session collision'))
    callback()
  })
}

function comment (entry, callback) {
  runSeries([
    done => storage.comment.write(entry.id, entry, done),
    done => storage.formComment.append(entry.form, entry.id, done)
  ], callback)
}
