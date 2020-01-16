var fs = require('fs')
var path = require('path')
var rimraf = require('rimraf')
var spawn = require('child_process').spawn
var tape = require('tape')

tape('server', (test) => {
  fs.mkdtemp('/tmp/', (_, directory) => {
    var port = 8080
    var server, curl
    server = spawn('node', ['server.js'], {
      env: {
        PORT: port,
        NODE_ENV: 'test',
        BASE_HREF: 'http://localhost:' + port + '/',
        LOG_DIRECTORY: path.join(directory, 'log'),
        INDEX_DIRECTORY: path.join(directory, 'index')
      }
    })
    server.stdout.once('data', () => {
      curl = spawn('curl', ['http://localhost:' + port])
      var chunks = []
      curl.stdout
        .on('data', (chunk) => { chunks.push(chunk) })
        .once('end', () => {
          var output = Buffer.concat(chunks).toString()
          test.assert(
            output.includes('<h1>Common Form</h1>'),
            'output includes <h1>Common Form</h1>'
          )
          server.kill()
          curl.kill()
          rimraf.sync(directory)
          test.end()
        })
    })
  })
})
