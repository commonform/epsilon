const assert = require('assert')
const journal = require('./journal')
const write = require('./write')

module.exports = (entry, callback) => {
  assert(typeof entry === 'object')
  assert(typeof entry.type === 'string')
  journal.write(entry, (error) => {
    if (error) return callback(error)
    write(entry, callback)
  })
}
