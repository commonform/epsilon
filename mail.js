if (process.env.NODE_ENV === 'test') {
  var EventEmitter = require('events').EventEmitter
  var emitter = new EventEmitter()
  module.exports = (options, callback) => {
    emitter.emit('sent', options)
    setImmediate(() => { callback() })
  }
  module.exports.events = emitter
} else {
  var nodemailer = require('nodemailer')
  module.exports = nodemailer.createTransport({
    pool: true,
    host: process.env.SMTP_HOST || 'localhost',
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  })
}
