<p align="center">
  <img src="doc/micromono-logo.png" width="200px"/>
</p>

# MicroMono
[![Join the chat at https://gitter.im/lsm/micromono](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/lsm/micromono?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)


MicroMono is a tool that allows you to develop giant, monolithic application in micro-service style.  It can also convert existing applications with very little effort. More accurately, it allows people to separate features into **micro-monolithic services/components/apps** and run them together as **a single system** transparently, just as before.  The micro-services architecture itself [has many benefits](http://eugenedvorkin.com/seven-micro-services-architecture-advantages/) in [different ways](http://damianm.com/articles/human-benefits-of-a-microservice-architecture/).  It becomes increasingly easier and more practical to apply these days due to the widely adopted container virtuallization technologies (e.g. Docker & its ecosystem). But, the micro-services approach is also a [double-edged sword](http://martinfowler.com/articles/microservice-trade-offs.html) and it is of course [not a free lunch](http://highscalability.com/blog/2014/4/8/microservices-not-a-free-lunch.html).  Sometimes you have to rewrite the entire application to meet the requirements of the new architecture.  Unfortunately, even with the rewrite, the application may not be as elegant and efficient as desired due to the complexity and the costs spiraling out of control.  Micromono's goal is to let you enjoy all the benefits of micro-services while keeping you away from the other edge of the sword.

*Current implementation of micromono is purely in node.js and is still in its early stages.  We need your help to make it better.  So any suggestions, pull requests or thoughts (design, other languages etc.) are always welcome.  Don't forget to star it on GitHub or share it with people who might be interested as well.*

# How it works

Micromono involves 3 major parts of application development right now:
- **Http server** (routing/middleware)
- **Remote procedure calls** (RPC)
- **Front-end code management** (static asset files of javacript/css).

Sounds familiar, right? Micromono is built with proven, open source frameworks and libraries.  You will find yourself at home when working with micromono if you have ever used any of these tools before.

In micromono, you will generally have 2 different types of code/packages.
The first type is the **service** package. A service package may contain an http routing code, RPC or client side dependencies. You can think of it as a micro application with everything you need to run that part of the business logic. In current node.js implementation it's also a npm package. So in the `package.json` file you can define npm depedencies as well as the required libraries for client-side code. But, this doesn't mean you have to write your services in node.js. We will cover more about this topic in section [Development in other languages]().
The second type is the code which actually glues all the services together and boots up a **server** to serve request directly from clients.

The **server** code is very simple and straight forward. With a few changes you can have micromono running cohesively with your express server.

```javascript
// Require micromono and call to get an instance
var micromono = require('micromono')();

// Require services you need
// In this step, micromono will attempt to locate the required package on your local machine.
// If it fails it will try to probe the service from network.
micromono.require('home');
micromono.require('account');

// Create an express instance
// We don't alter the express instance, so you can do what ever you want
// to the express instance and they will work as expected.
var app = require('express')();

// boot micromono with the express app
micromono.boot(app).then(function(){
    // start serving requests
    app.listen(3000);
});
```

## Http routing/middleware system
