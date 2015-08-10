/**
 * Module dependencies
 */

var assign = require('lodash.assign');

/**
 * The remote partial composing middleware
 */
module.exports = function(app) {
  return function render(req, res, next) {
    var _end = res.end;
    var _write = res.write;
    var _writeHead = res.writeHead;

    var _headers;
    res.writeHead = function(code, message, headers) {
      if (code) {
        res.statusCode = code;
      }
      switch (typeof message) {
        case 'string':
          res.statusMessage = message;
          break;
        default:
        case 'object':
          _headers = headers;
      }

      return res;
    };

    function end(data, encoding, callback) {
      res.set('Content-Length', Buffer.byteLength(data, 'utf-8'));
      if (!res._header) {
        res._implicitHeader();
      }
      _writeHead.call(res, res.statusCode);
      _write.call(res, data, encoding);
      _end.call(res, callback);
    }

    var buf = '';

    res.write = function(body) {
      buf += body;
      return true;
    };

    res.end = function(data, encoding, callback) {
      if (data) {
        if (typeof data === 'function') {
          callback = data;
        } else {
          buf += data;
        }
      }

      if (_headers) {
        res.set(_headers);
      }

      if (/^text\/html/.test(res.get('Content-Type')) && !/<html\b[^>]*>/.test(buf)) {
        // the response is html code but it is not a full page
        // // merge local context and render it with template
        res.locals = assign(res.locals, {
          yield: buf
        });
        app.render('layout', res.locals, function(err, html) {
          if (err) {
            var data = err.toString();
            res.statusCode = 500;
            res.statusMessage = 'MicroMono rendering error.';
            end(data, 'utf-8');
            return;
          }
          end(html, encoding, callback);
        });
      } else {
        end(buf, encoding, callback);
      }
    };

    next();
  };
};
