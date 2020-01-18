const FSAOL = require('fsaol')
const crypto = require('crypto')
const stringify = require('fast-json-stable-stringify')

module.exports = () => new FSAOL({
  directory: process.env.LOG_DIRECTORY,
  hashFunction,
  encoding: { stringify, parse: JSON.parse }
})

function hashFunction (input) {
  return crypto.createHash('sha256')
    .update(input)
    .digest('hex')
}
