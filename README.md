<p align="center">
  <img src="doc/micromono-logo.png" width="200px"/>
</p>

# MicroMono
[![Join the chat at https://gitter.im/lsm/micromono](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/lsm/micromono?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

MicroMono is a tool that allows you to develop giant, monolithic application in micro-service style.  It can also convert existing applications with very little effort. More accurately, it allows people to separate features into **micro-monolithic services/apps** and run them together as **a single system** transparently, just as before.  The micro-services architecture itself [has many benefits](http://eugenedvorkin.com/seven-micro-services-architecture-advantages/) in [different ways](http://damianm.com/articles/human-benefits-of-a-microservice-architecture/).  It becomes increasingly easier and more practical to apply these days due to the widely adopted container virtuallization technologies (e.g. Docker & its ecosystem). But, the micro-services approach is also a [double-edged sword](http://martinfowler.com/articles/microservice-trade-offs.html) and it is of course [not a free lunch](http://highscalability.com/blog/2014/4/8/microservices-not-a-free-lunch.html).  Sometimes you have to rewrite the entire application to meet the requirements of the new architecture.  Unfortunately, even with the rewrite, the application may not be as elegant and efficient as desired due to the complexity and the costs spiraling out of control.  Micromono's goal is to let you enjoy all the benefits of micro-services while keeping you away from the other edge of the sword.

*`Current implementation of micromono is purely in node.js and is still in its early stages.  We need your help to make it better.  So any suggestions, pull requests or thoughts (design, other languages etc.) are always welcome.  Don't forget to star it on GitHub or share it with others who might be interested.`*

## How It Works

MicroMono involves 3 parts of application development at this time:

- **Web framework** (http routing, middleware, page rendering etc.)
- **Remote procedure calls** (RPC)
- **Front-end code management** (static asset files of javacript/css).

Sounds familiar, right? MicroMono is built with proven, open source frameworks and libraries (e.g. [express](http://expressjs.org) and [JSPM](http://jspm.io/)).  You will find yourself right at home when working with MicroMono if you have ever used any of these tools before.
<a name="two_components"></a>
## Two Components

In MicroMono, you will generally have 2 different types of components:
- **[Server](README.md#server)** serves requests directly from clients and proxies to the services behind it.
- **[Service](README.md#service)** runs the code which provide the actual feature.

![](doc/images/1-components.png)
<a name="two_components_service"></a>
### Service

A service is a standalone package which groups related features together as an unit. It could have only one RPC endpoint, or it may have a http routing code and client side dependencies. You can think of it as a micro application with everything you need to run that part of the business logic.  In current node.js implementation it is also a npm package. So in the `package.json` file you can define npm depedencies as well as the required libraries for client-side code. But, this doesn't mean that you have to write your services in node.js. We will cover more about this topic in section [Development in other languages](README.md#develop-in-other-languages).
<a name="two_components_service_define_a_service"></a>
#### Define A Service

Here's an example that shows how to define a simple service which handles http request/response.

```javascript
// Require micromono and get the Service base class
var Service = require('micromono').Service;

// Subclass Service class to define your service
// (Backbone/Ampersand style inheritance)
var SimpleHttpService = Service.extend({
  // `route` is the object where you define all your routing handlers
  route: {
    'get::/hello/:name': function(req, res) {
      // Basically, this handler function will be directly attached to
      // internal express instance created by micromono. So, any express
      // route handler could be ported to micromono without any modification.
      var name = req.params.name;
      res.send('Hello, ' + name);
    }
  }
});
```

The `'get::/hello/:name': function(req, res){...}` equivalents to:

```javascript
var app = express();
app.get('/hello/:name', function(req, res){
  var name = req.params.name;
  res.send('Hello, ' + name);
});
```

For more detailed information about http routing, middleware or page rendering please go to [Web Framework](#web_framework).
<a name="two_components_service_service_initialization"></a>
#### Service Initialization

Each service could have an initialization function `init`. You can do some preparation works here. For example, connect to database or setup internal express server. The `init` function takes no arguments and an instance of `Promise` need to be returned. You need to resolve the returned `Promise` after the work has been done or reject it if there's an error. Let's see an example:

```javascript
var bodyParser = require('body-parser');
var Service = require('micromono').Service;
var MongoClient = require('mongodb').MongoClient;

module.exports = Service.extend({
  // initialization function takes no arguments
  init: function() {
    // get the internal express instance
    var app = this.app;
    // use a middleware
    app.use(bodyParser.json());

    var self = this;
    // create a new promise instance
    var promise = new Promise(function(resolve, reject){
      // do the async operation (connect)
      MongoClient.connect('127.0.0.1', function(err, db){
        if (err) {
          // reject the promise if there's an error
          reject(err);
          return;
        }
        self.db = db;
        // resolve when done
        resolve();
      });
    });
    // init function should return a promise no matter what
    return promise;
  }
});
```

We will discuss more about **running a service** in section [Local And Remote](#local_and_remote)
<a name="two_components_server"></a>
### Server

The second type is the part which actually glues all the services together and boots up a **server** to serve requests directly from clients.

The **server** code is very simple and straight forward. With a few changes you can have MicroMono running cohesively within your existing [express](http://expressjs.org) server.

```javascript
// Require micromono and call to get an instance
var micromono = require('micromono')();

// Require the services you need.
// In this step, micromono will attempt to locate the required package on your local machine.
// If it fails it will try to probe from the network.
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
<a name="local_and_remote"></a>
## Local And Remote

As we mentioned at the beginning. The pros and cons of micro-services architecture are obvious and have been widely discussed. MicroMono allows you to **choose the right trade-offs for the right scenario**. If you application has 10 services, you may run all the 10 services on your local dev machine. Or run 1 service which you are developing locally and use the rest 9 of them (stable/finished services) remotely through network. Having a completely different setup for deployment or testing services in parallel? Imagination is your only limitation. The most critical thing is **being able to use any services locally or remotely without knowing the difference or changing the code**. MicroMono gives you this ability by rebuilding the exact service class based on service announcement. This is the most important feature MicroMono brings to the table and you won't feel it as MicroMono does the job behind the scenes. It is true no matter what you are dealing with: http request, RPC or front-end scripts. 

![](doc/images/2-mixed.png)

<a name="web_framework"></a>
## Web Framework

MicroMono wraps a thin layer on top of the express framework.  So, existing express applications should be able to easily be ported without any problems.  In this section we will go through 3 topics to understand the web framework part of MicroMono: **[http routing](README.md#http-routing)**, **[middleware](README.md#middleware)** and **[page rendering](README.md#page-rendering)**.
<a name="web_framework_http_routing"></a>
### Http routing

As you can see in the earlier example. You could define http routing handlers by putting the definition in the 'route' object property when you extend the 'Service' with following format:

```javascript
route: {
  '[http method]::[matching string]': '[request handler function or array]',
  ...
}
```

- **object key** defines the http method and matching string separated with double colons.
- **value** could be a function which will be the handler of the path. Or array of functions which contains middleware functions as well as route handler.

Actually you want read more documentation of express to get better understanding of how routing works as micromono basically maps the definition directly to the express. Here is an example of using middleware for a particular route:

```javascript
var bodyParser = require('body-parser');
var Service = require('micromono').Service;

module.exports = Service.extend({
  route: {
    // parse form data only for this path
    'post::/update':[bodyParser.urlencoded(), function(req, res){
      var body = req.body;
      // do something with body
      ...
    }]
  }
});
```
<a name="web_framework_middleware"></a>
### Middleware

Normally, middleware is just piece of code which can be plugged-in into your routing system to modify the http request or response stream on the fly. In detail, there are 4 things you can alter:

- Request header (meta)
- Request body (stream)
- Response header (meta)
- Response body (stream)

Some middleware may modify all 4 of them, some may change 1 and some just need the information and do nothing (e.g. logging). Most middleware works fine locally, as they are just some code and don't require external/remote resources. But, some of them you may want to run remotely as services, due to the complexity of the configuration. In MicroMono in order to support remote middleware we separate them into 2 categories: **Semi-remote** and  **Fully-remote** middleware services.

*`Note: When we are talking about remote middleware we mean the ability to use that middleware remotely as a service. Which means you still can use them locally as any other normal middleware you have.`*
<a name="web_framework_middleware_semi_remote_middleware"></a>
#### Semi-remote middleware

Semi-remote middleware modifies only the meta info of request/response or takes over the control of request/response completely. Authentication middleware would be a perfect example of this scenario. Let's take a closer look at the whole authentication process:

1. Auth middleware gets the request
2. Check if we can get/verify user info from the request data:

  2.1 Auth successfully, add user info to request and let the request keep going to the next middleware or routing handler.
  
  2.2 Auth failed, redirect request to a designated location (e.g. login page)

As we can see, if auth successfully the response stream of routing handler could be sent directly back to the client without going through the auth middleware. Or, the response from auth middleware would be sufficient to send to client without touching any other middleware or routing handler in the case of failure authentication. In MicroMono the above semi-remote authentication middleware works like this:

1. MicroMono server gets the request from client.
2. Proxy the request to right service.
3. Service gets the request and proxy the request to remote middleware.
4. Remote middleware does the work and responses to the service.
5. Depends on the response of remote middleware:

  5a. Request will be modified and will be passed to the next handler.
  
  5b. Response data from middleware will be sent back to the client directly and the original request will not go any further.
  
6. The route handler gets the requests and sends response back to micromono server.
7. Server gets the response and sends back to the client.

![](doc/images/3-middleware.png)
<a name="web_framework_middleware_fully_remote_middleware"></a>
#### Fully-remote middleware

Fully-remote middleware is easier to understand. It's only a normal middleware running remotely like a proxy. (Currently not supported by micromono)

Having any kind of remote middleware will of course slow down the performance dramatically, but sometimes it's worth it, to reduce the complexity of deployment and provide a more modularized architecture. MicroMono is focused on giving you the most flexibility and allowing you choose the trade-offs.
<a name="web_framework_page_rendering"></a>
### Page rendering

*Coming very soon. Please watch or star the project.*
<a name="rpc"></a>
## RPC

*Coming soon*
<a name="front_end_asset_management"></a>
## Front-end asset management

*Coming soon*

## Discuss

On hacker news: https://news.ycombinator.com/item?id=9969201

## License

MIT
