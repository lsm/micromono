/**
 * Module dependencies
 */

var path = require('path')
var bodyParser = require('body-parser')

// setup micromono
var MicroMono = require('micromono')
var Service = MicroMono.Service
var micromono = new MicroMono()

// require account service
var Account = micromono.require('account')
var account = new Account()

/**
 * Example service which render pages and use other service as dependency.
 */
var Home = module.exports = Service.extend({
  packagePath: __dirname,
  baseUrl: '/home',

  use: {
    // tell micromono to use `layout` middleware at the server side
    // for request urls in the array.
    'layout': ['/private$', '^/public$', '^/$', '/:username/:project']
  },

  route: {
    // a password protected page
    'get::/private': [account.middleware.auth(), function privatePage(req, res) {
      // var user = req.user
      account.api.getUserById(req.user.id, function(user) {
        res.render('page', {
          title: 'Home Private Page',
          name: user.username + ', you can not see this page unless you have logged in successfully.',
          id: user.id,
          password: user.password
        })
      })
    }],

    'get::^/public': function publicPage(req, res) {
      res.render('page', {
        title: 'Home Public Page',
        name: 'anonymouse'
      })
    },

    'get::^/': function index(req, res) {
      res.render('index')
    },

    'get::/project/:project/:id': function(req, res) {
      res.send(['project', req.params.project, req.params.id].join('/'))
    },

    'get::/user/:name': function(req, res) {
      var context = {
        name: req.params.name
      }
      var accept = req.accepts(['html', 'json'])
      if ('json' === accept) {
        // We don't need the rendered content here as
        // this is probably a api xhr request. (Client side rendering)
        res.json(context)
      } else {
        // A html page request, send the rendered data for first page load.
        // (Server side rendering)
        context.yield = 'this is data rendered for page'
        res.json(context)
      }
    }
  },

  /**
   * Initialize function, do setup for your service here.
   * Resolve a promise when the initialization is done.
   *
   * @return {Promise}
   */
  init: function() {
    var app = this.app

    app.use(bodyParser.urlencoded({
      extended: false
    }))

    app.set('views', path.join(__dirname, './view'))
    app.set('view engine', 'jade')

    return Promise.resolve()
  }
})

// Start the service if this is the main file
if (require.main === module) {
  micromono.startService(Home)
}
