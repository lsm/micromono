/**
 * Module dependencies
 */

var assign = require('lodash.assign')

/**
 * Regexp for safely parsing JSON
 */
var UNSAFE_CHARS_REGEXP = /[<>\/\u2028\u2029]/g
var UNICODE_CHARS = {
  '<': '\\u003C',
  '>': '\\u003E',
  '/': '\\u002F',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029'
}

/**
 * The remote partial composing middleware
 */
module.exports = function(app) {
  var layoutName = app.get('micromono layout name') || 'layout'
  app.set('micromono layout name', layoutName)

  return function renderLayout(req, res, next) {
    if (req.__micromono_layout_attached__) {
      next()
      return
    }
    req.__micromono_layout_attached__ = true

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
      res.set('Content-Length', Buffer.byteLength(data, encoding))
      if (!res._header) {
        res._implicitHeader()
      }
      _writeHead.call(res, res.statusCode)
      if (data) {
        _write.call(res, data, encoding)
      }
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
      var JSONStr
      var contentType = res.getHeader('content-type')

      if (/json/.test(contentType)) {
        JSONStr = buf.toString('utf8')
      } else if (/text/.test(contentType)) {
        locals = {
          yield: buf
        }
      } else {
        // No content type, just return what we get
        end(buf, encoding, callback)
        return
      }

      var accept = req.accepts(['html', 'json'])

      if (JSONStr) {
        try {
          locals = JSON.parse(JSONStr, function(key, value) {
            if (key !== 'yield' && 'string' === typeof value && 'html' === accept) {
              // Excape unsafe characters only when we need to render it with template.
              return value.replace(UNSAFE_CHARS_REGEXP, function(unsafeChar) {
                return UNICODE_CHARS[unsafeChar]
              })
            }
            return value
          })
        } catch (e) {
          res.status(500)
          end('Service error.', 'utf8')
          return
        }
      }

      // merge local context
      res.locals = assign(res.locals, locals)

      if (req.xhr && 'json' === accept) {
        // send json if this is a xhr request which accepts json
        res.type('json')
        var jsonStr = JSON.stringify(locals)
        end(jsonStr, encoding, callback)
      } else if ('html' === accept) {
        // render html page with data
        res.type('html')
        app.render(layoutName, res.locals, function(err, html) {
          if (err) {
            var data = err.toString()
            res.status(500)
            res.statusMessage = 'Server error.'
            end(data, 'utf8')
            return
          }
          end(html, encoding, callback)
        })
      } else {
        res.status(406)
        end('Not Acceptable.', 'utf8')
      }
    }

    next()
  }
}
