var assert = require('assert')

var RE = /^[a-z0-9]{3,16}$/

var BLACKLIST = [
  'account',
  'commonform',
  'confirm',
  'edit',
  'email',
  'forgot',
  'forms',
  'handle',
  'login',
  'logout',
  'password',
  'reset',
  'signup'
]

exports.validate = function (string) {
  assert(typeof string === 'string')
  string = string.toLowerCase()
  return RE.test(string) && !BLACKLIST.includes(string)
}

exports.explanation = 'Handles must be ' +
  'made of the characters ‘a’ through ‘z’ ' +
  'and the digits ‘0’ through ‘9’. ' +
  'They must be at least three characters long, ' +
  'but no more than sixteen.'
