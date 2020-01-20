const classnames = require('classnames')
const escape = require('../../util/escape')
const group = require('commonform-group-series')
const has = require('has')
const html = require('../html')
const linkify = require('../../util/linkify')
const longDate = require('../../util/long-date')
const merkleize = require('commonform-merkleize')
const predicate = require('commonform-predicate')
const samePath = require('commonform-same-path')

// TODO: Figure out commenting on displayed components.

module.exports = function (options) {
  if (!options.mappings) options.mappings = []
  if (!options.comments) options.comments = []
  const {
    account,
    comments,
    form,
    loaded,
    mappings,
    resolutions
  } = options
  const tree = merkleize(loaded)
  const digest = tree.digest
  return html`
    ${renderTableOfContents(loaded, resolutions)}
    <article class=commonform>
      ${renderForm({
        account,
        comments,
        depth: 0,
        form,
        loaded,
        mappings,
        path: [],
        resolutions,
        tree
      })}
      ${account && renderCommentForm({
        form: digest,
        root: digest
      })}
    </article>
    <script>window.form = ${JSON.stringify(form)}</script>
    <script>window.loaded = ${JSON.stringify(loaded)}</script>
    <script>window.resolutions = ${JSON.stringify(resolutions)}</script>
    <script>window.mappings = ${JSON.stringify(mappings)}</script>
    <script>window.comments = ${JSON.stringify(comments)}</script>
    <script>window.tree = ${JSON.stringify(tree)}</script>
  `
}

function renderTableOfContents (form, resolutions) {
  if (!containsHeading(form)) return ''
  return html`
<header class=toc>
  <h2>Contents</h2>
  ${renderContents(form, resolutions, [])}
</header>
  `
}

function renderContents (form, resolutions, path) {
  if (!containsHeading(form)) return ''
  const items = form.content.reduce((items, element, index) => {
    const headingHere = has(element, 'heading')
    const isChild = has(element, 'form')
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
    const classes = classnames({ component: isComponent })
    let li = `<li class="${classes}">`
    if (headingHere) li += renderReference(element.heading)
    else li += '(No Heading)'
    if (isChild) {
      li += renderContents(
        element.form,
        resolutions,
        childPath.concat('form')
      )
    }
    li += '</li>'
    return items.concat(li)
  }, [])
  return html`<ol class=toc id=toc>${items}</ol>`
}

function containsHeading (form) {
  return form.content.some((element) => (
    has(element, 'heading') ||
    (
      has(element, 'form') &&
      (
        has(element, 'heading') ||
        containsHeading(element.form)
      )
    )
  ))
}

function renderForm (options) {
  const {
    account,
    comments,
    depth,
    form,
    loaded,
    mappings,
    path,
    resolutions,
    tree
  } = options
  let offset = 0
  const digest = tree.digest
  const formGroups = form && group(form)
  const loadedGroups = group(loaded)
    .map((loadedGroup, index) => {
      const formGroup = formGroups && formGroups[index]
      const returned = loadedGroup.type === 'series'
        ? renderSeries({
          account,
          comments,
          depth: depth + 1,
          offset,
          path,
          formSeries: formGroup,
          loadedSeries: loadedGroup,
          mappings,
          tree,
          resolutions
        })
        : renderParagraph({
          offset,
          path,
          paragraph: loadedGroup,
          mappings
        })
      offset += loadedGroup.content.length
      return returned
    })
  return html`
    ${loadedGroups}
    ${renderComments({
      account,
      comments: comments.filter(comment => comment.form === digest),
      root: digest
    })}
  `
}

function renderCommentForm (options) {
  const { context, form, replyTo, root } = options
  let contextMarkup = ''
  if (context) {
    contextMarkup = html`
<input type=hidden name=context value=${context}>
    `
  } else {
    contextMarkup = html`
<p>
  <label>
    Comment on this form:
    <select name=context>
      <option value=${root}>in this context</option>
      <option value=${form} selected>anywhere it appears</option>
    </select>
  </label>
</p>
    `
  }

  let replyTos = ''
  if (replyTo) {
    replyTos = replyTo.map((uuid) => {
      return html`
<input type=hidden name="replyTo[]" value="${uuid}">
      `
    })
  }

  return html`
    <button class="commentButton">
      ${replyTo ? 'Reply' : 'Comment'}
    </button>
    <form class="comment commentForm hidden" action=/comments method=post>
      ${contextMarkup}
      ${replyTos}
      <input type=hidden name=form value=${form}>
      <textarea name=text required></textarea>
      <button type=submit>Publish Comment</button>
    </form>
  `
}

