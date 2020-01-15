module.exports = function (dateString, days) {
  var now = Date.now()
  var date = Date.parse(dateString)
  return (now - date) > days * 24 * 60 * 60 * 1000
}
