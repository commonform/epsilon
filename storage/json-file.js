var fs = require('fs')

exports.read = (options, callback) => {
  var file = options.file
  var serialization = options.serialization || JSON
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

exports.write = (options, callback) => {
  var file = options.file
  var data = options.data
  var serialization = options.serialization || JSON
  var flag = options.flag || 'w'
  var stringified = serialization.stringify(data)
  fs.writeFile(file, stringified, { flag }, (error) => {
    if (error) {
      if (error.code === 'EEXIST') return callback(null, false)
      return callback(error, false)
    }
    callback(null, true)
  })
}
