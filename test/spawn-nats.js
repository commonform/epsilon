const spawn = require('child_process').spawn

module.exports = ({ cluster }, callback) => {
  const nats = spawn('nats-streaming-server', [
    '-cid', cluster,
    '-store', 'memory'
  ])
  nats.stderr.on('data', (chunk) => {
    if (chunk.toString().includes('Streaming Server is ready')) {
      callback(null, nats)
    }
  })
}
