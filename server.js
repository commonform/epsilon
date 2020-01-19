const TCPLogClient = require('tcp-log-client')
const http = require('http')
const makeHandler = require('./')
const pino = require('pino')
const uuid = require('uuid')

const log = pino({ server: uuid.v4() })

// Environment Variables

requireEnvironmentVariable('BASE_HREF')
requireEnvironmentVariable('INDEX_DIRECTORY')

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

const clientLog = log.child({ system: 'client' })
const client = TCPLogClient({
  server: {
    host: process.env.TCP_LOG_SERVER_HOST || 'localhost',
    port: process.env.TCP_LOG_SERVER_PORT
      ? parseInt(process.env.TCP_LOG_SERVER_PORT)
      : 4444
  }
})
  .on('error', (error) => { clientLog.error(error) })
  .on('fail', () => {
    clientLog.error('fail')
    server.close()
  })
logClientEvent('connect')
logClientEvent('disconnect')
logClientEvent('reconnect')
logClientEvent('backoff')
logClientEvent('ready')
logClientEvent('current')

function logClientEvent (event) {
  client.on(event, () => { clientLog.info(event) })
}

const handler = makeHandler({ log, client })
const server = http.createServer(handler)

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

client.connect()

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
