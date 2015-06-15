/**
 * Module dependencies
 */
var Asset = require('./asset');

/**
 * Constructor
 * @return {[type]} [description]
 */
var MicroMono = module.exports = function MicroMono() {

};

MicroMono.prototype = {

  bundleAsset: function(packagePath) {
    var asset = new Asset(packagePath);
    this.asset = asset;
    return asset.bundle();
  },

  bootService: function(packagePath) {
    var self = this;
    // build and start asset server
    this.bundleAsset(packagePath).then(function() {
      console.log('JSPM info: ');
      console.log(self.asset.jspmInfo);
      self.asset.startAssetServer(process.env.PORT || 3000);
    });
  }
};
