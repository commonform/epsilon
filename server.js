const flushWriteStream = require('flush-write-stream')
const handler = require('./')
const http = require('http')
const journal = require('./storage/journal')
const pino = require('pino')
const pinoHTTP = require('pino-http')
const pump = require('pump')
const uuid = require('uuid')
const validate = require('./storage/validate')
const write = require('./storage/write')

const log = pino({ server: uuid.v4() })

// Environment Variables

requireEnvironmentVariable('BASE_HREF')
requireEnvironmentVariable('INDEX_DIRECTORY')
requireEnvironmentVariable('LOG_DIRECTORY')

if (process.env.NODE_ENV !== 'test') {
  requireEnvironmentVariable('ADMIN_EMAIL')
  requireEnvironmentVariable('SMTP_HOST')
  requireEnvironmentVariable('SMTP_PASSWORD')
  requireEnvironmentVariable('SMTP_PORT')
  requireEnvironmentVariable('SMTP_USER')
}

function requireEnvironmentVariable (name) {
  if (!process.env[name]) {
    log.error('missing ' + name)
    process.exit(1)
  }
}

// Server

var journalInstance = journal()

journalInstance.initialize((error) => {
  if (error) {
    log.error(error)
    process.exit(1)
  }

  const watcher = journalInstance.watch()
  pump(watcher, flushWriteStream.obj((entry, _, done) => {
    write(entry, done)
  }))

  const server = http.createServer((request, response) => {
    pinoHTTP({ logger: log, genReqId: uuid.v4 })(request, response)
    request.record = (entry, callback) => {
      validate(entry, (error) => {
        if (error) return callback(error)
        journalInstance.write(entry, callback)
      })
    }
    handler(request, response)
  })

  function close () {
    log.info('closing')
    server.close(() => {
      watcher.close()
      log.info('closed')
      process.exit(0)
    })
  }

  process.on('SIGINT', close)
  process.on('SIGQUIT', close)
  process.on('SIGTERM', close)
  process.on('uncaughtException', (exception) => {
    log.error(exception)
    close()
  })

  server.listen(process.env.PORT || 8080, function () {
    // If the environment set PORT=0, we'll get a random high port.
    log.info({ port: this.address().port }, 'listening')
  })
})

// Job Scheduler

if (process.env.NODE_ENV !== 'test') {
  const schedule = require('node-schedule')
  const jobs = require('./jobs')
  jobs.forEach(function (job) {
    schedule.scheduleJob(job.cron, function () {
      const jobLog = log.child({ subsystem: 'jobs', name: job.name })
      jobLog.info('running')
      job.handler(jobLog, function () {
        jobLog.info('done')
      })
    })
  })
}
