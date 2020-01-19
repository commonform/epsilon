const JSONFile = require('./json-file')
const fs = require('fs')
const lock = require('lock').Lock()
const mkdirp = require('mkdirp')
const path = require('path')
const serialize = require('commonform-serialize')

module.exports = {
  account: simpleFiles('accounts'),
  email: appendOnlyLists('emails'),
  token: simpleFiles('tokens'),
  session: simpleFiles('sessions'),
  form: simpleFiles('forms', { serialization: serialize }),
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
      callback(null, data.split('\n'))
    })
  }

  function filePath (id) {
    return path.join(process.env.INDEX_DIRECTORY, subdirectory, id + '.txt')
  }
}
