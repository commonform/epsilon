var handlers = {
  form: require('./form')
}

module.exports = (entry, callback) => {
  var type = entry.type
  if (!type) return callback(new Error('missing log entry type'))
  var handler = handlers[type]
  if (handler) return handler(entry, callback)
  callback(new Error('unknown log entry type: ' + type))
}
