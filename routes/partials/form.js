const classnames = require('classnames')
const escape = require('../../util/escape')
const group = require('commonform-group-series')
const html = require('../html')
const merkleize = require('commonform-merkleize')
const predicate = require('commonform-predicate')
const samePath = require('commonform-same-path')

const has = Object.prototype.hasOwnProperty

module.exports = function (form, loaded, options) {
  options = options || {}
  if (!options.mappings) options.mappings = []
  const tree = options.tree = merkleize(loaded.form)
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
      const headingHere = has.call(element, 'heading')
      const isChild = has.call(element, 'form')
      const componentOrForm = headingHere || isChild
      if (!componentOrForm) return items
      const hasHeading = (
        headingHere ||
        (isChild && containsHeading(element.form))
      )
      if (!hasHeading) return items
      const childPath = path.concat('content', index)
      const isComponent = resolutions.some(function (resolution) {
        return samePath(resolution.path, childPath)
      })
      const classes = classnames({
        component: isComponent
      })
      let li = `<li class="${classes}">`
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
  let offset = 0
  const formGroups = form && group(form)
  const loadedGroups = group(loaded)
    .map(function (loadedGroup, index) {
      const formGroup = formGroups && formGroups[index]
      const returned = loadedGroup.type === 'series'
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
      const loadedForm = loadedChild.form
      const childTree = tree.content[offset + index]
      const digest = childTree.digest
      const childPath = path.concat('content', offset + index)
      const resolution = resolutions.find(function (resolution) {
        return samePath(resolution.path, childPath)
      })
      const classes = classnames({
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
  let returned = publicationLink(resolution)
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
  const href = '/' + [
    publication.publisher,
    publication.project
  ].map(escape).join('/')
  return `<a href="${href}">${escape(publication.project)}</a>`
}

function editionLink (publication) {
  const href = '/' + [
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
  const length = mappings.length
  for (let index = 0; index < length; index++) {
    const mapping = mappings[index]
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
