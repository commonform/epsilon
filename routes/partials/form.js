var classnames = require('classnames')
var escape = require('../../util/escape')
var group = require('commonform-group-series')
var html = require('../html')
var merkleize = require('commonform-merkleize')
var predicate = require('commonform-predicate')
var samePath = require('commonform-same-path')

var has = Object.prototype.hasOwnProperty

module.exports = function (form, loaded, options) {
  options = options || {}
  if (!options.mappings) options.mappings = []
  var tree = options.tree = merkleize(loaded.form)
  return html`
    ${renderTableOfContents(loaded.form, loaded.resolutions)}
    <article class=commonform>
      ${renderForm(0, [], form, loaded.form, tree, loaded.resolutions, options)}
    </article>
    ${scriptTag(form, loaded, options)}
  `
}

function renderTableOfContents (form, resolutions) {
  if (!containsHeading(form)) return ''
  return html`<header class=toc>
    <h2>Contents</h2>
    ${renderContents(form, resolutions, [])}
  </header>`
}

function renderContents (form, resolutions, path) {
  if (!containsHeading(form)) return ''
  return html`<ol class=toc id=toc>${
    form.content.reduce(function (items, element, index) {
      var headingHere = has.call(element, 'heading')
      var isChild = has.call(element, 'form')
      var componentOrForm = headingHere || isChild
      if (!componentOrForm) return items
      var hasHeading = (
        headingHere ||
        (isChild && containsHeading(element.form))
      )
      if (!hasHeading) return items
      var childPath = path.concat('content', index)
      var isComponent = resolutions.some(function (resolution) {
        return samePath(resolution.path, childPath)
      })
      var classes = classnames({
        component: isComponent
      })
      var li = `<li class="${classes}">`
      if (headingHere) {
        li += renderReference(element.heading)
      } else {
        li += '(No Heading)'
      }
      if (isChild) {
        li += renderContents(
          element.form,
          resolutions,
          childPath.concat('form')
        )
      }
      li += '</li>'
      return items.concat(li)
    }, [])}</ol>`
}

function containsHeading (form) {
  return form.content.some(function (element) {
    return (
      has.call(element, 'heading') ||
      (
        has.call(element, 'form') &&
        (
          has.call(element, 'heading') ||
          containsHeading(element.form)
        )
      )
    )
  })
}

function renderForm (depth, path, form, loaded, tree, resolutions, options) {
  var offset = 0
  var formGroups = form && group(form)
  var loadedGroups = group(loaded)
    .map(function (loadedGroup, index) {
      var formGroup = formGroups && formGroups[index]
      var returned = loadedGroup.type === 'series'
        ? renderSeries(
          depth + 1,
          offset,
          path,
          formGroup,
          loadedGroup,
          tree,
          resolutions,
          options
        )
        : renderParagraph(offset, path, loadedGroup, tree, options)
      offset += loadedGroup.content.length
      return returned
    })
    .join('')
  return html`${loadedGroups}`
}

function renderSeries (depth, offset, path, formSeries, loadedSeries, tree, resolutions, options) {
  return loadedSeries.content
    .map(function (loadedChild, index) {
      var loadedForm = loadedChild.form
      var childTree = tree.content[offset + index]
      var digest = childTree.digest
      var childPath = path.concat('content', offset + index)
      var resolution = resolutions.find(function (resolution) {
        return samePath(resolution.path, childPath)
      })
      var classes = classnames({
        conspicuous: loadedForm.conspicuous,
        component: resolution
      })
      return (
        `<section class="${classes}">` +
        ('heading' in loadedChild ? renderHeading(depth, loadedChild.heading) : '') +
        (resolution ? resolutionLink(resolution) : '') +
        (
          options.childLinks
            ? `<a class=child-link href=/forms/${digest}>${digest}</a>`
            : ''
        ) +
        renderForm(
          depth,
          childPath.concat('form'),
          formSeries ? formSeries.content[index].form : null,
          loadedForm,
          childTree,
          resolutions,
          options
        ) +
        '</section>'
      )
    })
    .join('')
}

function resolutionLink (resolution) {
  var returned = publicationLink(resolution)
  if (resolution.upgrade && resolution.specified !== resolution.edition) {
    returned += ` (upgraded from ${editionLink({
      publisher: resolution.publisher,
      project: resolution.project,
      edition: resolution.specified
    })})`
  }
  return returned
}

function publisherLink (publisher) {
  return `<a href="/${escape(publisher)}">${escape(publisher)}</a>`
}

function projectLink (publication) {
  var href = '/' + [
    publication.publisher,
    publication.project
  ].map(escape).join('/')
  return `<a href="${href}">${escape(publication.project)}</a>`
}

function editionLink (publication) {
  var href = '/' + [
    publication.publisher,
    publication.project,
    publication.edition
  ].map(escape).join('/')
  return `<a href="${href}">${escape(publication.edition)}</a>`
}

function publicationLink (publication) {
  return [
    publisherLink(publication.publisher),
    projectLink(publication),
    editionLink(publication)
  ].join('/')
}

function renderHeading (depth, heading) {
  return `<h1 class=heading id="heading:${encodeURIComponent(heading)}">${escape(heading)}</h1>`
}

function renderParagraph (offset, path, paragraph, tree, options) {
  return (
    '<p>' +
    paragraph.content
      .map(function (element, index) {
        if (predicate.text(element)) {
          return escape(element)
        } else if (predicate.use(element)) {
          const term = element.use
          const href = `#definition:${encodeURIComponent(term)}`
          return `<a class=use href="${href}">${escape(term)}</a>`
        } else if (predicate.definition(element)) {
          const term = element.definition
          const id = `definition:${encodeURIComponent(term)}`
          return `<dfn id="${id}">${escape(term)}</dfn>`
        } else if (predicate.blank(element)) {
          const blankPath = JSON.stringify(path.concat('content', offset + index))
          const value = matchingValue(blankPath, options.mappings)
          if (value) {
            return `<input type=text class=blank data-path='${blankPath}' value="${escape(value)}" disabled>`
          } else {
            return `<input type=text class=blank data-path='${blankPath}' disabled>`
          }
        } else if (predicate.reference(element)) {
          return renderReference(element.reference)
        }
      })
      .join('') +
    '</p>'
  )
}

function renderReference (heading) {
  return `<a class=reference href="#heading:${encodeURIComponent(heading)}">${escape(heading)}</a>`
}

function matchingValue (path, mappings) {
  var length = mappings.length
  for (var index = 0; index < length; index++) {
    var mapping = mappings[index]
    if (samePath(mapping.blank, path)) return mapping.value
  }
}

function scriptTag (form, loaded, options) {
  return `
    <script>window.form = ${JSON.stringify(form)}</script>
    <script>window.loaded = ${JSON.stringify(loaded)}</script>
    <script>window.mappings = ${JSON.stringify(options.mappings)}</script>
    <script>window.tree = ${JSON.stringify(options.tree)}</script>
  `
}
