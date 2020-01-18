const crypto = require('crypto')
const endOfStream = require('end-of-stream')
const flushWriteStream = require('flush-write-stream')
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const pump = require('pump')
const runSeries = require('run-series')
const split2 = require('split2')
const stringify = require('fast-json-stable-stringify')
const through2 = require('through2')
const touch = require('touch')

const DIGEST_BYTES = Buffer.from(hash(stringify('x'))).length
const LOG_LINE_BYTES = DIGEST_BYTES + 1

exports.initialize = function (callback) {
  runSeries([
    (done) => mkdirp(entriesPath(), done),
    (done) => touch(logPath(), done)
  ], callback)
}

exports.write = function (entry, callback) {
  const stringified = stringify(entry)
  const digest = hash(stringified)
  const logLine = digest + '\n'
  runSeries([
    (done) => fs.writeFile(
      entryPath(digest), stringified, { flag: 'w' }, done
    ),
    (done) => fs.writeFile(
      logPath(), logLine, { flag: 'a' }, done
    )
  ], callback)
}

exports.read = function (index, callback) {
  fs.open(logPath(), 'r', (error, fd) => {
    if (error) return callback(error)
    const length = DIGEST_BYTES
    const buffer = Buffer.alloc(length)
    const offset = 0
    const position = LOG_LINE_BYTES * index
    fs.read(fd, buffer, offset, length, position, (error) => {
      if (error) {
        fs.close(fd, () => { /* pass */ })
        return callback(error)
      }
      fs.close(fd, (error) => {
        if (error) return callback(error)
        const digest = buffer.toString()
        readEntryByDigest(digest, callback)
      })
    })
  })
}

const hasOwnProperty = Object.prototype.hasOwnProperty

exports.stream = function (options) {
  options = options || {}
  return pump(
    streamDigests(options),
    through2.obj((digest, _, done) => {
      readEntryByDigest(digest, done)
    })
  )
}

exports.watch = function (options) {
  options = options || {}
  let position = options.start || 0
  let changeSinceStream = false
  let streaming = false
  const returned = through2.obj()
  const watcher = fs.watch(logPath(), () => {
    if (streaming) changeSinceStream = true
    else streamEntries()
  })
  endOfStream(returned, stopWatching)
  streamEntries()
  return returned

  function stopWatching () {
    watcher.close()
  }

  function streamEntries () {
    streaming = true
    changeSinceStream = false
    pump(
      streamDigests({ start: position }),
      flushWriteStream.obj((digest, _, done) => {
        position++
        readEntryByDigest(digest, (error, entry) => {
          if (error) return done(error)
          returned.write(entry, done)
        })
      }),
      (error) => {
        streaming = false
        if (error) {
          returned.emit('error', error)
          return returned.end()
        }
        if (changeSinceStream) streamEntries()
      }
    )
  }
}

exports.head = function (callback) {
  fs.stat(logPath(), (error, stats) => {
    if (error) return callback(error)
    callback(null, stats.size / LOG_LINE_BYTES)
  })
}

function directory () {
  return process.env.LOG_DIRECTORY
}

function logPath () {
  return path.join(directory(), 'log')
}

function entriesPath () {
  return path.join(directory(), 'entries')
}

function entryPath (digest) {
  return path.join(entriesPath(), digest)
}

function readEntryByDigest (digest, callback) {
  fs.readFile(entryPath(digest), 'utf8', (error, data) => {
    if (error) return callback(error)
    try {
      var parsed = JSON.parse(data)
    } catch (error) {
      return callback(error)
    }
    callback(null, parsed)
  })
}

function streamDigests (options) {
  options = options || {}
  return pump(
    fs.createReadStream(logPath(), {
      start: hasOwnProperty.call(options, 'start')
        ? (options.start * LOG_LINE_BYTES)
        : 0
    }),
    split2()
  )
}

function hash (input) {
  return crypto.createHash('sha256')
    .update(input)
    .digest('hex')
}
