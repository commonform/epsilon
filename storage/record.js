const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const runSeries = require('run-series')
const stringify = require('fast-json-stable-stringify')
const write = require('./write')

module.exports = (entry, callback) => {
  assert(typeof entry === 'object')
  assert(typeof entry.type === 'string')
  var stringified = stringify(entry)
  var digest = crypto.createHash('sha256')
    .update(stringified)
    .digest('hex')
  var logFile = path.join(process.env.LOG_DIRECTORY, 'log')
  var logLine = digest + '\n'
  var entries = path.join(process.env.LOG_DIRECTORY, 'entries')
  var entryFile = path.join(entries, digest + '.json')
  runSeries([
    (done) => mkdirp(entries, done),
    (done) => fs.writeFile(entryFile, stringified, done),
    (done) => fs.writeFile(logFile, logLine, { flag: 'a' }, done)
  ], (error) => {
    if (error) return callback(error)
    write(entry, callback)
  })
}
