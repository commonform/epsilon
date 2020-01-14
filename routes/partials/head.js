module.exports = () => {
  var stylesheets = `
  `.trim()
  return `
<head>
  <meta charset=UTF-8>
  <title>Common Form</title>
  ${process.env.NODE_ENV === 'test' ? '' : stylesheets}
  <link rel=stylesheet type=text/css href=/normalize.css>
  <link rel=stylesheet type=text/css href=/styles.css>
</head>
  `.trim()
}
