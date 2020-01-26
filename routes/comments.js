const Busboy = require('busboy')
const DIGEST_RE = require('../util/digest-re')
const UUID_RE = require('../util/uuid-re')
const csrf = require('../util/csrf')
const found = require('./found')
const indexes = require('../indexes')
const internalError = require('./internal-error')
const mentionNotification = require('../notifications/mention')
const methodNotAllowed = require('./method-not-allowed')
const parseMentions = require('parse-mentions')
const replyNotification = require('../notifications/reply')
const runParallelLimit = require('run-parallel-limit')
const runSeries = require('run-series')
const seeOther = require('./see-other')
const uuid = require('uuid')
const watchedCommentNotification = require('../notifications/watched-comment')

module.exports = (request, response) => {
  if (request.method !== 'POST') return methodNotAllowed(request, response)
  post(request, response)
}

function post (request, response) {
  if (!request.account) return found(request, response, '/signin')
  const handle = request.account.handle
  const body = { handle, replyTo: [] }
  const fields = [
    'context', 'form', 'replyTo[]', 'text',
    'token', 'nonce'
  ]
  let id
  runSeries([
    readPostBody,
    validate,
    record,
    sendNotifications
  ], function (error) {
    if (error) {
      if (error.statusCode === 400) {
        // TODO: Show errors on form page.
        response.statusCode = 400
        return response.end()
      }
      return internalError(request, response, error)
    }
    seeOther(request, response, '/comments/' + id)
  })

  function readPostBody (done) {
    request.pipe(
      new Busboy({
        headers: request.headers,
        limits: {
          fieldNameSize: Math.max(fields.map(x => x.length)),
          fields: fields.length,
          parts: 1
        }
      })
        .on('field', function (name, value, truncated, encoding, mime) {
          if (name === 'replyTo[]') body.replyTo.push(value)
          else if (fields.includes(name)) body[name] = value
        })
        .once('finish', done)
    )
  }

  function validate (done) {
    let error
    if (!body.context || !DIGEST_RE.test(body.context)) {
      error = new Error('invalid context')
      error.statusCode = 400
      return done(error)
    }
    if (!body.form || !DIGEST_RE.test(body.form)) {
      error = new Error('invalid form')
      error.statusCode = 400
      return done(error)
    }
    if (!body.replyTo.every(element => UUID_RE.test(element))) {
      error = new Error('invalid replyTo')
      error.statusCode = 400
      return done(error)
    }
    // TODO: comment text length limit
    if (!body.text) {
      error = new Error('invalid text')
      error.statusCode = 400
      return done(error)
    }
    csrf.verify({
      action: '/comments',
      sessionID: request.session.id,
      token: body.token,
      nonce: body.nonce
    }, done)
  }

  function record (done) {
    id = uuid.v4()
    request.record({
      type: 'comment',
      context: body.context,
      date: new Date().toISOString(),
      form: body.form,
      handle,
      id,
      replyTo: body.replyTo,
      text: body.text
    }, done)
  }

  function sendNotifications (done) {
    const alreadyNotified = [handle]
    runParallelLimit([
      // Notify author of parent comment.
      done => {
        if (body.replyTo.length === 0) return done()
        const parentID = body.replyTo[0]
        indexes.comment.read(parentID, (error, parent) => {
          if (error) return done(error)
          const handle = parent.handle
          indexes.account.read(handle, (error, account) => {
            if (error) return done(error)
            if (!account) {
              request.log.error({ handle }, 'no such account')
              return done()
            }
            replyNotification({
              to: account.email,
              comment: body
            }, error => {
              if (error) return done(error)
              request.log.info('notified parent')
              alreadyNotified.push(handle)
              done()
            })
          })
        })
      },

      // Notify mentioned.
      done => {
        const mentions = parseMentions(body.text).matches
        if (mentions.length === 0) return done()
        const tasks = mentions.map(handle => done => {
          indexes.account.read(handle, (error, account) => {
            if (error) return done(error)
            if (!account) {
              request.log.info({ handle }, 'bad mention')
              return done()
            }
            mentionNotification({
              to: account.email,
              comment: body
            }, error => {
              if (error) return done(error)
              alreadyNotified.push(handle)
              done()
            })
          })
        })
        runParallelLimit(tasks, 3, (error) => {
          if (error) return done(error)
          request.log.info('notified mentioned')
          done()
        })
      },

      // Notify watchers.
      done => {
        if (body.replyTo.length === 0) return done()
        const parentTasks = body.replyTo.map(id => done => {
          indexes.commentWatchers.read(id, (error, watchers) => {
            if (error) return done(error)
            const watcherTasks = watchers.map(handle => done => {
              if (alreadyNotified.includes(handle)) return done()
              indexes.account.read(handle, (error, account) => {
                if (error) return done(error)
                watchedCommentNotification({
                  to: account.email,
                  comment: body
                }, error => {
                  if (error) return done(error)
                  alreadyNotified.push(handle)
                  done()
                })
              })
            })
            runParallelLimit(watcherTasks, 3, done)
          })
        })
        runParallelLimit(parentTasks, 3, (error) => {
          if (error) return done(error)
          request.log.info('notified watchers')
          done()
        })
      }
    ], 3, done)
  }
}
