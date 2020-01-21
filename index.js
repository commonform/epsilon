const forever = require('async').forever
const hash = require('./util/hash')
const notFound = require('./routes/not-found')
const parseURL = require('url-parse')
const pinoHTTP = require('pino-http')
const projects = require('./routes/projects')
const publications = require('./routes/publications')
const publishers = require('./routes/publishers')
const routes = require('./routes')
const runSeries = require('run-series')
const stringify = require('./util/stringify')
const uuid = require('uuid')
const validate = require('./storage/validate')
const write = require('./storage/write')

const PUBLISHER_PATH = /^\/([a-z0-9]+)$/
const PROJECT_PATH = /^\/([a-z0-9]+)\/([a-z0-9]+)$/
const PUBLICATION_PATH = /^\/([a-z0-9]+)\/([a-z0-9]+)\/([0-9eucd]+)$/

module.exports = configuration => {
  const { readClient, writeClient, blobs, log } = configuration

  const dataLog = log.child({ subsystem: 'data' })
  let lastID = '0'
  const xreadArguments = ['BLOCK', '30000', 'COUNT', 3, 'STREAMS', process.env.REDIS_STREAM]
  forever(next => {
    if (readClient.closing) return
    readClient.xread(xreadArguments.concat(lastID), (error, results) => {
      if (error) return dataLog.error(error)
      if (!results) return next()
      const entries = results[0][1]
      const tasks = entries.map(entry => done => {
        const id = entry[0]
        const digest = entry[1][1]
        const chunks = []
        let errored = false
        blobs.createReadStream(digest)
          .on('data', chunk => { chunks.push(chunk) })
          .once('error', error => {
            errored = true
            done(error)
          })
          .once('end', () => {
            if (errored) return
            const buffer = Buffer.concat(chunks)
            let parsed
            try {
              parsed = JSON.parse(buffer)
            } catch (error) {
              return done(error)
            }
            write(parsed, error => {
              if (error) return done(error)
              lastID = id
              done()
            })
          })
      })
      runSeries(tasks, error => {
        if (error) dataLog.error(error)
        next()
      })
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
      const stringified = stringify(entry)
      const digest = hash(stringified)
      runSeries([
        done => {
          blobs
            .createWriteStream(digest, error => {
              if (error) return done(error)
              dataLog.info(entry, 'wrote to blobs')
              done()
            })
            .end(stringified)
        },
        done => {
          writeClient.xadd(process.env.REDIS_STREAM, '*', 'digest', digest, error => {
            if (error) return done(error)
            dataLog.info(entry, 'wrote to Redis')
            done()
          })
        }
      ], callback)
    })
  }
}
