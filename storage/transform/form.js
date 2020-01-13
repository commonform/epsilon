var has = require('has')
var runParallelLimit = require('run-parallel-limit')
var normalize = require('commonform-normalize')
var storage = require('../storage')

module.exports = function (entry, level, callback) {
  var form = entry.data
  var normalized = normalize(form)
  var batch = recurse(form, normalized.root, normalized, [], [])
  runParallelLimit(
    batch.map((task) => (done) => {
      var type = task.type
      if (type === 'form') {
        storage.form.create(task.digest, task.form, done)
      } else if (type === 'componentInForm') {
        storage.componentInForm.append(
          [task.publisher, task.project],
          { digest: task.digest, depth: task.depth },
          done
        )
      }
    }),
    3,
    callback
  )
}

function recurse (form, digest, normalized, batch, parents) {
  batch.push({ type: 'form', digest, form })
  form.content.forEach(function (element, index) {
    if (has(element, 'form')) {
      // The denormalized object, to be stored.
      var child = element.form
      // The normalized object, which has digests of child forms.
      var childDigest = normalized[digest].content[index].digest
      recurse(child, childDigest, normalized, batch)
    } else if (has(element, 'repository')) {
      [digest].concat(parents).forEach(function (digest, depth) {
        batch.push({
          type: 'componentInForm',
          publisher: element.publisher,
          project: element.project,
          digest,
          depth
        })
      })
    }
  })
  return batch
}
