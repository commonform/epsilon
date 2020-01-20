const parse = require('reviewers-edition-parse')

exports.pattern = '^[eudc0-9]+$'

exports.valid = argument => !!parse(argument)

exports.html = 'Editions must be ' +
  '<a href=https://reviewersedition.org>Reviewers Editions</a> ' +
  'like <code>1e</code> and <code>5e1u2d</code>.'
