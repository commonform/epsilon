var tape = require('tape')
var rimraf = require('rimraf')
var fs = require('fs')
var spawn = require('child_process').spawn

tape('server', (test) => {
  fs.mkdtemp('/tmp/', (_, directory) => {
    var port = 8080
    var server, curl
    server = spawn('node', ['server.js'], {
      env: { PORT: port }
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
