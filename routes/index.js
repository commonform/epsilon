var routes = module.exports = require('http-hash')()

routes.set('/', require('./homepage'))
routes.set('/account', require('./account'))
routes.set('/confirm', require('./confirm'))
routes.set('/email', require('./email'))
routes.set('/forgot', require('./forgot'))
routes.set('/login', require('./login'))
routes.set('/logout', require('./logout'))
routes.set('/password', require('./password'))
routes.set('/reset', require('./reset'))
routes.set('/signup', require('./signup'))
