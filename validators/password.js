exports.pattern = '^.{8,128}$'

exports.valid = function (string) {
  const length = string.length
  return length >= 8 && length <= 128
}

exports.html = 'Passwords must be ' +
  'at least 8 characters, ' +
  'and no more than 128.'
