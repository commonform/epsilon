var MIN_LENGTH = 3
var MAX_LENGTH = 16
var PATTERN = `^[a-z0-9]{${MIN_LENGTH},${MAX_LENGTH}}$`
var RE = new RegExp(PATTERN)

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

exports.pattern = PATTERN

exports.valid = function (string) {
  return RE.test(string) && !BLACKLIST.includes(string)
}

exports.html = 'Handles must be ' +
  'made of the characters ‘a’ through ‘z’ ' +
  'and the digits ‘0’ through ‘9’. ' +
  'They must be at least three characters long, ' +
  'but no more than sixteen.'

exports.html = 'Project names must be made of ' +
  'made of the characters <code>a</code> through <code>z</code>, ' +
  'the digits <code>0</code> through <code>9</code>. ' +
  `They must be at least ${MIN_LENGTH} characters long, ` +
  `but no more than ${MAX_LENGTH}.`
