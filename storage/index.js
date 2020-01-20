const JSONFile = require('./json-file')
const async = require('async')
const fs = require('fs')
const has = require('has')
const lock = require('lock').Lock()
const mkdirp = require('mkdirp')
const normalize = require('commonform-normalize')
const path = require('path')
const serialize = require('commonform-serialize')

module.exports = {
  account: simpleFiles('accounts'),
  email: appendOnlyLists('emails'),
  token: simpleFiles('tokens'),
  session: simpleFiles('sessions'),
  form: simpleFiles('forms', { serialization: serialize }),
  comment: simpleFiles('comments'),
  formComment: appendOnlyLists('formComments'),
  publication: simpleFiles('publications', {
    complexID: (argument) => path.join(
      argument.publisher,
      argument.project,
      argument.edition
    )
  }),
  lock
}

const account = module.exports.account

account.confirm = (handle, callback) => {
  const properties = { confirmed: new Date().toISOString() }
  account.update(handle, properties, callback)
}

const token = module.exports.token

token.use = (id, callback) => {
  const file = token.filePath(id)
  lock(file, (unlock) => {
    callback = unlock(callback)
    token.readWithoutLocking(id, (error, record) => {
      if (error) return callback(error)
      if (!record) return callback(null, null)
      token.deleteWithoutLocking(id, (error) => {
        if (error) return callback(error)
        callback(null, record)
      })
    })
  })
}

const form = module.exports.form
const comment = module.exports.comment
const formComment = module.exports.formComment

formComment.find = (options, callback) => {
  const formDigest = options.form // optional
  const contextDigest = options.context
  form.read(contextDigest, (error, context) => {
    if (error) return callback(error)
    if (!context) return callback(new Error('context not found'))
    const contexts = computeContexts(context)
    if (formDigest && !has(contexts, formDigest)) {
      return callback(new Error('form not in context'))
    }
    const comments = []
    const digestQueue = async.queue((digest, done) => {
      formComment.read(digest, (error, ids) => {
        if (error) return done(error)
        if (ids.length === 0) return done()
        const readQueue = async.queue((id, done) => {
          comment.read(id, (error, comment) => {
            if (error) return done(error)
            if (!comment) return done()
            comments.push(comment)
            done()
          })
        })
        readQueue.error((error, task) => {
          readQueue.kill()
          done(error)
        })
        readQueue.drain(done)
        ids.forEach((id) => { readQueue.push(id) })
      })
    })
    digestQueue.error((error, task) => {
      digestQueue.kill()
      callback(error)
    })
    digestQueue.drain(() => {
      callback(null, comments)
    })
    if (!formDigest) {
      Object.keys(contexts).forEach((digest) => {
        digestQueue.push(digest)
      })
    } else {
      Object.keys(contexts).forEach((digest) => {
        if (
          // The form is query.form itself.
          digest === formDigest ||
          // The form is a child of query.form.
          contexts[digest].includes(formDigest)
        ) digestQueue.push(digest)
      })
    }
  })
}

// Produces an object map from digest to an array of parent digests.
function computeContexts (form) {
  const normalized = normalize(form)
  const result = {}
  // Initialze an empty array property for each digest.
  Object.keys(normalized).forEach(digest => {
    if (digest !== 'root') result[digest] = []
  })
  return recurse(normalized.root, [], result)

  function recurse (digest, parents, result) {
    // Push every parent's digest to the list of parents.
    parents.forEach(parent => { result[digest].push(parent) })
    // Iterate children.
    normalized[digest].content.forEach(element => {
      const isChild = typeof element === 'object' && element.digest
      if (isChild) {
        recurse(element.digest, parents.concat(digest), result)
      }
    })
    return result
  }
}

function simpleFiles (subdirectory, options) {
  options = options || {}
  const serialization = options.serialization
  const complexID = options.complexID
  const filePath = complexID
    ? (id) => path.join(process.env.INDEX_DIRECTORY, subdirectory, complexID(id) + '.json')
    : (id) => path.join(process.env.INDEX_DIRECTORY, subdirectory, id + '.json')
  return {
    write: (id, value, callback) => {
      lock(filePath(id), (unlock) => writeWithoutLocking(id, value, unlock(callback)))
    },
    writeWithoutLocking,
    read: (id, callback) => {
      lock(filePath(id), (unlock) => readWithoutLocking(id, unlock(callback)))
    },
    readWithoutLocking,
    createRawReadStream: (id) => {
      return fs.createReadStream(filePath(id), 'utf8')
    },
    update: (id, properties, callback) => {
      const file = filePath(id)
      lock(file, (unlock) => {
        callback = unlock(callback)
        JSONFile.read({ file, serialization }, (error, record) => {
          if (error) return callback(error)
          if (!record) return callback(null, null)
          Object.assign(record, properties)
          JSONFile.write({ file, data: record, serialization }, (error) => {
            if (error) return callback(error)
            callback(null, record)
          })
        })
      })
    },
    list: (callback) => {
      const directory = path.dirname(filePath('x'))
      fs.readdir(directory, (error, entries) => {
        if (error) return callback(error)
        const ids = entries.map((entry) => path.basename(entry, '.json'))
        callback(null, ids)
      })
    },
    delete: (id, callback) => {
      lock(filePath(id), (unlock) => deleteWithoutLocking(id, unlock(callback)))
    },
    deleteWithoutLocking,
    filePath
  }

  function writeWithoutLocking (id, value, callback) {
    const file = filePath(id)
    const directory = path.dirname(file)
    mkdirp(directory, (error) => {
      if (error) return callback(error)
      JSONFile.write({ file, data: value, serialization }, callback)
    })
  }

  function readWithoutLocking (id, callback) {
    JSONFile.read({ file: filePath(id), serialization }, callback)
  }

  function deleteWithoutLocking (id, callback) {
    fs.unlink(filePath(id), (error) => {
      if (error && error.code === 'ENOENT') return callback()
      return callback(error)
    })
  }
}

function appendOnlyLists (subdirectory) {
  return {
    append: (id, string, callback) => {
      const file = filePath(id)
      const directory = path.dirname(file)
      mkdirp(directory, (error) => {
        if (error) return callback(error)
        fs.writeFile(
          filePath(id),
          string + '\n',
          { flag: 'a' },
          callback
        )
      })
    },
    read: (id, callback) => {
      lock(filePath(id), (unlock) => readWithoutLocking(id, unlock(callback)))
    },
    readWithoutLocking,
    remove: (id, string, callback) => {
      const file = filePath(id)
      lock(file, (unlock) => {
        callback = unlock(callback)
        readWithoutLocking(id, (error, items) => {
          if (error) return callback(error)
          const filtered = items.filter((item) => item !== string)
          fs.writeFile(
            file,
            filtered.join('\n') + '\n',
            callback
          )
        })
      })
    },
    filePath
  }

  function readWithoutLocking (id, callback) {
    fs.readFile(filePath(id), 'utf8', (error, data) => {
      if (error) {
        if (error.code === 'ENOENT') return callback(null, [])
        return callback(error)
      }
      callback(null, data.split('\n').slice(0, -1))
    })
  }

  function filePath (id) {
    return path.join(process.env.INDEX_DIRECTORY, subdirectory, id + '.txt')
  }
}
