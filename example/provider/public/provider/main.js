'use strict';

// import Model from 'model';
var Model = require('provider/model');
require('provider/style.css!');
require('provider/main.css!');

new Model('john');

var name = 'Bob';
var time = 'today';

console.log('Hello %s, how are you %s?', name, time);
