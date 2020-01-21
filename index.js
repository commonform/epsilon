const flushWriteStream = require('flush-write-stream')
const notFound = require('./routes/not-found')
const parseURL = require('url-parse')
const pinoHTTP = require('pino-http')
const publications = require('./routes/publications')
const pump = require('pump')
const routes = require('./routes')
const uuid = require('uuid')
const validate = require('./storage/validate')
const write = require('./storage/write')

const PUBLICATION_PATH = /^\/([a-z0-9]+)\/([a-z0-9]+)\/([0-9eucd]+)$/

module.exports = configuration => {
  const client = configuration.client
  const log = configuration.log

  const dataLog = log.child({ subsystem: 'data' })
  pump(
    client.readStream,
    flushWriteStream.obj((object, _, done) => {
      write(object.entry, done)
    })
  )

  return (request, response) => {
    pinoHTTP({ logger: log, genReqId: uuid.v4 })(request, response)
    request.record = record
    const parsed = parseURL(request.url, true)
    const pathname = parsed.pathname
    request.pathname = pathname
    request.query = parsed.query
    const route = routes.get(pathname)
    request.parameters = route.params
    if (route.handler) return route.handler(request, response)
    const match = PUBLICATION_PATH.exec(pathname)
    if (match) {
      request.parameters = {
        publisher: match[1],
        project: match[2],
        edition: match[3]
      }
      return publications(request, response)
    }
    notFound(request, response)
  }

  function record (entry, callback) {
    validate(entry, error => {
      if (error) return callback(error)
      dataLog.info(entry, 'recorded')
      client.write(entry, error => {
        if (error) return callback(error)
        dataLog.info(entry, 'indexed')
        callback()
      })
    })
  }
}
