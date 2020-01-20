const AbstractBlobStore = require('abstract-blob-store')
const EventEmitter = require('events').EventEmitter
const NDA = require('./nda')
const TCPLogClient = require('tcp-log-client')
const TCPLogServer = require('tcp-log-server')
const USER = require('./user')
const assert = require('assert')
const fs = require('fs')
const hashPassword = require('../util/hash-password')
const http = require('http')
const makeHandler = require('../')
const mkdirp = require('mkdirp')
const net = require('net')
const os = require('os')
const path = require('path')
const pino = require('pino')
const rimraf = require('rimraf')
const runSeries = require('run-series')

const handle = USER.handle
const password = USER.password
const email = USER.email

module.exports = callback => {
  assert(typeof callback === 'function')
  const log = pino({}, fs.createWriteStream('test-server.log'))
  var directory, logServer, logServerPort, logClient
  runSeries([
    done => {
      fs.mkdtemp(path.join(os.tmpdir(), 'epsilon-'), (error, tmp) => {
        if (error) return done(error)
        directory = tmp
        process.env.INDEX_DIRECTORY = path.join(tmp, 'indexes')
        done()
      })
    },
    done => {
      const file = path.join(directory, 'log', 'log')
      runSeries([
        done => mkdirp(path.dirname(file), done),
        done => fs.writeFile(file, '', done),
        done => {
          const blobs = new AbstractBlobStore()
          const emitter = new EventEmitter()
          logServer = net.createServer(TCPLogServer({
            log, file, blobs, emitter
          }))
          logServer.listen(0, function () {
            logServerPort = this.address().port
            done()
          })
        }
      ], done)
    },
    done => {
      logClient = TCPLogClient({ server: { port: logServerPort } })
      logClient.once('current', done)
      logClient.connect()
    }
  ], error => {
    if (error) throw error
    const handler = makeHandler({ log, client: logClient })
    const webServer = http.createServer(handler)
    webServer.listen(0, function () {
      const port = this.address().port
      process.env.BASE_HREF = 'http://localhost:' + port
      process.env.ADMIN_EMAIL = 'admin@example.com'
      runSeries([
        done => logClient.write({
          type: 'form',
          form: NDA.form
        }, done),
        done => {
          hashPassword(password, (error, passwordHash) => {
            if (error) return done(error)
            logClient.write({
              type: 'account',
              created: new Date().toISOString(),
              handle,
              email,
              passwordHash
            }, done)
          })
        },
        done => logClient.write({
          type: 'confirmAccount',
          handle
        }, done)
      ], error => {
        if (error) throw error
        callback(port, () => {
          logClient.destroy()
          runSeries([
            done => { webServer.close(done) },
            done => { logServer.close(done) },
            done => { rimraf(directory, done) }
          ])
        })
      })
    })
  })
}
