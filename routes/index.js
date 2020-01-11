var routes = module.exports = require('http-hash')()

routes.set('/', require('./homepage'))
routes.set('/confirm', require('./confirm'))
routes.set('/login', require('./login'))
routes.set('/logout', require('./logout'))
routes.set('/signup', require('./signup'))
