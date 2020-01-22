const ANA = require('./ana')
const BOB = require('./bob')
const NDA = require('./nda')
const STAN = require('node-nats-streaming')
const assert = require('assert')
const fs = require('fs')
const hashPassword = require('../util/hash-password')
const http = require('http')
const makeHandler = require('../')
const os = require('os')
const path = require('path')
const pino = require('pino')
const rimraf = require('rimraf')
const runParallel = require('run-parallel')
const runSeries = require('run-series')
const spawnNats = require('./spawn-nats')
const uuid = require('uuid')

module.exports = callback => {
  assert(typeof callback === 'function')
  const log = pino({}, fs.createWriteStream('test-server.log'))
  let directory
  const cluster = process.env.NATSS_CLUSTER = 'commonform-test'
  process.env.NATSS_STREAM = 'commonform'
  let nats
  let fixtureClient
  let serverClient
  let webServer
  runSeries([
    done => {
      spawnNats({ cluster }, (error, spawned) => {
        if (error) return done(error)
        nats = spawned
        done()
      })
    },
    done => {
      fixtureClient = STAN
        .connect(cluster, uuid.v4())
        .once('error', done)
        .once('connect', () => { done() })
    },
    done => {
      serverClient = STAN
        .connect(cluster, uuid.v4())
        .once('error', done)
        .once('connect', () => { done() })
    },
    done => {
      fs.mkdtemp(path.join(os.tmpdir(), 'epsilon-'), (error, tmp) => {
        if (error) return done(error)
        directory = tmp
        process.env.DIRECTORY = path.join(tmp, 'indexes')
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
    }
  ], error => {
    if (error) {
      cleanup()
      console.error(error)
      throw error
    }
    const handler = makeHandler({ log, stream: serverClient })
    webServer = http.createServer(handler)
    webServer.listen(0, function () {
      const port = this.address().port
      process.env.BASE_HREF = 'http://localhost:' + port
      process.env.ADMIN_EMAIL = 'admin@example.com'
      callback(port, cleanup)
    })
  })

  function cleanup () {
    if (serverClient) serverClient.close()
    if (fixtureClient) fixtureClient.close()
    if (nats) nats.kill(9)
    if (webServer) webServer.close()
    if (directory) rimraf(directory, () => {})
  }

  function record (entry, callback) {
    fixtureClient.publish(
      'commonform',
      JSON.stringify(entry),
      (error, guid) => {
        if (error) return callback(error)
        callback()
      }
    )
  }
}
