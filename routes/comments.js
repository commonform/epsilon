const Busboy = require('busboy')
const DIGEST_RE = require('../util/digest-re')
const UUID_RE = require('../util/uuid-re')
const authenticate = require('./authenticate')
const found = require('./found')
const internalError = require('./internal-error')
const mail = require('../mail')
const methodNotAllowed = require('./method-not-allowed')
const parseMentions = require('parse-mentions')
const runParallelLimit = require('run-parallel-limit')
const runSeries = require('run-series')
const seeOther = require('./see-other')
const storage = require('../storage')
const uuid = require('uuid')

module.exports = (request, response) => {
  if (request.method !== 'POST') return methodNotAllowed(request, response)
  authenticate(request, response, () => {
    post(request, response)
  })
}

function post (request, response) {
  if (!request.account) return found(request, response, '/login')
  const handle = request.account.handle
  const comment = { handle, replyTo: [] }
  const fields = ['context', 'form', 'replyTo[]', 'text']
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
          if (name === 'replyTo[]') comment.replyTo.push(value)
          else if (fields.includes(name)) comment[name] = value
        })
        .once('finish', done)
    )
  }

  function validate (done) {
    let error
    if (!comment.context || !DIGEST_RE.test(comment.context)) {
      error = new Error('invalid context')
      error.statusCode = 400
      return done(error)
    }
    if (!comment.form || !DIGEST_RE.test(comment.form)) {
      error = new Error('invalid form')
      error.statusCode = 400
      return done(error)
    }
    if (!comment.replyTo.every(element => UUID_RE.test(element))) {
      error = new Error('invalid replyTo')
      error.statusCode = 400
      return done(error)
    }
    // TODO: comment text length limit
    if (!comment.text) {
      error = new Error('invalid text')
      error.statusCode = 400
      return done(error)
    }
    done()
  }

  function record (done) {
    id = uuid.v4()
    request.record({
      type: 'comment',
      context: comment.context,
      date: new Date().toISOString(),
      form: comment.form,
      handle,
      id,
      replyTo: comment.replyTo,
      text: comment.text
    }, done)
  }

  function sendNotifications (done) {
    const alreadyNotified = [handle]
    runParallelLimit([
      // Notify author of parent comment.
      done => {
        if (comment.replyTo.length === 0) return done()
        const parentID = comment.replyTo[0]
        storage.comment.read(parentID, (error, parent) => {
          if (error) return done(error)
          const handle = parent.handle
          storage.account.read(handle, (error, account) => {
            if (error) return done(error)
            if (!account) {
              request.log.error({ handle }, 'no such account')
              return done()
            }
            // TODO: Improve reply e-mail notifications.
            mail({
              to: account.email,
              subject: 'Reply',
              text: `
@${comment.handle} replied to your comment on commonform.org.

To read their comment, visit https://commonform.org/comments/${id}.
              `.trim()
            }, (error) => {
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
        const mentions = parseMentions(comment.text).matches
        if (mentions.length === 0) return done()
        const tasks = mentions.map(handle => done => {
          storage.account.read(handle, (error, account) => {
            if (error) return done(error)
            if (!account) {
              request.log.info({ handle }, 'bad mention')
              return done()
            }
            mail({
              to: account.email,
              subject: 'Mention',
              text: `
@${comment.handle} mentioned you in a comment on commonform.org.

To read their comment, visit https://commonform.org/comments/${id}.
              `.trim()
            }, (error) => {
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
        if (comment.replyTo.length === 0) return done()
        const parentTasks = comment.replyTo.map(id => done => {
          storage.commentWatchers.read(id, (error, watchers) => {
            if (error) return done(error)
            const watcherTasks = watchers.map(handle => done => {
              if (alreadyNotified.includes(handle)) return done()
              storage.account.read(handle, (error, account) => {
                if (error) return done(error)
                // TODO: Improve watched comment reply notifications.
                mail({
                  to: account.email,
                  subject: 'Reply',
                  text: `
@${comment.handle} replied to a comment you watch on commonform.org.

To read the comment, visit https://commonform.org/comments/${id}.
                  `.trim()
                }, (error) => {
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
