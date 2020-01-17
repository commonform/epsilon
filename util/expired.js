module.exports = function (dateString, days) {
  const now = Date.now()
  const date = Date.parse(dateString)
  return (now - date) > days * 24 * 60 * 60 * 1000
}
