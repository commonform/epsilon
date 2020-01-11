var JSONFile = require('./json-file')
var fs = require('fs')
var lock = require('lock').Lock()
var mkdirp = require('mkdirp')
var path = require('path')

module.exports = {
  account: simpleFiles('accounts'),
  email: simpleFiles('emails'),
  token: simpleFiles('tokens'),
  session: simpleFiles('sessions'),
  lock
}

var account = module.exports.account

account.confirm = (handle, callback) => {
  var properties = { confirmed: new Date().toISOString() }
  account.update(handle, properties, callback)
}

var token = module.exports.token

token.use = (id, type, callback) => {
  var file = token.filePath(id)
  lock(file, (unlock) => {
    callback = unlock(callback)
    JSONFile.read(file, (error, record) => {
      if (error) return callback(error)
      if (!record) return callback(null, false)
      if (record.type !== type) return callback(null, false)
      fs.unlink(file, (error) => {
        if (error) return callback(error)
        callback(null, true, record)
      })
    })
  })
}

function simpleFiles (subdirectory) {
  return {
    write: (id, value, callback) => {
      var file = filePath(id)
      lock(file, (unlock) => {
        callback = unlock(callback)
        var directory = path.dirname(file)
        mkdirp(directory, (error) => {
          if (error) return callback(error)
          JSONFile.write(file, value, callback)
        })
      })
    },
    read: (id, callback) => {
      var file = filePath(id)
      lock(file, (unlock) => {
        callback = unlock(callback)
        JSONFile.read(file, callback)
      })
    },
    update: (id, properties, callback) => {
      var file = filePath(id)
      lock(file, (unlock) => {
        callback = unlock(callback)
        JSONFile.read(file, (error, record) => {
          if (error) return callback(error)
          if (!record) return callback(null, null)
          Object.assign(record, properties)
          JSONFile.write(file, record, (error) => {
            if (error) return callback(error)
            callback(null, record)
          })
        })
      })
    },
    delete: (id, callback) => {
      var file = filePath(id)
      lock(file, (unlock) => {
        callback = unlock(callback)
        fs.unlink(filePath(id), (error) => {
          if (error && error.code === 'ENOENT') return callback()
          return callback(error)
        })
      })
    },
    filePath
  }
  function filePath (id) {
    return path.join(process.env.DIRECTORY, subdirectory, id)
  }
}
