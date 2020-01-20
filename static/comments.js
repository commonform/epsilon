document.addEventListener('DOMContentLoaded', () => {
  const elements = document.getElementsByClassName('yesscript')
  for (let index = 0; index < elements.length; index++) {
    const element = elements[index]
    element.className = element.className.replace('yesscript', '')
  }
})

document.addEventListener('click', event => {
  const target = event.target
  if (target.className.indexOf('commentButton') === -1) return
  const sibling = target.nextElementSibling
  window.requestAnimationFrame(() => {
    sibling.className = sibling.className.replace('hidden', '')
    target.className = target.className + ' hidden'
  })
})
