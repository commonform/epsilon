var fs = require('fs')

exports.read = (file, callback) => {
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
}

exports.write = (file, data, callback) => {
  fs.writeFile(file, JSON.stringify(data), callback)
}
