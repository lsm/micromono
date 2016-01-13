var assign = require('lodash.assign')
var Peers = require('weighted-round-robin')
var EventEmitter = require('eventemitter3')

/**
 * A simple roundrobin scheduler based on `weighted-round-robin`.
 *
 * @constructor
 * @return {Scheduler}  Instance of scheduler.
 */
var Scheduler = module.exports = function MicroMonoScheduler() {
  this._peers = new Peers()
}

assign(Scheduler.prototype, EventEmitter.prototype)

/**
 * Add an item to the scheduler.
 *
 * @param {Object} item  An object represents some kind of resources.
 */
Scheduler.prototype.add = function(item) {
  if (item) {
    item._scheduler_id = this._peers.add({
      item: item,
      weight: 50
    })
    this.emit('add', item)
  }
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
  this._peers.remove(item._scheduler_id)
  this.emit('remove', item)
}

/**
 * Find out if the item is existed in the scheduler pool.
 *
 * @param  {Any}          item The item to compare.
 * @param  {Function}     compare The comparation function.
 * @return {Boolean}      True if the comparation function returns true.
 */
Scheduler.prototype.hasItem = function(item, compFn) {
  var has = false
  var oldItem

  this._peers.each(function(peer) {
    if (true === has) {
      return
    } else {
      has = compFn(peer.item, item)
      if (has) {
        oldItem = peer.item
      }
    }
  })

  return has ? oldItem : false
}

Scheduler.prototype.each = function(fn) {
  this._peers.each(function(peer) {
    fn(peer.item)
  })
}
