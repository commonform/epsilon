var path = require('path')
var pump = require('pump')
var send = require('send')

var routes = module.exports = require('http-hash')()

// Reminder: Add new route names to handle blacklist.
routes.set('/', require('./homepage'))
routes.set('/account', require('./account'))
routes.set('/confirm', require('./confirm'))
routes.set('/edit', require('./edit'))
routes.set('/email', require('./email'))
routes.set('/forgot', require('./forgot'))
routes.set('/forms/:digest', require('./forms'))
routes.set('/login', require('./login'))
routes.set('/logout', require('./logout'))
routes.set('/password', require('./password'))
routes.set('/publications', require('./publish'))
routes.set('/reset', require('./reset'))
routes.set('/signup', require('./signup'))

var STATIC_FILES = [
  'editor.bundle.js',
  'favicon.ico',
  'forms.css',
  'logo-on-white.png',
  'logo.svg',
  'normalize.css',
  'ui.css'
]
STATIC_FILES.forEach((file) => {
  var filePath = path.join(__dirname, '..', 'static', file)
  routes.set('/' + file, (request, response) => {
    pump(send(request, filePath), response)
  })
})
