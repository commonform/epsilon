const MIN = 8
const MAX = 64

const pattern = exports.pattern = `^.{${MIN},${MAX}}$`

const re = new RegExp(pattern)

exports.valid = function (string) {
  if (!re.test(string)) return false
  const length = string.length
  return length >= MIN && length <= MAX
}

exports.html = 'Passwords must be ' +
  `at least ${MIN} characters, ` +
  `and no more than ${MAX}.`
