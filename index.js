const notFound = require('./routes/not-found')
const parseURL = require('url-parse')
const pinoHTTP = require('pino-http')
const projects = require('./routes/projects')
const publications = require('./routes/publications')
const publishers = require('./routes/publishers')
const routes = require('./routes')
const uuid = require('uuid')
const validate = require('./storage/validate')
const write = require('./storage/write')

const PUBLISHER_PATH = /^\/([a-z0-9]+)$/
const PROJECT_PATH = /^\/([a-z0-9]+)\/([a-z0-9]+)$/
const PUBLICATION_PATH = /^\/([a-z0-9]+)\/([a-z0-9]+)\/([0-9eucd]+)$/

module.exports = configuration => {
  const { log, stream } = configuration

  const streamLog = log.child({ subsystem: 'stream' })

  const options = stream
    .subscriptionOptions()
    .setDeliverAllAvailable()
    .setMaxInFlight(2)
  const subscription = stream.subscribe(
    process.env.NATSS_STREAM, options
  )
  subscription.on('message', (message) => {
    const sequence = message.getSequence()
    const data = JSON.parse(message.getData())
    write(data, () => {
      streamLog.info({ sequence }, 'indexed')
    })
  })

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
    let match = PUBLICATION_PATH.exec(pathname)
    if (match) {
      request.parameters = {
        publisher: match[1],
        project: match[2],
        edition: match[3]
      }
      return publications(request, response)
    }
    match = PROJECT_PATH.exec(pathname)
    if (match) {
      request.parameters = {
        publisher: match[1],
        project: match[2]
      }
      return projects(request, response)
    }
    match = PUBLISHER_PATH.exec(pathname)
    if (match) {
      request.parameters = {
        publisher: match[1]
      }
      return publishers(request, response)
    }
    notFound(request, response)
  }

  function record (entry, callback) {
    validate(entry, error => {
      if (error) return callback(error)
      const json = JSON.stringify(entry)
      stream.publish(
        process.env.NATSS_STREAM, json,
        (error, guid) => {
          if (error) return callback(error)
          streamLog.info({ guid }, 'published')
          callback()
        }
      )
    })
  }
}
