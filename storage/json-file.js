var fs = require('fs')

exports.read = (file, serialization, callback) => {
  serialization = serialization || JSON
  fs.readFile(file, (error, data) => {
    if (error) {
      if (error.code === 'ENOENT') return callback(null, null)
      return callback(error)
    }
    try {
      var parsed = serialization.parse(data)
    } catch (error) {
      return callback(error)
    }
    return callback(null, parsed)
  })
}

exports.write = (file, data, serialization, callback) => {
  serialization = serialization || JSON
  fs.writeFile(file, serialization.stringify(data), callback)
}
