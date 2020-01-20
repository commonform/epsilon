document.addEventListener('click', (event) => {
  var target = event.target
  if (target.className.indexOf('commentButton') === -1) return
  var sibling = target.nextElementSibling
  window.requestAnimationFrame(() => {
    sibling.className = sibling.className.replace('hidden', '')
    target.className = target.className + ' hidden'
  })
})
