const fs = require('fs')
const path = require('path')
const rimraf = require('rimraf')
const spawn = require('child_process').spawn
const tape = require('tape')

tape('server', (test) => {
  fs.mkdtemp('/tmp/', (_, directory) => {
    const port = 8080
    const server = spawn('node', ['server.js'], {
      env: {
        PORT: port,
        NODE_ENV: 'test',
        BASE_HREF: 'http://localhost:' + port + '/',
        LOG_DIRECTORY: path.join(directory, 'log'),
        INDEX_DIRECTORY: path.join(directory, 'index')
      }
    })
    server.stdout.once('data', () => {
      const curl = spawn('curl', ['http://localhost:' + port])
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
          curl.kill(9)
          rimraf.sync(directory)
          test.end()
        })
    })
  })
})
