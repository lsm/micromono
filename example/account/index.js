/**
 * Module dependencies
 */

var path = require('path');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var connect = require('connect');

// setup micromono
var MicroMono = require('micromono');
var Service = MicroMono.Service;
var micromono = new MicroMono();

// get passport
var passport = require('./passport');

// generate passport authentication function
var passportAuth = passport.authenticate('local', {
  successRedirect: '/account/protected',
  failureRedirect: '/account/login',
  failureFlash: false
});

function isAuthenticated(req, res) {
  if (req.user) {
    return true;
  } else {
    res.redirect('/account/login');
    return false;
  }
}


/**
 * Account service
 */
var Account = module.exports = Service.extend({
  packagePath: __dirname,
  baseUrl: '/account',
  middleware: {
    auth: function() {
      var self = this;
      return function(req, res, next) {
        if (req.user) {
          next();
        } else {
          self.connectAuth(req, res, function() {
            if (isAuthenticated(req, res)) {
              next();
            }
          });
        }
      };
    }
  },

  /**
   * Route definition property
   * @type {Object}
   */
  route: {
    /**
     * Example protected page
     */
    'get::/protected': function protected(req, res) {
      if (isAuthenticated(req, res)) {
        res.render('hello', {
          name: req.user.username
        });
      }
    },

    'get::/logout': function logout(req, res) {
      req.logout();
      res.redirect('/account/login');
    },

    'get::/login': function login(req, res) {
      res.render('login');
    },

    /**
     * Login form handler
     */
    'post::/login': [passportAuth, function loginOkay(req, res) {
      res.redirect('/account/protected');
    }]
  },

  init: function() {
    // get express instance
    var app = this.app;

    // setup a dedicated connect middleware for parsing data and session
    var connectAuth = connect();
    connectAuth.use(bodyParser.json());
    connectAuth.use(bodyParser.urlencoded({
      extended: false
    }));

    connectAuth.use(cookieParser());
    connectAuth.use(session({
      secret: 'micromono',
      resave: true,
      saveUninitialized: true
    }));

    connectAuth.use(passport.initialize());
    connectAuth.use(passport.session());

    // save the middleware for later usage
    this.connectAuth = connectAuth;

    // attach the connect auth middleware to our local express app
    app.use(connectAuth);

    // setup template engine
    app.set('views', path.join(__dirname, './view'));
    app.set('view engine', 'jade');

    return Promise.resolve();
  },

  getUserById: function(id, callback) {
    if (id === 1) {
      callback({
        id: 1,
        username: 'micromono',
        password: '123456'
      });
    } else {
      callback(null);
    }
  }
});

// Start the service if this is the main file
if (require.main === module) {
  micromono.boot(Account);
}
