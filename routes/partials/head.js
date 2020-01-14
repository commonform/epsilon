module.exports = () => {
  var stylesheets = `
<link rel=stylesheet type=text/css href=/normalize.css>
<link rel=stylesheet type=text/css href=/styles.css>
  `.trim()
  return `
<head>
  <meta charset=UTF-8>
  <title>Common Form</title>
  ${process.env.NODE_ENV === 'test' ? '' : stylesheets}
</head>
  `.trim()
}
