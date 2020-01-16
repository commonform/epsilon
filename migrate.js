var flushWriteStream = require('flush-write-stream')
var fs = require('fs')
var path = require('path')
var pump = require('pump')
var split2 = require('split2')

module.exports = (callback) => {
  pump(
    fs.createReadStream(
      path.join(process.env.DIRECTORY, 'log')
    ),
    split2(),
    flushWriteStream.obj((digest, _, done) => {
      fs.readFile(
        path.join(process.env.DIRECTORY, 'entries', digest + '.json'),
        (error, json) => {
          if (error) return done(error)
          try {
            var parsed = JSON.parse(json)
          } catch (error) {
            return done(error)
          }
          done()
        }
      )
    })
  )
}
