var fs = require('fs')
var mkdirp = require('mkdirp')
var path = require('path')

module.exports = {
  account: simpleFiles('accounts'),
  token: simpleFiles('tokens'),
  session: simpleFiles('sessions')
}

var account = module.exports.account

account.confirm = (handle, callback) => {
  account.read(handle, (error, record) => {
    if (error) return callback(error)
    if (!record) return callback(new Error('no such account'))
    record.confirmed = new Date().toISOString()
    account.write(handle, record, callback)
  })
}

var token = module.exports.token

token.use = (id, type, callback) => {
  token.read(id, (error, record) => {
    if (error) return callback(error)
    if (!record) return callback(null, false)
    if (record.type !== type) return callback(null, false)
    token.delete(id, (error) => {
      if (error) return callback(error)
      callback(null, true, record)
    })
  })
}

function simpleFiles (subdirectory) {
  return {
    write: (id, value, callback) => {
      var directory = path.join(process.env.DIRECTORY, subdirectory)
      mkdirp(directory, (error) => {
        if (error) return callback(error)
        fs.writeFile(filePath(id), JSON.stringify(value), callback)
      })
    },
    read: (id, callback) => {
      var file = filePath(id)
      fs.readFile(file, (error, data) => {
        if (error) {
          if (error.code === 'ENOENT') return callback(null, null)
          return callback(error)
        }
        try {
          var parsed = JSON.parse(data)
        } catch (error) {
          return callback(error)
        }
        return callback(null, parsed)
      })
    },
    delete: (id, callback) => {
      fs.unlink(filePath(id), (error) => {
        if (error && error.code === 'ENOENT') return callback()
        return callback(error)
      })
    }
  }
  function filePath (id) {
    return path.join(process.env.DIRECTORY, subdirectory, id)
  }
}
