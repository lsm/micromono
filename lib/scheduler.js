var Peers = require('weighted-round-robin');

/**
 * A simple roundrobin scheduler based on `weighted-round-robin`.
 *
 * @constructor
 * @return {Scheduler}  Instance of scheduler.
 */
var Scheduler = module.exports = function MicroMonoScheduler() {
  this._peers = new Peers()
}

/**
 * Add an item to the scheduler.
 *
 * @param {Object} item  An object represents some kind of resources.
 */
Scheduler.prototype.add = function(item) {
  item._scheduler_id = this._peers.add({
    item: item,
    weight: 50
  })
}

/**
 * Get an item from the scheduler.
 *
 * @return {Object}  An object represents some kind of resources.
 */
Scheduler.prototype.get = function() {
  var p = this._peers.get()
  return p && p.item
}

/**
 * Remove an item from the scheduler.
 *
 * @param  {Object} item  An object represents some kind of resources.
 */
Scheduler.prototype.remove = function(item) {
  this.remove(item._scheduler_id)
}
