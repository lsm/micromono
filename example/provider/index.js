var Service = require('micromono').Service;


function DB() {
  this.save = function(post, callback) {
    // A mockup db api
    callback(null, post);
  };
}

var db = new DB();

module.exports = Service.extend({
  packagePath: __dirname,

  baseUrl: '/provider-prefix',

  routes: {
    'get::/blog/:title': function(req, res) {
      // find blog with title from db
      var post = {
        title: req.params.title,
        content: 'Example blog content'
      };
      res.send(post);
    },

    'post::/blog/create': 'createPost'
  },

  //
  /**
   * Initialize function, do setup for your service here.
   * Resolve the promise when the initialization is done.
   *
   * @return {Promise}
   */
  init: function() {
    var promise = new Promise(function(resolve, reject) {
      setTimeout(resolve, 1000);
    });

    return promise;
  },

  // the request to 'post::/blog/create' will map to this function
  createPost: function(body, callback) {
    // save the post
    var post = {
      title: body.title,
      content: body.content
    };

    console.log(post);

    db.save(post, callback);
  }
});