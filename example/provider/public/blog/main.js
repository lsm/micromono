'use strict';

// import Model from 'model';
var Model = require('blog/model');
require('blog/style.css!');
require('blog/main.css!');

new Model('john');

var name = 'Bob';
var time = 'today';

console.log('Hello %s, how are you %s?', name, time);
