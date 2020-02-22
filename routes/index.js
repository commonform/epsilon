const path = require('path')
const pump = require('pump')
const send = require('send')

const routes = module.exports = require('http-hash')()

// Reminder: Add new route names to handle blacklist.
routes.set('/', require('./homepage'))
routes.set('/account', require('./account'))
routes.set('/comments/:id', require('./comment'))
routes.set('/comments', require('./comments'))
routes.set('/confirm', require('./confirm'))
routes.set('/edit', require('./edit'))
routes.set('/email', require('./email'))
routes.set('/handle', require('./handle'))
routes.set('/forms/:digest', require('./forms'))
routes.set('/signin', require('./signin'))
routes.set('/signout', require('./signout'))
routes.set('/password', require('./password'))
routes.set('/publications', require('./publish'))
routes.set('/reset', require('./reset'))
routes.set('/signup', require('./signup'))
routes.set('/compare', require('./compare'))

const STATIC_FILES = [
  'comments.js',
  'editor.bundle.js',
  'favicon.ico',
  'forms.css',
  'logo-on-white.png',
  'logo.svg',
  'normalize.css',
  'ui.css'
]
STATIC_FILES.forEach(file => {
  const filePath = path.join(__dirname, '..', 'static', file)
  routes.set('/' + file, (request, response) => {
    pump(send(request, filePath), response)
  })
})
