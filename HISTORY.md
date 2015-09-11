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
