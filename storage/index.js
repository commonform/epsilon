var JSONFile = require('./json-file')
var assert = require('assert')
var fs = require('fs')
var lock = require('lock').Lock()
var mkdirp = require('mkdirp')
var path = require('path')
var serialize = require('commonform-serialize')
var uuid = require('uuid')

module.exports = {
  account: simpleFiles('accounts'),
  email: simpleFiles('emails'),
  token: simpleFiles('tokens'),
  session: simpleFiles('sessions'),
  form: simpleFiles('forms', serialize),
  lock
}

var account = module.exports.account

account.confirm = (handle, callback) => {
  var properties = { confirmed: new Date().toISOString() }
  account.update(handle, properties, callback)
}

var token = module.exports.token

token.create = (type, data, callback) => {
  assert(typeof type === 'string')
  assert(typeof data === 'object')
  assert(typeof callback === 'function')
  var id = uuid.v4()
  data.type = type
  token.write(id, data, (error) => {
    if (error) return callback(error)
    callback(null, id)
  })
}

token.use = (id, callback) => {
  var file = token.filePath(id)
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

function simpleFiles (subdirectory, serialization) {
  return {
    write: (id, value, callback) => {
      lock(filePath(id), (unlock) => writeWithoutLocking(id, value, unlock(callback)))
    },
    writeWithoutLocking,
    read: (id, callback) => {
      lock(filePath(id), (unlock) => readWithoutLocking(id, unlock(callback)))
    },
    readWithoutLocking,
    update: (id, properties, callback) => {
      var file = filePath(id)
      lock(file, (unlock) => {
        callback = unlock(callback)
        JSONFile.read(file, serialization, (error, record) => {
          if (error) return callback(error)
          if (!record) return callback(null, null)
          Object.assign(record, properties)
          JSONFile.write(file, record, serialization, (error) => {
            if (error) return callback(error)
            callback(null, record)
          })
        })
      })
    },
    list: (callback) => {
      var directory = path.dirname(filePath('x'))
      fs.readdir(directory, (error, entries) => {
        if (error) return callback(error)
        var ids = entries.map((entry) => path.basename(entry, '.json'))
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
    var file = filePath(id)
    var directory = path.dirname(file)
    mkdirp(directory, (error) => {
      if (error) return callback(error)
      JSONFile.write(file, value, serialization, callback)
    })
  }

  function readWithoutLocking (id, callback) {
    JSONFile.read(filePath(id), serialization, callback)
  }

  function deleteWithoutLocking (id, callback) {
    fs.unlink(filePath(id), (error) => {
      if (error && error.code === 'ENOENT') return callback()
      return callback(error)
    })
  }

  function filePath (id) {
    return path.join(process.env.DIRECTORY, subdirectory, id + '.json')
  }
}
