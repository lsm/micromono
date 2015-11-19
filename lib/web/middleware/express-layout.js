/**
 * Module dependencies
 */

var assign = require('lodash.assign')

/**
 * The remote partial composing middleware
 */
module.exports = function(app) {
  var layoutName = app.get('micromono layout name') || 'layout'
  app.set('micromono layout name', layoutName)

  return function renderLayout(req, res, next) {
    var _end = res.end
    var _write = res.write
    var _writeHead = res.writeHead

    var _headers
    res.writeHead = function(code, message, headers) {
      if (code) {
        res.statusCode = code
      }
      switch (typeof message) {
        case 'string':
          res.statusMessage = message
          break
        default:
        case 'object':
          _headers = headers
      }

      return res
    }

    function end(data, encoding, callback) {
      res.set('Content-Length', Buffer.byteLength(data, 'utf-8'))
      if (!res._header) {
        res._implicitHeader()
      }
      _writeHead.call(res, res.statusCode)
      _write.call(res, data, encoding)
      _end.call(res, callback)
    }

    var buf = ''

    res.write = function(body) {
      buf += body
      return true
    }

    res.end = function(data, encoding, callback) {
      if (data) {
        if ('function' === typeof data) {
          callback = data
        } else {
          buf += data
        }
      }

      if (_headers) {
        res.set(_headers)
      }

      var locals
      var contentType = res.getHeader('content-type')

      if (/json/.test(contentType)) {
        try {
          locals = JSON.parse(buf)
        } catch (e) {
          res.status(500)
          end('Service error.', 'utf-8')
          return
        }
      } else if (/text/.test(contentType)) {
        locals = {
          yield: buf
        }
      }

      // merge local context and render it with template
      res.locals = assign(res.locals, locals)
      var accept = req.accepts(['html', 'json'])

      if (req.xhr && 'json' === accept) {
        // send json if this is a xhr request which accepts json
        res.type('json')
        var jsonStr = JSON.stringify(res.locals)
        end(jsonStr, encoding, callback)
      } else if ('html' === accept) {
        // render html page with data
        res.type('html')
        app.render(layoutName, res.locals, function(err, html) {
          if (err) {
            var data = err.toString()
            res.status(500)
            res.statusMessage = 'Server error.'
            end(data, 'utf-8')
            return
          }
          end(html, encoding, callback)
        })
      } else {
        res.status(406)
        end('Not Acceptable.', 'utf-8')
      }
    }

    next()
  }
}
