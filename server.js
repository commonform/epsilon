const http = require('http')
const makeHandler = require('./')
const pino = require('pino')
const redis = require('redis')
const uuid = require('uuid')

const log = pino({ server: uuid.v4() })

// Environment Variables

requireEnvironmentVariable('BASE_HREF')
requireEnvironmentVariable('BLOBS_DIRECTORY')
requireEnvironmentVariable('INDEX_DIRECTORY')
requireEnvironmentVariable('REDIS_STREAM')

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

// Redis

const redisOptions = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD
}

const readClient = redis.createClient(redisOptions)
const writeClient = redis.createClient(redisOptions)

// Blobs

const blobs = process.env.BLOBS_DIRECTORY === 'memory'
  ? require('abstract-blob-store')()
  : require('fs-blob-store')(process.env.BLOBS_DIRECTORY)

// Server

const handler = makeHandler({ log, blobs, readClient, writeClient })
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
process.on('uncaughtException', exception => {
  log.error(exception)
  close()
})

server.listen(process.env.PORT || 8080, function () {
  // If the environment set PORT=0, we'll get a random high port.
  log.info({ port: this.address().port }, 'listening')
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
