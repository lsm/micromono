var assign = require('lodash.assign')
var EventEmitter = require('events').EventEmitter

/**
 * A simple roundrobin scheduler.
 *
 * @constructor
 * @return {Scheduler}  Instance of scheduler.
 */
var Scheduler = module.exports = function MicroMonoScheduler() {
  this._items = []
  this.n = 0
}

assign(Scheduler.prototype, EventEmitter.prototype)

/**
 * Add an item to the scheduler.
 *
 * @param {Object} item  An object represents some kind of resources.
 */
Scheduler.prototype.add = function(item) {
  if (item) {
    this._items.push(item)
    this.emit('add', item)
  }
}

/**
 * Get an item from the scheduler.
 *
 * @return {Object}  An object represents some kind of resources.
 */
Scheduler.prototype.get = function() {
  var items = this._items
  return items[this.n++ % items.length]
}

/**
 * Remove an item from the scheduler.
 *
 * @param  {Object} item  An object represents some kind of resources.
 */
Scheduler.prototype.remove = function(item) {
  this._items = this._items.filter(function(i) {
    return item !== i
  })
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
  var oldItem = false

  this._items.some(function(_item) {
    if (compFn(_item, item))
      oldItem = _item
    return oldItem
  })

  return oldItem
}

Scheduler.prototype.each = function(fn) {
  this._items.forEach(function(item) {
    fn(item)
  })
}
