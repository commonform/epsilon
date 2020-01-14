module.exports = () => {
  var logo = '<img id=logo src=/logo.svg>'
  return `
<header role=banner>
  ${process.env.NODE_ENV === 'test' ? '' : logo}
  <h1>Common Form</h1>
</header>
  `.trim()
}
