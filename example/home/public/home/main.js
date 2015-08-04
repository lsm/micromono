'use strict';

// import Model from 'model';
var Model = require('home/model');
require('home/style.css!');
require('home/main.css!');

new Model('john');

var name = 'Bob';
var time = 'today';

console.log('Hello %s, how are you %s?', name, time);
