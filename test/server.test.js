const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const redis = require('redis')
const rimraf = require('rimraf')
const runSeries = require('run-series')
const spawn = require('child_process').spawn
const tape = require('tape')

tape('server', test => {
  fs.mkdtemp('/tmp/', (_, directory) => {
    let server, curl
    const redisServer = spawn('redis-server')
    const serverPort = 8080
    const BLOBS_DIRECTORY = path.join(directory, 'blobs')
    const INDEX_DIRECTORY = path.join(directory, 'index')
    runSeries([
      done => {
        const client = redis.createClient()
        client.flushall(() => {
          client.quit()
          done()
        })
      },
      done => { mkdirp(BLOBS_DIRECTORY, done) },
      done => { mkdirp(INDEX_DIRECTORY, done) },
      done => {
        server = spawn('node', ['server.js'], {
          env: {
            PORT: serverPort,
            NODE_ENV: 'test',
            BASE_HREF: 'http://localhost:' + serverPort + '/',
            REDIS_STREAM: 'commonformtest',
            BLOBS_DIRECTORY,
            INDEX_DIRECTORY
          }
        })
        server.stdout.once('data', () => {
          test.pass('spawned server')
          done()
        })
      }
    ], error => {
      test.ifError(error, 'no error')
      curl = spawn('curl', ['http://localhost:' + serverPort])
      const chunks = []
      curl.stdout
        .on('data', chunk => { chunks.push(chunk) })
        .once('end', () => {
          const output = Buffer.concat(chunks).toString()
          test.assert(
            output.includes('<h1>Common Form</h1>'),
            'output includes <h1>Common Form</h1>'
          )
          server.kill(9)
          redisServer.kill(9)
          curl.kill(9)
          rimraf.sync(directory)
          test.end()
        })
    })
  })
})
