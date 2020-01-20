const MIN_LENGTH = 3
const MAX_LENGTH = 32
const PATTERN = `^[a-z0-9-]{${MIN_LENGTH},${MAX_LENGTH}}$`
const RE = new RegExp(PATTERN)

exports.pattern = PATTERN

exports.valid = argument => RE.test(argument)

exports.html = 'Project names must be made of ' +
  'made of the characters <code>a</code> through <code>z</code>, ' +
  'the digits <code>0</code> through <code>9</code>, ' +
  'and hypens. ' +
  `They must be at least ${MIN_LENGTH} characters long, ` +
  `but no more than ${MAX_LENGTH}.`
