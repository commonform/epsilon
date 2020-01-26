const MIN_LENGTH = 3
const MAX_LENGTH = 16
const PATTERN = `^[a-z0-9]{${MIN_LENGTH},${MAX_LENGTH}}$`
const RE = new RegExp(PATTERN)

const BLACKLIST = [
  'account',
  'commonform',
  'confirm',
  'edit',
  'email',
  'handle',
  'handles',
  'forms',
  'handle',
  'signin',
  'signout',
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
