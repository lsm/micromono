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

      if (!/^text\/html/.test(res.get('Content-Type'))) {
        res.set('Content-Length', Buffer.byteLength(buf));
        end(buf, encoding, callback);
        return;
      }

      if (!/<html\b[^>]*>/.test(buf)) {
        // the response is html code but it is not a full page
        // render it with template
        app.render('layout', {
          'yield': buf
        }, function(err, html) {
          if (err) {
            var data = err.toString();
            res.statusCode = 500;
            res.statusMessage = 'MicroMono rendering error.';
            end(data, 'utf-8');
            return;
          }
          end(html, 'utf-8');
        });
      } else {
        end(buf, 'utf-8');
      }
    };

    res.write = function(body) {
      buf = buf + body;
      return true;
    };

    next();
  };
};
