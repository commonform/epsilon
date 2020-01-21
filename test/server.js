const ANA = require('./ana')
const AbstractBlobStore = require('abstract-blob-store')
const BOB = require('./bob')
const NDA = require('./nda')
const assert = require('assert')
const fs = require('fs')
const hash = require('../util/hash')
const hashPassword = require('../util/hash-password')
const http = require('http')
const makeHandler = require('../')
const os = require('os')
const path = require('path')
const pino = require('pino')
const redis = require('redis')
const rimraf = require('rimraf')
const runParallel = require('run-parallel')
const runSeries = require('run-series')
const spawn = require('child_process').spawn
const stringify = require('../util/stringify')

module.exports = callback => {
  assert(typeof callback === 'function')
  const log = pino({}, fs.createWriteStream('test-server.log'))
  const redisServer = spawn('redis-server')
  const testClient = redis.createClient()
  const readClient = redis.createClient()
  const writeClient = redis.createClient()
  const blobs = new AbstractBlobStore()
  let directory
  runSeries([
    done => { testClient.flushall(done) },
    done => {
      fs.mkdtemp(path.join(os.tmpdir(), 'epsilon-'), (error, tmp) => {
        if (error) return done(error)
        directory = tmp
        process.env.INDEX_DIRECTORY = path.join(tmp, 'indexes')
        done()
      })
    },
    done => {
      runSeries([
        done => { record({ type: 'form', form: NDA.form }, done) },
        done => {
          const users = [ANA, BOB]
          const tasks = users.map(user => done => {
            runSeries([
              done => {
                hashPassword(user.password, (error, passwordHash) => {
                  if (error) return done(error)
                  record({
                    type: 'account',
                    created: new Date().toISOString(),
                    handle: user.handle,
                    email: user.email,
                    passwordHash
                  }, done)
                })
              },
              done => {
                record({
                  type: 'confirmAccount',
                  handle: user.handle
                }, done)
              }
            ], done)
          })
          runParallel(tasks, done)
        }
      ], done)
    },
    done => {
      testClient.quit()
      done()
    }
  ], error => {
    if (error) throw error
    const handler = makeHandler({
      log,
      blobs,
      readClient,
      writeClient
    })
    const webServer = http.createServer(handler)
    webServer.listen(0, function () {
      const port = this.address().port
      process.env.BASE_HREF = 'http://localhost:' + port
      process.env.ADMIN_EMAIL = 'admin@example.com'
      callback(port, () => {
        webServer.close(noop)
        readClient.end(true)
        writeClient.end(true)
        redisServer.kill(9)
        rimraf(directory, noop)
        function noop () { }
      })
    })
  })

  function record (entry, callback) {
    const stringified = stringify(entry)
    const digest = hash(stringified)
    blobs.createWriteStream(digest, error => {
      if (error) return callback(error)
      testClient.xadd('commonform', '*', 'digest', digest, callback)
    }).end(stringified)
  }
}
