0.1.109 (2015/01/23)
===================
- Close proxy after provider is removed.
- #15 Bug fix for proxying websocket requests.

0.1.37 (2015/12/02)
===================
- Expose page info to route.

0.1.36 (2015/12/01)
===================
- Quick fix: routes should be optional.

0.1.35 (2015/11/30)
===================
- Bug fix for route handler can't get `next`.
- Escape unsafe characters when render template with layout middleware `web/middleware/express-layout.js`.
- Accept using middleware name in route definition.
```javascript
route: {
'/hello': ['layout', handlerFn]
}
```
- Fix incorrect parameter for express `router.param`.


0.1.34 (2015/11/25)
===================
- [Breaking] Rename sub command `micromono asset` to `micromono bundle`.
- [Breaking] `Service#use` now accepts http method prefix same as in `route`. e.g. `post::/user/update`.
- [Breaking] Rename `-a` to `-b` for `--bundle-asset`.
- Make main export stateless and export `MicroMonoServer` to support multipe micromono instances in one process.


0.1.33 (2015/11/18)
===================
- Make the layout middleware more friendly for isomorphic rendering.


0.1.32 (2015/11/13)
===================
- Expose more asset info in service announcement.
- Fix bugs for bundling asset.


0.1.31 (2015/11/09)
===================
- Support using `^` to override `baseUrl`.


0.1.30 (2015/10/30)
===================
- Bundle static asset on the fly with option `-a` or `--bundle-asset`.


0.1.29 (2015/10/30)
===================
- Add command `micromono asset` for building asset files.


0.1.28 (2015/10/28)
===================
- Bug fix for setting/getting upgrade url.
- Bug fix for proxying websockets request.
- Bug fix for `setHttpServer`


0.1.27 (2015/10/26)
===================
- Bug fix for setting http server for services.
- Bug fix for merge and install jspm dependencies.
- Get micromono specific settings from property `micromono` of package.json.


0.1.26 (2015/10/23)
===================
- [Breaking] Functions will be treated as rpc only when they are defined under
property `api` when you extend a Service.

```javascript
var MyService = Service.extend({

  // functions defined under `api` property will be exposed through rpc.
  api: {
    // this function could be called remotely like this:
    // myService.api.rpcMethod()
    rpcMethod: function() {
      // body...
    }
  }

  // this will not be exposed as a rpc endpoint
  myServiceFunc: function() {
    // body...
  }
})
```

- Rewrite and reorganize code to an adaptive style to support different web
frameworks and rpc transporters through adapters.
- Add standalone service manager class.
- Add standalone scheduler class.
- `micromono()` now returns an instance of `MicroMonoServer` class.
- Use `axon` as default rpc transporter.
- Use `cmdenv` to unify settings from environment and command line options.
- Change to no semicolon coding style.
- Add lots of debugging info.


0.1.25 (2015/09/18)
===================
- Support mounting multiple `publicURL` to the same local asset directory.


0.1.24 (2015/09/12)
===================
- Upgrade jspm to version 0.16.2
- Use `jspm.directories.baseURL` instead of `jspm.directories.lib` as directory
of local static asset.


0.1.23 (2015/09/10)
===================
- Allow setting upgrade url in service definition.
- Allow setting service name by using `Service#name`.

0.1.22 (2015/08/26)
===================
- Generate public path from `jspm.directories.lib` if possible. Otherwise fall back to use `jspm.directories.publicURL`.
- [Breaking change] New format for defining server middleware in `Service.use`.
- [Breaking change] Rename built-in middleware `partial-render` to `layout`.

0.1.21 (2015/08/11)
===================
- Bug fix for asset/jspm.

0.1.20 (2015/08/10)
===================
- Expose http `server` instance to service.
- Add WebSocket support (handle upgrade request).
- Add socket.io service example.
- Add server-side middleware support.

0.1.19 (2015/08/07)
===================
- [Breaking change] Use `startService` and `runServer` instead of `boot` to run service/server.
- Add `Makefile` for example.


0.1.18 (2015/08/05)
===================
- Use socket.io as the default transporter for RPC.
- Only one micromono instance per process.
- Fully functional express+passport example.
- Use a separate connect instance for middleware.
- Some bug fixes.

0.1.17 (2015/07/30)
===================
- Load services with command line option `--service`.
- Allow waiting for services with command line option `--allow-pending`.


0.1.16 (2015/07/30)
===================
- [Breaking Changes] Use `route` instead of `routes` when define a service.
- Bug fix for serving asset files.


0.1.15 (2015/07/23)
===================
- Bug fix for incorrect path of middleware router.


0.1.14 (2015/07/22)
===================
- Add remote middleware support.


0.1.13 (2015/07/14)
===================
The first usable version with following features:
  - Load services locally/remotely with service discovery.
  - Proxy remote asset requests and merge client side dependencies.
  - Proxy page/rest routing requests.
  - Compose partial html with local template on the fly.
  - Simple RPC system
