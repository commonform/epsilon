const STAN = require('node-nats-streaming')
const http = require('http')
const makeHandler = require('./')
const pino = require('pino')
const uuid = require('uuid')

const serverID = uuid.v4()

const log = pino({ server: serverID })

// Environment Variables

requireEnvironmentVariable('BASE_HREF')
requireEnvironmentVariable('DIRECTORY')
requireEnvironmentVariable('NATSS_CLUSTER')
requireEnvironmentVariable('CSRF_KEY')

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

const streamLog = log.child({ subsystem: 'stream' })
const stream = STAN.connect(process.env.NATSS_CLUSTER, serverID)
  .once('error', (error) => {
    streamLog.error(error)
    process.exit(1)
  })
  .once('connect', () => {
    const handler = makeHandler({ log, stream })
    const server = http.createServer(handler)
    function close () {
      log.info('closing')
      stream.close()
      server.close(() => {
        log.info('closed')
        process.exit(0)
      })
    }

    process.on('SIGINT', close)
    process.on('SIGQUIT', close)
    process.on('SIGTERM', close)
    process.on('uncaughtException', exception => {
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
