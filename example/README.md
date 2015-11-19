MicroMono express + passport example
====================================


This is an exmaple shows how you can use expressjs and passportjs together with micromono to create a simple web app with password protected page. The most important feature micromono provides is the ability to run services either in one process or run them individually in different processes or machines, aka. remote services.


## Quick Start

This example contains 3 services: `account`, `home` and `io`:

- **[Account](/example/account)** is the service/app which provides login/logout features, auth middleware and a api for getting user by id.
- **[Home](/example/home)** is the example shows how to use the features provided by the `account` service.
- **[IO](/example/io)** is a websocket example using socket.io.

We also have a **[server](/example/server)** sub-folder which demostrates how to run the above services together with a existing express application.

Please make sure you have nodejs and npm installed before you run following commands in terminal.

### Installation

Clone repository:

    git clone https://github.com/lsm/micromono

Go to the example folder and install dependencies:

    cd micromono/example

    make install

The script will install dependencies for all sub-folders: `account`, `home` and `server`.

### Run it in monolithic mode

In this mode, we use `account` and `home` as normal npm package and everything runs in the same process (server and services).

    make mono

Then open [http://127.0.0.1:3000](http://127.0.0.1:3000)

Or try the `IO` example by running:

    make mono-io

And open [http://127.0.0.1:3000/io](http://127.0.0.1:3000/io)

### Run it in microservice mode

Also, you can choose to run `account`, `home` and `server` in separate processes. This requires us to run them in three separate terminals:

First, run `account` service by:

    DEBUG=micromono* node account/index.js

Then, do the same thing for `home` service in second terminal:

    DEBUG=micromono* node home/index.js

Finally, run our server to start serving requests in the thrid terminal:

    DEBUG=micromono* node server/server.js --service account,home

Then open [http://127.0.0.1:3000](http://127.0.0.1:3000)