function renderComments (options) {
  const { account, comments, root } = options
  const roots = comments
    .filter((comment) => comment.replyTo.length === 0)
    .sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp))
  return roots
    .map((comment) => renderComment({
      account,
      comment,
      comments,
      parents: [],
      root
    }))
    .join('')
}

function renderComment (options) {
  const { account, comment, comments, parents, root } = options
  const uuid = comment.uuid
  const withParent = [uuid].concat(parents)
  const replies = comments.filter((comment) => {
    const slice = comment.replyTo.slice(0, withParent.length)
    return (
      withParent.length === slice.length &&
      slice.every((element, index) => element === withParent[index])
    )
  })
  var children = replies.map((reply) => renderComment({
    comment: reply,
    parents: withParent,
    comments
  }))
  if (account) {
    var replyForm = renderCommentForm({
      form: comment.form,
      root,
      context: comment.context,
      replyTo: withParent
    })
  }
  var content = comment.text
    .split('\n\n')
    .map((text) => `<p>${linkify(escape(text))}</p>`)
  return html`
    <aside class=comment id=${uuid}>
      ${content}
      <p class=byline>
        &mdash;&nbsp;${publisherLink(comment.handle)},
        ${escape(longDate(new Date(comment.date)))}
      </p>
      ${children}
      ${account && replyForm}
    </aside>
  `
}

function publisherLink (handle) {
  return `<a href="/${escape(handle)}">${escape(handle)}</a>`
}

function renderSeries (options) {
  const {
    account,
    comments,
    depth,
    formSeries,
    loadedSeries,
    mappings,
    offset,
    path,
    resolutions,
    tree
  } = options
  return loadedSeries.content
    .map((loadedChild, index) => {
      const loadedForm = loadedChild.form
      const childTree = tree.content[offset + index]
      const digest = childTree.digest
      const childPath = path.concat('content', offset + index)
      const resolution = resolutions.find((resolution) => samePath(resolution.path, childPath))
      const classes = classnames({
        conspicuous: loadedForm.conspicuous,
        component: resolution
      })
      const heading = loadedChild.heading
      return html`
        <section class="${classes}">
        ${heading && renderHeading(heading)}
        ${resolution && resolutionLink(resolution)}
        ${renderForm({
          account,
          comments,
          depth,
          form: formSeries ? formSeries.content[index].form : null,
          loaded: loadedForm,
          mappings,
          path: childPath.concat('form'),
          resolutions,
          tree: childTree
        })}
        ${account && renderCommentForm({
          root: tree.digest,
          form: digest
        })}
        </section>
      `
    })
    .join('')
}

function resolutionLink (resolution) {
  let returned = [
    resolution.publisher,
    resolution.project,
    resolution.edition
  ].map(escape).join('/')
  if (resolution.upgrade && resolution.specified !== resolution.edition) {
    returned += ` (upgraded from ${editionLink(resolution)})`
  }
  return returned
}

function editionLink (publication) {
  var href = '/' + [
    publication.publisher,
    publication.project,
    publication.edition
  ].join('/')
  return `<a href="${href}">${escape(publication.edition)}</a>`
}

function renderHeading (heading) {
  return `<h1 class=heading id="heading:${encodeURIComponent(heading)}">${escape(heading)}</h1>`
}

function renderParagraph (options) {
  const {
    mappings,
    offset,
    paragraph,
    path
  } = options
  const content = paragraph.content
    .map((element, index) => {
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
        const value = matchingValue({
          path: blankPath,
          mappings: mappings
        })
        if (value) {
          return `<input type=text class=blank data-path='${blankPath}' value="${escape(value)}" disabled>`
        } else {
          return `<input type=text class=blank data-path='${blankPath}' disabled>`
        }
      } else if (predicate.reference(element)) {
        return renderReference(element.reference)
      }
    })
  return html`<p>${content}</p>`
}

function renderReference (heading) {
  return `<a class=reference href="#heading:${encodeURIComponent(heading)}">${escape(heading)}</a>`
}

function matchingValue (options) {
  const { mappings, path } = options
  const length = mappings.length
  for (let index = 0; index < length; index++) {
    const mapping = mappings[index]
    if (samePath(mapping.blank, path)) return mapping.value
  }
}
