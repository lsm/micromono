/**
 * Module dependencies
 */

var path = require('path');
var bodyParser = require('body-parser');

// setup micromono
var MicroMono = require('micromono');
var Service = MicroMono.Service;
var micromono = new MicroMono();

// require account service
var Account = micromono.require('account');
var account = new Account();

/**
 * Example service which render pages and use other service as dependency.
 */
var Home = module.exports = Service.extend({
  packagePath: __dirname,
  baseUrl: '/',

  route: {
    // a password protected page
    'get::/private': [account.middleware.auth(), function private(req, res) {
      res.render('page', {
        title: 'Home Private Page',
        name: req.user.username + ', you can not see this page unless you have logged in successfully.'
      });
    }],

    'get::/public': function public(req, res) {
      res.render('page', {
        title: 'Home Public Page',
        name: 'anonymouse'
      });
    },

    'get::/': function index(req, res) {
      res.render('index');
    }
  },

  /**
   * Initialize function, do setup for your service here.
   * Resolve a promise when the initialization is done.
   *
   * @return {Promise}
   */
  init: function() {
    var app = this.app;

    app.use(bodyParser.urlencoded({
      extended: false
    }));

    app.set('views', path.join(__dirname, './view'));
    app.set('view engine', 'jade');

    return Promise.resolve();
  }
});

// Start the service if this is the main file
if (require.main === module) {
  micromono.boot(Home);
}
