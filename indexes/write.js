const MESSAGE_TYPES = require('../constants/message-types')
const assert = require('assert')
const async = require('async')
const expired = require('../util/expired')
const has = require('has')
const indexes = require('./')
const normalize = require('commonform-normalize')
const runSeries = require('run-series')

const writers = {
  confirmAccount,
  changeEMail,
  changePassword,
  comment,
  draft,
  form,
  lockAccount,
  publication,
  confirmAccountToken,
  changeEMailToken,
  resetPasswordToken,
  session,
  useToken,
  account
}

Object.keys(writers).forEach(key => {
  assert(MESSAGE_TYPES.includes(key), 'Unknown Message Type: ' + key)
})

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
    indexes.form.write(task.digest, task.form, done)
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

function draft (entry, callback) {
  const publisher = entry.publisher
  const draft = entry.draft
  const date = entry.date
  const form = entry.form || ''

  runSeries([
    done => indexes.draft.append(
      publisher + '/' + draft,
      date + '/' + form,
      done
    ),
    done => indexes.formDraft.append(
      form,
      publisher + '/' + draft,
      done
    ),
    done => indexes.publisherDraft.append(
      publisher, draft, done
    )
  ], callback)
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
    done => indexes.publication.write(id, record, done),
    done => indexes.publisherPublication.append(publisher, line, done),
    done => indexes.projectEdition.append(
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
  const failures = 0
  const locked = false
  const record = {
    handle,
    email,
    passwordHash,
    created,
    confirmed,
    failures,
    locked
  }
  runSeries([
    done => { indexes.account.write(handle, record, done) },
    done => { indexes.email.write(email, handle, done) }
  ], callback)
}

function confirmAccount (entry, callback) {
  const handle = entry.handle
  indexes.account.confirm(handle, callback)
}

function changeEMail (entry, callback) {
  const handle = entry.handle
  const email = entry.email
  let oldEMail
  runSeries([
    done => {
      indexes.account.read(handle, (error, account) => {
        if (error) return done(error)
        oldEMail = account.email
        done()
      })
    },
    done => indexes.account.update(handle, { email }, done),
    done => indexes.email.delete(oldEMail, done),
    done => indexes.email.write(email, handle, done)
  ], callback)
}

function changePassword (entry, callback) {
  const handle = entry.handle
  const passwordHash = entry.passwordHash
  indexes.account.update(handle, { passwordHash }, callback)
}

function confirmAccountToken (entry, callback) {
  const created = entry.created
  if (expired.confirmAccountToken(created)) return callback()
  const token = entry.token
  const handle = entry.handle
  const tokenData = { action: 'confirm', created, handle }
  indexes.token.write(token, tokenData, callback)
}

function changeEMailToken (entry, callback) {
  const created = entry.created
  if (expired.changeEMailToken(created)) return callback()
  const handle = entry.handle
  const token = entry.token
  const email = entry.email
  const tokenData = { action: 'email', created, handle, email }
  indexes.token.write(token, tokenData, callback)
}

function resetPasswordToken (entry, callback) {
  const created = entry.created
  if (expired.resetPasswordToken(created)) return callback()
  const token = entry.token
  const handle = entry.handle
  const tokenData = { action: 'reset', created, handle }
  indexes.token.write(token, tokenData, callback)
}

function useToken (entry, callback) {
  indexes.token.use(entry.token, callback)
}

function session (entry, callback) {
  const handle = entry.handle
  const id = entry.id
  const created = new Date().toISOString()
  indexes.session.write(id, { id, handle, created }, (error, success) => {
    if (error) return callback(error)
    if (!success) return callback(new Error('session collision'))
    callback()
  })
}

function comment (entry, callback) {
  runSeries([
    done => indexes.comment.write(entry.id, entry, done),
    done => indexes.formComment.append(entry.form, entry.id, done)
  ], callback)
}

function lockAccount (entry, callback) {
  const locked = new Date().toISOString()
  const properties = { locked, failures: 0 }
  indexes.account.update(entry.handle, properties, callback)
}
