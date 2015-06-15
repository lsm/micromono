var micromono = require('micromono');
var Service = micromono.Service;


function DB() {
  this.save = function(post, callback) {
    // A mockup db api
    callback(null, post);
  };
}

var db = new DB();

module.exports = Service.extend({
  routes: {
    'get::/blog/:title': function(title, callback) {
      // find blog with title from db
      var post = {
        title: title,
        content: 'Example blog content'
      };
      callback(null, post);
    },

    'post::/blog/create': 'createPost'
  },

  // Initialize function, do setup for your service here. Call the callback when
  // it's ready to serve requests.
  init: function(callback) {
    callback();
  },

  // the request to 'post::/blog/create' will map to this function
  createPost: function(body, callback) {
    // save the post
    var post = {
      title: body.title,
      content: body.content
    };

    db.save(post, callback);
  }
});
