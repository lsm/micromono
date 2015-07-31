0.1.17 (2015)
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
