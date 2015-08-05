/**
 * Module for setup passport with fake authentication
 */

var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

// User is hard coded for demostration purpose
var user = {
  id: 1,
  username: 'micromono',
  password: '123456'
};

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  if (user.id === id) {
    done(null, user);
  } else {
    done('Wrong id');
  }
});

passport.use(new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password'
  },

  function(username, password, done) {
    // check fake data for example
    if (username === user.username && password === user.password) {
      return done(null, user);
    } else {
      return done(null, false, {
        message: 'Username and passport do not match.'
      });
    }
  }));

module.exports = passport;
