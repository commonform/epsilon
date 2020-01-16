var handler = require('./')
var http = require('http')
var pino = require('pino')
var pinoHTTP = require('pino-http')
var uuid = require('uuid')

var log = pino({ server: uuid.v4() })

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

var server = http.createServer((request, response) => {
  pinoHTTP({ logger: log, genReqId: uuid.v4 })(request, response)
  handler(request, response)
})

function close () {
  log.info('closing')
  server.close(() => {
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

// Job Scheduler

if (process.env.NODE_ENV !== 'test') {
  var schedule = require('node-schedule')
  var jobs = require('./jobs')
  jobs.forEach(function (job) {
    schedule.scheduleJob(job.cron, function () {
      var jobLog = log.child({ subsystem: 'jobs', name: job.name })
      jobLog.info('running')
      job.handler(jobLog, function () {
        jobLog.info('done')
      })
    })
  })
}
