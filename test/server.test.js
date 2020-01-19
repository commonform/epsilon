const fs = require('fs')
const path = require('path')
const rimraf = require('rimraf')
const spawn = require('child_process').spawn
const tape = require('tape')
const runSeries = require('run-series')

tape('server', (test) => {
  fs.mkdtemp('/tmp/', (_, directory) => {
    var logFile = path.join(directory, 'log')
    var logBlobs = path.join(directory, 'blobs')
    let logServer, server, curl
    const logPort = 8089
    const serverPort = 8080
    runSeries([
      (done) => fs.writeFile(logFile, '', done),
      (done) => {
        logServer = spawn(
          './node_modules/.bin/tcp-log-server', [],
          { env: { PORT: logPort, FILE: logFile, BLOBS: logBlobs } }
        )
        logServer.stderr.pipe(process.stdout)
        logServer.stdout.once('data', (chunk) => {
          test.pass('spawned tcp-log-server')
          done()
        })
      },
      (done) => {
        server = spawn('node', ['server.js'], {
          env: {
            PORT: serverPort,
            NODE_ENV: 'test',
            BASE_HREF: 'http://localhost:' + serverPort + '/',
            TCP_LOG_SERVER_PORT: logPort,
            INDEX_DIRECTORY: path.join(directory, 'index')
          }
        })
        server.stdout.once('data', () => {
          test.pass('spawned server')
          done()
        })
      }
    ], (error) => {
      test.ifError(error, 'no error')
      curl = spawn('curl', ['http://localhost:' + serverPort])
      const chunks = []
      curl.stdout
        .on('data', (chunk) => { chunks.push(chunk) })
        .once('end', () => {
          const output = Buffer.concat(chunks).toString()
          test.assert(
            output.includes('<h1>Common Form</h1>'),
            'output includes <h1>Common Form</h1>'
          )
          server.kill(9)
          logServer.kill(9)
          curl.kill(9)
          rimraf.sync(directory)
          test.end()
        })
    })
  })
})
