(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var WebApp = Package.webapp.WebApp;
var WebAppInternals = Package.webapp.WebAppInternals;
var main = Package.webapp.main;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

var require = meteorInstall({"node_modules":{"meteor":{"server-render":{"server.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                 //
// packages/server-render/server.js                                                                //
//                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                   //
module.export({
  onPageLoad: () => onPageLoad
});
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }

}, 0);
module.link("./server-register.js");
const startupPromise = new Promise(Meteor.startup);
const pageLoadCallbacks = new Set();

function onPageLoad(callback) {
  if (typeof callback === "function") {
    pageLoadCallbacks.add(callback);
  } // Return the callback so that it can be more easily removed later.


  return callback;
}

onPageLoad.remove = function (callback) {
  pageLoadCallbacks.delete(callback);
};

onPageLoad.clear = function () {
  pageLoadCallbacks.clear();
};

onPageLoad.chain = function (handler) {
  return startupPromise.then(() => {
    let promise = Promise.resolve();
    pageLoadCallbacks.forEach(callback => {
      promise = promise.then(() => handler(callback));
    });
    return promise;
  });
};
/////////////////////////////////////////////////////////////////////////////////////////////////////

},"server-register.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                 //
// packages/server-render/server-register.js                                                       //
//                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                   //
let WebAppInternals;
module.link("meteor/webapp", {
  WebAppInternals(v) {
    WebAppInternals = v;
  }

}, 0);
let MagicString;
module.link("magic-string", {
  default(v) {
    MagicString = v;
  }

}, 1);
let SAXParser;
module.link("parse5", {
  SAXParser(v) {
    SAXParser = v;
  }

}, 2);
let createStream;
module.link("combined-stream2", {
  create(v) {
    createStream = v;
  }

}, 3);
let ServerSink, isReadable;
module.link("./server-sink.js", {
  ServerSink(v) {
    ServerSink = v;
  },

  isReadable(v) {
    isReadable = v;
  }

}, 4);
let onPageLoad;
module.link("./server.js", {
  onPageLoad(v) {
    onPageLoad = v;
  }

}, 5);
WebAppInternals.registerBoilerplateDataCallback("meteor/server-render", (request, data, arch) => {
  const sink = new ServerSink(request, arch);
  return onPageLoad.chain(callback => callback(sink, request)).then(() => {
    if (!sink.maybeMadeChanges) {
      return false;
    }

    let reallyMadeChanges = false;

    function rewrite(property) {
      const html = data[property];

      if (typeof html !== "string") {
        return;
      }

      const magic = new MagicString(html);
      const parser = new SAXParser({
        locationInfo: true
      });
      data[property] = parser;

      if (Object.keys(sink.htmlById).length) {
        const stream = createStream();
        let lastStart = magic.start;
        parser.on("startTag", (name, attrs, selfClosing, loc) => {
          attrs.some(attr => {
            if (attr.name === "id") {
              let html = sink.htmlById[attr.value];

              if (html) {
                reallyMadeChanges = true;
                const start = magic.slice(lastStart, loc.endOffset);
                stream.append(Buffer.from(start, "utf8"));
                stream.append(typeof html === "string" ? Buffer.from(html, "utf8") : html);
                lastStart = loc.endOffset;
              }

              return true;
            }
          });
        });
        parser.on("endTag", (name, location) => {
          if (location.endOffset === html.length) {
            // reached the end of the template
            const end = magic.slice(lastStart);
            stream.append(Buffer.from(end, "utf8"));
          }
        });
        data[property] = stream;
      }

      parser.write(html, parser.end.bind(parser));
    }

    if (sink.head) {
      data.dynamicHead = (data.dynamicHead || "") + sink.head;
      reallyMadeChanges = true;
    }

    if (Object.keys(sink.htmlById).length > 0) {
      // We don't currently allow injecting HTML into the <head> except
      // by calling sink.appendHead(html).
      rewrite("body");
      rewrite("dynamicBody");
    }

    if (sink.body) {
      data.dynamicBody = (data.dynamicBody || "") + sink.body;
      reallyMadeChanges = true;
    }

    if (sink.statusCode) {
      data.statusCode = sink.statusCode;
      reallyMadeChanges = true;
    }

    if (Object.keys(sink.responseHeaders)) {
      data.headers = sink.responseHeaders;
      reallyMadeChanges = true;
    }

    return reallyMadeChanges;
  });
});
/////////////////////////////////////////////////////////////////////////////////////////////////////

},"server-sink.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                 //
// packages/server-render/server-sink.js                                                           //
//                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                   //
module.export({
  ServerSink: () => ServerSink,
  isReadable: () => isReadable
});

class ServerSink {
  constructor(request, arch) {
    this.request = request;
    this.arch = arch;
    this.head = "";
    this.body = "";
    this.htmlById = Object.create(null);
    this.maybeMadeChanges = false;
    this.statusCode = null;
    this.responseHeaders = {};
  }

  appendToHead(html) {
    if (appendContent(this, "head", html)) {
      this.maybeMadeChanges = true;
    }
  }

  appendToBody(html) {
    if (appendContent(this, "body", html)) {
      this.maybeMadeChanges = true;
    }
  }

  appendToElementById(id, html) {
    if (appendContent(this.htmlById, id, html)) {
      this.maybeMadeChanges = true;
    }
  }

  renderIntoElementById(id, html) {
    this.htmlById[id] = "";
    this.appendToElementById(id, html);
  }

  redirect(location) {
    let code = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 301;
    this.maybeMadeChanges = true;
    this.statusCode = code;
    this.responseHeaders.Location = location;
  } // server only methods


  setStatusCode(code) {
    this.maybeMadeChanges = true;
    this.statusCode = code;
  }

  setHeader(key, value) {
    this.maybeMadeChanges = true;
    this.responseHeaders[key] = value;
  }

  getHeaders() {
    return this.request.headers;
  }

  getCookies() {
    return this.request.cookies;
  }

}

function isReadable(stream) {
  return stream !== null && typeof stream === 'object' && typeof stream.pipe === 'function' && stream.readable !== false && typeof stream._read === 'function' && typeof stream._readableState === 'object';
}

function appendContent(object, property, content) {
  let madeChanges = false;

  if (Array.isArray(content)) {
    content.forEach(elem => {
      if (appendContent(object, property, elem)) {
        madeChanges = true;
      }
    });
  } else if (isReadable(content)) {
    object[property] = content;
    madeChanges = true;
  } else if (content = content && content.toString("utf8")) {
    object[property] = (object[property] || "") + content;
    madeChanges = true;
  }

  return madeChanges;
}
/////////////////////////////////////////////////////////////////////////////////////////////////////

},"node_modules":{"magic-string":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                 //
// node_modules/meteor/server-render/node_modules/magic-string/package.json                        //
//                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                   //
module.exports = {
  "name": "magic-string",
  "version": "0.21.3",
  "main": "dist/magic-string.cjs.js"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////

},"dist":{"magic-string.cjs.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                 //
// node_modules/meteor/server-render/node_modules/magic-string/dist/magic-string.cjs.js            //
//                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                   //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////

}}},"parse5":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                 //
// node_modules/meteor/server-render/node_modules/parse5/package.json                              //
//                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                   //
module.exports = {
  "name": "parse5",
  "version": "3.0.2",
  "main": "./lib/index.js"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////

},"lib":{"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                 //
// node_modules/meteor/server-render/node_modules/parse5/lib/index.js                              //
//                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                   //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////

}}},"combined-stream2":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                 //
// node_modules/meteor/server-render/node_modules/combined-stream2/package.json                    //
//                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                   //
module.exports = {
  "name": "combined-stream2",
  "version": "1.1.2",
  "main": "index.js"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                 //
// node_modules/meteor/server-render/node_modules/combined-stream2/index.js                        //
//                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                   //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/server-render/server.js");

/* Exports */
Package._define("server-render", exports);

})();

//# sourceURL=meteor://💻app/packages/server-render.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvc2VydmVyLXJlbmRlci9zZXJ2ZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3NlcnZlci1yZW5kZXIvc2VydmVyLXJlZ2lzdGVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9zZXJ2ZXItcmVuZGVyL3NlcnZlci1zaW5rLmpzIl0sIm5hbWVzIjpbIm1vZHVsZSIsImV4cG9ydCIsIm9uUGFnZUxvYWQiLCJNZXRlb3IiLCJsaW5rIiwidiIsInN0YXJ0dXBQcm9taXNlIiwiUHJvbWlzZSIsInN0YXJ0dXAiLCJwYWdlTG9hZENhbGxiYWNrcyIsIlNldCIsImNhbGxiYWNrIiwiYWRkIiwicmVtb3ZlIiwiZGVsZXRlIiwiY2xlYXIiLCJjaGFpbiIsImhhbmRsZXIiLCJ0aGVuIiwicHJvbWlzZSIsInJlc29sdmUiLCJmb3JFYWNoIiwiV2ViQXBwSW50ZXJuYWxzIiwiTWFnaWNTdHJpbmciLCJkZWZhdWx0IiwiU0FYUGFyc2VyIiwiY3JlYXRlU3RyZWFtIiwiY3JlYXRlIiwiU2VydmVyU2luayIsImlzUmVhZGFibGUiLCJyZWdpc3RlckJvaWxlcnBsYXRlRGF0YUNhbGxiYWNrIiwicmVxdWVzdCIsImRhdGEiLCJhcmNoIiwic2luayIsIm1heWJlTWFkZUNoYW5nZXMiLCJyZWFsbHlNYWRlQ2hhbmdlcyIsInJld3JpdGUiLCJwcm9wZXJ0eSIsImh0bWwiLCJtYWdpYyIsInBhcnNlciIsImxvY2F0aW9uSW5mbyIsIk9iamVjdCIsImtleXMiLCJodG1sQnlJZCIsImxlbmd0aCIsInN0cmVhbSIsImxhc3RTdGFydCIsInN0YXJ0Iiwib24iLCJuYW1lIiwiYXR0cnMiLCJzZWxmQ2xvc2luZyIsImxvYyIsInNvbWUiLCJhdHRyIiwidmFsdWUiLCJzbGljZSIsImVuZE9mZnNldCIsImFwcGVuZCIsIkJ1ZmZlciIsImZyb20iLCJsb2NhdGlvbiIsImVuZCIsIndyaXRlIiwiYmluZCIsImhlYWQiLCJkeW5hbWljSGVhZCIsImJvZHkiLCJkeW5hbWljQm9keSIsInN0YXR1c0NvZGUiLCJyZXNwb25zZUhlYWRlcnMiLCJoZWFkZXJzIiwiY29uc3RydWN0b3IiLCJhcHBlbmRUb0hlYWQiLCJhcHBlbmRDb250ZW50IiwiYXBwZW5kVG9Cb2R5IiwiYXBwZW5kVG9FbGVtZW50QnlJZCIsImlkIiwicmVuZGVySW50b0VsZW1lbnRCeUlkIiwicmVkaXJlY3QiLCJjb2RlIiwiTG9jYXRpb24iLCJzZXRTdGF0dXNDb2RlIiwic2V0SGVhZGVyIiwia2V5IiwiZ2V0SGVhZGVycyIsImdldENvb2tpZXMiLCJjb29raWVzIiwicGlwZSIsInJlYWRhYmxlIiwiX3JlYWQiLCJfcmVhZGFibGVTdGF0ZSIsIm9iamVjdCIsImNvbnRlbnQiLCJtYWRlQ2hhbmdlcyIsIkFycmF5IiwiaXNBcnJheSIsImVsZW0iLCJ0b1N0cmluZyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUFBLE1BQU0sQ0FBQ0MsTUFBUCxDQUFjO0FBQUNDLFlBQVUsRUFBQyxNQUFJQTtBQUFoQixDQUFkO0FBQTJDLElBQUlDLE1BQUo7QUFBV0gsTUFBTSxDQUFDSSxJQUFQLENBQVksZUFBWixFQUE0QjtBQUFDRCxRQUFNLENBQUNFLENBQUQsRUFBRztBQUFDRixVQUFNLEdBQUNFLENBQVA7QUFBUzs7QUFBcEIsQ0FBNUIsRUFBa0QsQ0FBbEQ7QUFBcURMLE1BQU0sQ0FBQ0ksSUFBUCxDQUFZLHNCQUFaO0FBRzNHLE1BQU1FLGNBQWMsR0FBRyxJQUFJQyxPQUFKLENBQVlKLE1BQU0sQ0FBQ0ssT0FBbkIsQ0FBdkI7QUFDQSxNQUFNQyxpQkFBaUIsR0FBRyxJQUFJQyxHQUFKLEVBQTFCOztBQUVPLFNBQVNSLFVBQVQsQ0FBb0JTLFFBQXBCLEVBQThCO0FBQ25DLE1BQUksT0FBT0EsUUFBUCxLQUFvQixVQUF4QixFQUFvQztBQUNsQ0YscUJBQWlCLENBQUNHLEdBQWxCLENBQXNCRCxRQUF0QjtBQUNELEdBSGtDLENBS25DOzs7QUFDQSxTQUFPQSxRQUFQO0FBQ0Q7O0FBRURULFVBQVUsQ0FBQ1csTUFBWCxHQUFvQixVQUFVRixRQUFWLEVBQW9CO0FBQ3RDRixtQkFBaUIsQ0FBQ0ssTUFBbEIsQ0FBeUJILFFBQXpCO0FBQ0QsQ0FGRDs7QUFJQVQsVUFBVSxDQUFDYSxLQUFYLEdBQW1CLFlBQVk7QUFDN0JOLG1CQUFpQixDQUFDTSxLQUFsQjtBQUNELENBRkQ7O0FBSUFiLFVBQVUsQ0FBQ2MsS0FBWCxHQUFtQixVQUFVQyxPQUFWLEVBQW1CO0FBQ3BDLFNBQU9YLGNBQWMsQ0FBQ1ksSUFBZixDQUFvQixNQUFNO0FBQy9CLFFBQUlDLE9BQU8sR0FBR1osT0FBTyxDQUFDYSxPQUFSLEVBQWQ7QUFDQVgscUJBQWlCLENBQUNZLE9BQWxCLENBQTBCVixRQUFRLElBQUk7QUFDcENRLGFBQU8sR0FBR0EsT0FBTyxDQUFDRCxJQUFSLENBQWEsTUFBTUQsT0FBTyxDQUFDTixRQUFELENBQTFCLENBQVY7QUFDRCxLQUZEO0FBR0EsV0FBT1EsT0FBUDtBQUNELEdBTk0sQ0FBUDtBQU9ELENBUkQsQzs7Ozs7Ozs7Ozs7QUN2QkEsSUFBSUcsZUFBSjtBQUFvQnRCLE1BQU0sQ0FBQ0ksSUFBUCxDQUFZLGVBQVosRUFBNEI7QUFBQ2tCLGlCQUFlLENBQUNqQixDQUFELEVBQUc7QUFBQ2lCLG1CQUFlLEdBQUNqQixDQUFoQjtBQUFrQjs7QUFBdEMsQ0FBNUIsRUFBb0UsQ0FBcEU7QUFBdUUsSUFBSWtCLFdBQUo7QUFBZ0J2QixNQUFNLENBQUNJLElBQVAsQ0FBWSxjQUFaLEVBQTJCO0FBQUNvQixTQUFPLENBQUNuQixDQUFELEVBQUc7QUFBQ2tCLGVBQVcsR0FBQ2xCLENBQVo7QUFBYzs7QUFBMUIsQ0FBM0IsRUFBdUQsQ0FBdkQ7QUFBMEQsSUFBSW9CLFNBQUo7QUFBY3pCLE1BQU0sQ0FBQ0ksSUFBUCxDQUFZLFFBQVosRUFBcUI7QUFBQ3FCLFdBQVMsQ0FBQ3BCLENBQUQsRUFBRztBQUFDb0IsYUFBUyxHQUFDcEIsQ0FBVjtBQUFZOztBQUExQixDQUFyQixFQUFpRCxDQUFqRDtBQUFvRCxJQUFJcUIsWUFBSjtBQUFpQjFCLE1BQU0sQ0FBQ0ksSUFBUCxDQUFZLGtCQUFaLEVBQStCO0FBQUN1QixRQUFNLENBQUN0QixDQUFELEVBQUc7QUFBQ3FCLGdCQUFZLEdBQUNyQixDQUFiO0FBQWU7O0FBQTFCLENBQS9CLEVBQTJELENBQTNEO0FBQThELElBQUl1QixVQUFKLEVBQWVDLFVBQWY7QUFBMEI3QixNQUFNLENBQUNJLElBQVAsQ0FBWSxrQkFBWixFQUErQjtBQUFDd0IsWUFBVSxDQUFDdkIsQ0FBRCxFQUFHO0FBQUN1QixjQUFVLEdBQUN2QixDQUFYO0FBQWEsR0FBNUI7O0FBQTZCd0IsWUFBVSxDQUFDeEIsQ0FBRCxFQUFHO0FBQUN3QixjQUFVLEdBQUN4QixDQUFYO0FBQWE7O0FBQXhELENBQS9CLEVBQXlGLENBQXpGO0FBQTRGLElBQUlILFVBQUo7QUFBZUYsTUFBTSxDQUFDSSxJQUFQLENBQVksYUFBWixFQUEwQjtBQUFDRixZQUFVLENBQUNHLENBQUQsRUFBRztBQUFDSCxjQUFVLEdBQUNHLENBQVg7QUFBYTs7QUFBNUIsQ0FBMUIsRUFBd0QsQ0FBeEQ7QUFPM2JpQixlQUFlLENBQUNRLCtCQUFoQixDQUNFLHNCQURGLEVBRUUsQ0FBQ0MsT0FBRCxFQUFVQyxJQUFWLEVBQWdCQyxJQUFoQixLQUF5QjtBQUN2QixRQUFNQyxJQUFJLEdBQUcsSUFBSU4sVUFBSixDQUFlRyxPQUFmLEVBQXdCRSxJQUF4QixDQUFiO0FBRUEsU0FBTy9CLFVBQVUsQ0FBQ2MsS0FBWCxDQUNMTCxRQUFRLElBQUlBLFFBQVEsQ0FBQ3VCLElBQUQsRUFBT0gsT0FBUCxDQURmLEVBRUxiLElBRkssQ0FFQSxNQUFNO0FBQ1gsUUFBSSxDQUFFZ0IsSUFBSSxDQUFDQyxnQkFBWCxFQUE2QjtBQUMzQixhQUFPLEtBQVA7QUFDRDs7QUFFRCxRQUFJQyxpQkFBaUIsR0FBRyxLQUF4Qjs7QUFFQSxhQUFTQyxPQUFULENBQWlCQyxRQUFqQixFQUEyQjtBQUN6QixZQUFNQyxJQUFJLEdBQUdQLElBQUksQ0FBQ00sUUFBRCxDQUFqQjs7QUFDQSxVQUFJLE9BQU9DLElBQVAsS0FBZ0IsUUFBcEIsRUFBOEI7QUFDNUI7QUFDRDs7QUFFRCxZQUFNQyxLQUFLLEdBQUcsSUFBSWpCLFdBQUosQ0FBZ0JnQixJQUFoQixDQUFkO0FBQ0EsWUFBTUUsTUFBTSxHQUFHLElBQUloQixTQUFKLENBQWM7QUFDM0JpQixvQkFBWSxFQUFFO0FBRGEsT0FBZCxDQUFmO0FBSUFWLFVBQUksQ0FBQ00sUUFBRCxDQUFKLEdBQWlCRyxNQUFqQjs7QUFFQSxVQUFJRSxNQUFNLENBQUNDLElBQVAsQ0FBWVYsSUFBSSxDQUFDVyxRQUFqQixFQUEyQkMsTUFBL0IsRUFBdUM7QUFDckMsY0FBTUMsTUFBTSxHQUFHckIsWUFBWSxFQUEzQjtBQUVBLFlBQUlzQixTQUFTLEdBQUdSLEtBQUssQ0FBQ1MsS0FBdEI7QUFDQVIsY0FBTSxDQUFDUyxFQUFQLENBQVUsVUFBVixFQUFzQixDQUFDQyxJQUFELEVBQU9DLEtBQVAsRUFBY0MsV0FBZCxFQUEyQkMsR0FBM0IsS0FBbUM7QUFDdkRGLGVBQUssQ0FBQ0csSUFBTixDQUFXQyxJQUFJLElBQUk7QUFDakIsZ0JBQUlBLElBQUksQ0FBQ0wsSUFBTCxLQUFjLElBQWxCLEVBQXdCO0FBQ3RCLGtCQUFJWixJQUFJLEdBQUdMLElBQUksQ0FBQ1csUUFBTCxDQUFjVyxJQUFJLENBQUNDLEtBQW5CLENBQVg7O0FBQ0Esa0JBQUlsQixJQUFKLEVBQVU7QUFDUkgsaUNBQWlCLEdBQUcsSUFBcEI7QUFDQSxzQkFBTWEsS0FBSyxHQUFHVCxLQUFLLENBQUNrQixLQUFOLENBQVlWLFNBQVosRUFBdUJNLEdBQUcsQ0FBQ0ssU0FBM0IsQ0FBZDtBQUNBWixzQkFBTSxDQUFDYSxNQUFQLENBQWNDLE1BQU0sQ0FBQ0MsSUFBUCxDQUFZYixLQUFaLEVBQW1CLE1BQW5CLENBQWQ7QUFDQUYsc0JBQU0sQ0FBQ2EsTUFBUCxDQUNFLE9BQU9yQixJQUFQLEtBQWdCLFFBQWhCLEdBQ0lzQixNQUFNLENBQUNDLElBQVAsQ0FBWXZCLElBQVosRUFBa0IsTUFBbEIsQ0FESixHQUVJQSxJQUhOO0FBS0FTLHlCQUFTLEdBQUdNLEdBQUcsQ0FBQ0ssU0FBaEI7QUFDRDs7QUFDRCxxQkFBTyxJQUFQO0FBQ0Q7QUFDRixXQWhCRDtBQWlCRCxTQWxCRDtBQW9CQWxCLGNBQU0sQ0FBQ1MsRUFBUCxDQUFVLFFBQVYsRUFBb0IsQ0FBQ0MsSUFBRCxFQUFPWSxRQUFQLEtBQW9CO0FBQ3RDLGNBQUlBLFFBQVEsQ0FBQ0osU0FBVCxLQUF1QnBCLElBQUksQ0FBQ08sTUFBaEMsRUFBd0M7QUFDdEM7QUFDQSxrQkFBTWtCLEdBQUcsR0FBR3hCLEtBQUssQ0FBQ2tCLEtBQU4sQ0FBWVYsU0FBWixDQUFaO0FBQ0FELGtCQUFNLENBQUNhLE1BQVAsQ0FBY0MsTUFBTSxDQUFDQyxJQUFQLENBQVlFLEdBQVosRUFBaUIsTUFBakIsQ0FBZDtBQUNEO0FBQ0YsU0FORDtBQVFBaEMsWUFBSSxDQUFDTSxRQUFELENBQUosR0FBaUJTLE1BQWpCO0FBQ0Q7O0FBRUROLFlBQU0sQ0FBQ3dCLEtBQVAsQ0FBYTFCLElBQWIsRUFBbUJFLE1BQU0sQ0FBQ3VCLEdBQVAsQ0FBV0UsSUFBWCxDQUFnQnpCLE1BQWhCLENBQW5CO0FBQ0Q7O0FBRUQsUUFBSVAsSUFBSSxDQUFDaUMsSUFBVCxFQUFlO0FBQ2JuQyxVQUFJLENBQUNvQyxXQUFMLEdBQW1CLENBQUNwQyxJQUFJLENBQUNvQyxXQUFMLElBQW9CLEVBQXJCLElBQTJCbEMsSUFBSSxDQUFDaUMsSUFBbkQ7QUFDQS9CLHVCQUFpQixHQUFHLElBQXBCO0FBQ0Q7O0FBRUQsUUFBSU8sTUFBTSxDQUFDQyxJQUFQLENBQVlWLElBQUksQ0FBQ1csUUFBakIsRUFBMkJDLE1BQTNCLEdBQW9DLENBQXhDLEVBQTJDO0FBQ3pDO0FBQ0E7QUFDQVQsYUFBTyxDQUFDLE1BQUQsQ0FBUDtBQUNBQSxhQUFPLENBQUMsYUFBRCxDQUFQO0FBQ0Q7O0FBRUQsUUFBSUgsSUFBSSxDQUFDbUMsSUFBVCxFQUFlO0FBQ2JyQyxVQUFJLENBQUNzQyxXQUFMLEdBQW1CLENBQUN0QyxJQUFJLENBQUNzQyxXQUFMLElBQW9CLEVBQXJCLElBQTJCcEMsSUFBSSxDQUFDbUMsSUFBbkQ7QUFDQWpDLHVCQUFpQixHQUFHLElBQXBCO0FBQ0Q7O0FBRUQsUUFBSUYsSUFBSSxDQUFDcUMsVUFBVCxFQUFxQjtBQUNuQnZDLFVBQUksQ0FBQ3VDLFVBQUwsR0FBa0JyQyxJQUFJLENBQUNxQyxVQUF2QjtBQUNBbkMsdUJBQWlCLEdBQUcsSUFBcEI7QUFDRDs7QUFFRCxRQUFJTyxNQUFNLENBQUNDLElBQVAsQ0FBWVYsSUFBSSxDQUFDc0MsZUFBakIsQ0FBSixFQUFzQztBQUNwQ3hDLFVBQUksQ0FBQ3lDLE9BQUwsR0FBZXZDLElBQUksQ0FBQ3NDLGVBQXBCO0FBQ0FwQyx1QkFBaUIsR0FBRyxJQUFwQjtBQUNEOztBQUVELFdBQU9BLGlCQUFQO0FBQ0QsR0F4Rk0sQ0FBUDtBQXlGRCxDQTlGSCxFOzs7Ozs7Ozs7OztBQ1BBcEMsTUFBTSxDQUFDQyxNQUFQLENBQWM7QUFBQzJCLFlBQVUsRUFBQyxNQUFJQSxVQUFoQjtBQUEyQkMsWUFBVSxFQUFDLE1BQUlBO0FBQTFDLENBQWQ7O0FBQU8sTUFBTUQsVUFBTixDQUFpQjtBQUN0QjhDLGFBQVcsQ0FBQzNDLE9BQUQsRUFBVUUsSUFBVixFQUFnQjtBQUN6QixTQUFLRixPQUFMLEdBQWVBLE9BQWY7QUFDQSxTQUFLRSxJQUFMLEdBQVlBLElBQVo7QUFDQSxTQUFLa0MsSUFBTCxHQUFZLEVBQVo7QUFDQSxTQUFLRSxJQUFMLEdBQVksRUFBWjtBQUNBLFNBQUt4QixRQUFMLEdBQWdCRixNQUFNLENBQUNoQixNQUFQLENBQWMsSUFBZCxDQUFoQjtBQUNBLFNBQUtRLGdCQUFMLEdBQXdCLEtBQXhCO0FBQ0EsU0FBS29DLFVBQUwsR0FBa0IsSUFBbEI7QUFDQSxTQUFLQyxlQUFMLEdBQXVCLEVBQXZCO0FBQ0Q7O0FBRURHLGNBQVksQ0FBQ3BDLElBQUQsRUFBTztBQUNqQixRQUFJcUMsYUFBYSxDQUFDLElBQUQsRUFBTyxNQUFQLEVBQWVyQyxJQUFmLENBQWpCLEVBQXVDO0FBQ3JDLFdBQUtKLGdCQUFMLEdBQXdCLElBQXhCO0FBQ0Q7QUFDRjs7QUFFRDBDLGNBQVksQ0FBQ3RDLElBQUQsRUFBTztBQUNqQixRQUFJcUMsYUFBYSxDQUFDLElBQUQsRUFBTyxNQUFQLEVBQWVyQyxJQUFmLENBQWpCLEVBQXVDO0FBQ3JDLFdBQUtKLGdCQUFMLEdBQXdCLElBQXhCO0FBQ0Q7QUFDRjs7QUFFRDJDLHFCQUFtQixDQUFDQyxFQUFELEVBQUt4QyxJQUFMLEVBQVc7QUFDNUIsUUFBSXFDLGFBQWEsQ0FBQyxLQUFLL0IsUUFBTixFQUFnQmtDLEVBQWhCLEVBQW9CeEMsSUFBcEIsQ0FBakIsRUFBNEM7QUFDMUMsV0FBS0osZ0JBQUwsR0FBd0IsSUFBeEI7QUFDRDtBQUNGOztBQUVENkMsdUJBQXFCLENBQUNELEVBQUQsRUFBS3hDLElBQUwsRUFBVztBQUM5QixTQUFLTSxRQUFMLENBQWNrQyxFQUFkLElBQW9CLEVBQXBCO0FBQ0EsU0FBS0QsbUJBQUwsQ0FBeUJDLEVBQXpCLEVBQTZCeEMsSUFBN0I7QUFDRDs7QUFFRDBDLFVBQVEsQ0FBQ2xCLFFBQUQsRUFBdUI7QUFBQSxRQUFabUIsSUFBWSx1RUFBTCxHQUFLO0FBQzdCLFNBQUsvQyxnQkFBTCxHQUF3QixJQUF4QjtBQUNBLFNBQUtvQyxVQUFMLEdBQWtCVyxJQUFsQjtBQUNBLFNBQUtWLGVBQUwsQ0FBcUJXLFFBQXJCLEdBQWdDcEIsUUFBaEM7QUFDRCxHQXZDcUIsQ0F5Q3RCOzs7QUFDQXFCLGVBQWEsQ0FBQ0YsSUFBRCxFQUFPO0FBQ2xCLFNBQUsvQyxnQkFBTCxHQUF3QixJQUF4QjtBQUNBLFNBQUtvQyxVQUFMLEdBQWtCVyxJQUFsQjtBQUNEOztBQUVERyxXQUFTLENBQUNDLEdBQUQsRUFBTTdCLEtBQU4sRUFBYTtBQUNwQixTQUFLdEIsZ0JBQUwsR0FBd0IsSUFBeEI7QUFDQSxTQUFLcUMsZUFBTCxDQUFxQmMsR0FBckIsSUFBNEI3QixLQUE1QjtBQUNEOztBQUVEOEIsWUFBVSxHQUFHO0FBQ1gsV0FBTyxLQUFLeEQsT0FBTCxDQUFhMEMsT0FBcEI7QUFDRDs7QUFFRGUsWUFBVSxHQUFHO0FBQ1gsV0FBTyxLQUFLekQsT0FBTCxDQUFhMEQsT0FBcEI7QUFDRDs7QUExRHFCOztBQTZEakIsU0FBUzVELFVBQVQsQ0FBb0JrQixNQUFwQixFQUE0QjtBQUNqQyxTQUNFQSxNQUFNLEtBQUssSUFBWCxJQUNBLE9BQU9BLE1BQVAsS0FBa0IsUUFEbEIsSUFFQSxPQUFPQSxNQUFNLENBQUMyQyxJQUFkLEtBQXVCLFVBRnZCLElBR0EzQyxNQUFNLENBQUM0QyxRQUFQLEtBQW9CLEtBSHBCLElBSUEsT0FBTzVDLE1BQU0sQ0FBQzZDLEtBQWQsS0FBd0IsVUFKeEIsSUFLQSxPQUFPN0MsTUFBTSxDQUFDOEMsY0FBZCxLQUFpQyxRQU5uQztBQVFEOztBQUVELFNBQVNqQixhQUFULENBQXVCa0IsTUFBdkIsRUFBK0J4RCxRQUEvQixFQUF5Q3lELE9BQXpDLEVBQWtEO0FBQ2hELE1BQUlDLFdBQVcsR0FBRyxLQUFsQjs7QUFFQSxNQUFJQyxLQUFLLENBQUNDLE9BQU4sQ0FBY0gsT0FBZCxDQUFKLEVBQTRCO0FBQzFCQSxXQUFPLENBQUMxRSxPQUFSLENBQWdCOEUsSUFBSSxJQUFJO0FBQ3RCLFVBQUl2QixhQUFhLENBQUNrQixNQUFELEVBQVN4RCxRQUFULEVBQW1CNkQsSUFBbkIsQ0FBakIsRUFBMkM7QUFDekNILG1CQUFXLEdBQUcsSUFBZDtBQUNEO0FBQ0YsS0FKRDtBQUtELEdBTkQsTUFNTyxJQUFJbkUsVUFBVSxDQUFDa0UsT0FBRCxDQUFkLEVBQXlCO0FBQzlCRCxVQUFNLENBQUN4RCxRQUFELENBQU4sR0FBbUJ5RCxPQUFuQjtBQUNBQyxlQUFXLEdBQUcsSUFBZDtBQUNELEdBSE0sTUFHQSxJQUFLRCxPQUFPLEdBQUdBLE9BQU8sSUFBSUEsT0FBTyxDQUFDSyxRQUFSLENBQWlCLE1BQWpCLENBQTFCLEVBQXFEO0FBQzFETixVQUFNLENBQUN4RCxRQUFELENBQU4sR0FBbUIsQ0FBQ3dELE1BQU0sQ0FBQ3hELFFBQUQsQ0FBTixJQUFvQixFQUFyQixJQUEyQnlELE9BQTlDO0FBQ0FDLGVBQVcsR0FBRyxJQUFkO0FBQ0Q7O0FBQ0QsU0FBT0EsV0FBUDtBQUNELEMiLCJmaWxlIjoiL3BhY2thZ2VzL3NlcnZlci1yZW5kZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBNZXRlb3IgfSBmcm9tIFwibWV0ZW9yL21ldGVvclwiO1xuaW1wb3J0IFwiLi9zZXJ2ZXItcmVnaXN0ZXIuanNcIjtcblxuY29uc3Qgc3RhcnR1cFByb21pc2UgPSBuZXcgUHJvbWlzZShNZXRlb3Iuc3RhcnR1cCk7XG5jb25zdCBwYWdlTG9hZENhbGxiYWNrcyA9IG5ldyBTZXQ7XG5cbmV4cG9ydCBmdW5jdGlvbiBvblBhZ2VMb2FkKGNhbGxiYWNrKSB7XG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIHBhZ2VMb2FkQ2FsbGJhY2tzLmFkZChjYWxsYmFjayk7XG4gIH1cblxuICAvLyBSZXR1cm4gdGhlIGNhbGxiYWNrIHNvIHRoYXQgaXQgY2FuIGJlIG1vcmUgZWFzaWx5IHJlbW92ZWQgbGF0ZXIuXG4gIHJldHVybiBjYWxsYmFjaztcbn1cblxub25QYWdlTG9hZC5yZW1vdmUgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgcGFnZUxvYWRDYWxsYmFja3MuZGVsZXRlKGNhbGxiYWNrKTtcbn07XG5cbm9uUGFnZUxvYWQuY2xlYXIgPSBmdW5jdGlvbiAoKSB7XG4gIHBhZ2VMb2FkQ2FsbGJhY2tzLmNsZWFyKCk7XG59O1xuXG5vblBhZ2VMb2FkLmNoYWluID0gZnVuY3Rpb24gKGhhbmRsZXIpIHtcbiAgcmV0dXJuIHN0YXJ0dXBQcm9taXNlLnRoZW4oKCkgPT4ge1xuICAgIGxldCBwcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgcGFnZUxvYWRDYWxsYmFja3MuZm9yRWFjaChjYWxsYmFjayA9PiB7XG4gICAgICBwcm9taXNlID0gcHJvbWlzZS50aGVuKCgpID0+IGhhbmRsZXIoY2FsbGJhY2spKTtcbiAgICB9KTtcbiAgICByZXR1cm4gcHJvbWlzZTtcbiAgfSk7XG59O1xuIiwiaW1wb3J0IHsgV2ViQXBwSW50ZXJuYWxzIH0gZnJvbSBcIm1ldGVvci93ZWJhcHBcIjtcbmltcG9ydCBNYWdpY1N0cmluZyBmcm9tIFwibWFnaWMtc3RyaW5nXCI7XG5pbXBvcnQgeyBTQVhQYXJzZXIgfSBmcm9tIFwicGFyc2U1XCI7XG5pbXBvcnQgeyBjcmVhdGUgYXMgY3JlYXRlU3RyZWFtIH0gZnJvbSBcImNvbWJpbmVkLXN0cmVhbTJcIjtcbmltcG9ydCB7IFNlcnZlclNpbmssIGlzUmVhZGFibGUgfSBmcm9tIFwiLi9zZXJ2ZXItc2luay5qc1wiO1xuaW1wb3J0IHsgb25QYWdlTG9hZCB9IGZyb20gXCIuL3NlcnZlci5qc1wiO1xuXG5XZWJBcHBJbnRlcm5hbHMucmVnaXN0ZXJCb2lsZXJwbGF0ZURhdGFDYWxsYmFjayhcbiAgXCJtZXRlb3Ivc2VydmVyLXJlbmRlclwiLFxuICAocmVxdWVzdCwgZGF0YSwgYXJjaCkgPT4ge1xuICAgIGNvbnN0IHNpbmsgPSBuZXcgU2VydmVyU2luayhyZXF1ZXN0LCBhcmNoKTtcblxuICAgIHJldHVybiBvblBhZ2VMb2FkLmNoYWluKFxuICAgICAgY2FsbGJhY2sgPT4gY2FsbGJhY2soc2luaywgcmVxdWVzdClcbiAgICApLnRoZW4oKCkgPT4ge1xuICAgICAgaWYgKCEgc2luay5tYXliZU1hZGVDaGFuZ2VzKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgbGV0IHJlYWxseU1hZGVDaGFuZ2VzID0gZmFsc2U7XG5cbiAgICAgIGZ1bmN0aW9uIHJld3JpdGUocHJvcGVydHkpIHtcbiAgICAgICAgY29uc3QgaHRtbCA9IGRhdGFbcHJvcGVydHldO1xuICAgICAgICBpZiAodHlwZW9mIGh0bWwgIT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBtYWdpYyA9IG5ldyBNYWdpY1N0cmluZyhodG1sKTtcbiAgICAgICAgY29uc3QgcGFyc2VyID0gbmV3IFNBWFBhcnNlcih7XG4gICAgICAgICAgbG9jYXRpb25JbmZvOiB0cnVlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGRhdGFbcHJvcGVydHldID0gcGFyc2VyO1xuXG4gICAgICAgIGlmIChPYmplY3Qua2V5cyhzaW5rLmh0bWxCeUlkKS5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zdCBzdHJlYW0gPSBjcmVhdGVTdHJlYW0oKTtcblxuICAgICAgICAgIGxldCBsYXN0U3RhcnQgPSBtYWdpYy5zdGFydDtcbiAgICAgICAgICBwYXJzZXIub24oXCJzdGFydFRhZ1wiLCAobmFtZSwgYXR0cnMsIHNlbGZDbG9zaW5nLCBsb2MpID0+IHtcbiAgICAgICAgICAgIGF0dHJzLnNvbWUoYXR0ciA9PiB7XG4gICAgICAgICAgICAgIGlmIChhdHRyLm5hbWUgPT09IFwiaWRcIikge1xuICAgICAgICAgICAgICAgIGxldCBodG1sID0gc2luay5odG1sQnlJZFthdHRyLnZhbHVlXTtcbiAgICAgICAgICAgICAgICBpZiAoaHRtbCkge1xuICAgICAgICAgICAgICAgICAgcmVhbGx5TWFkZUNoYW5nZXMgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgY29uc3Qgc3RhcnQgPSBtYWdpYy5zbGljZShsYXN0U3RhcnQsIGxvYy5lbmRPZmZzZXQpO1xuICAgICAgICAgICAgICAgICAgc3RyZWFtLmFwcGVuZChCdWZmZXIuZnJvbShzdGFydCwgXCJ1dGY4XCIpKTtcbiAgICAgICAgICAgICAgICAgIHN0cmVhbS5hcHBlbmQoXG4gICAgICAgICAgICAgICAgICAgIHR5cGVvZiBodG1sID09PSBcInN0cmluZ1wiXG4gICAgICAgICAgICAgICAgICAgICAgPyBCdWZmZXIuZnJvbShodG1sLCBcInV0ZjhcIilcbiAgICAgICAgICAgICAgICAgICAgICA6IGh0bWxcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICBsYXN0U3RhcnQgPSBsb2MuZW5kT2Zmc2V0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBwYXJzZXIub24oXCJlbmRUYWdcIiwgKG5hbWUsIGxvY2F0aW9uKSA9PiB7XG4gICAgICAgICAgICBpZiAobG9jYXRpb24uZW5kT2Zmc2V0ID09PSBodG1sLmxlbmd0aCkge1xuICAgICAgICAgICAgICAvLyByZWFjaGVkIHRoZSBlbmQgb2YgdGhlIHRlbXBsYXRlXG4gICAgICAgICAgICAgIGNvbnN0IGVuZCA9IG1hZ2ljLnNsaWNlKGxhc3RTdGFydCk7XG4gICAgICAgICAgICAgIHN0cmVhbS5hcHBlbmQoQnVmZmVyLmZyb20oZW5kLCBcInV0ZjhcIikpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pXG5cbiAgICAgICAgICBkYXRhW3Byb3BlcnR5XSA9IHN0cmVhbTtcbiAgICAgICAgfVxuXG4gICAgICAgIHBhcnNlci53cml0ZShodG1sLCBwYXJzZXIuZW5kLmJpbmQocGFyc2VyKSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChzaW5rLmhlYWQpIHtcbiAgICAgICAgZGF0YS5keW5hbWljSGVhZCA9IChkYXRhLmR5bmFtaWNIZWFkIHx8IFwiXCIpICsgc2luay5oZWFkO1xuICAgICAgICByZWFsbHlNYWRlQ2hhbmdlcyA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChPYmplY3Qua2V5cyhzaW5rLmh0bWxCeUlkKS5sZW5ndGggPiAwKSB7XG4gICAgICAgIC8vIFdlIGRvbid0IGN1cnJlbnRseSBhbGxvdyBpbmplY3RpbmcgSFRNTCBpbnRvIHRoZSA8aGVhZD4gZXhjZXB0XG4gICAgICAgIC8vIGJ5IGNhbGxpbmcgc2luay5hcHBlbmRIZWFkKGh0bWwpLlxuICAgICAgICByZXdyaXRlKFwiYm9keVwiKTtcbiAgICAgICAgcmV3cml0ZShcImR5bmFtaWNCb2R5XCIpO1xuICAgICAgfVxuXG4gICAgICBpZiAoc2luay5ib2R5KSB7XG4gICAgICAgIGRhdGEuZHluYW1pY0JvZHkgPSAoZGF0YS5keW5hbWljQm9keSB8fCBcIlwiKSArIHNpbmsuYm9keTtcbiAgICAgICAgcmVhbGx5TWFkZUNoYW5nZXMgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoc2luay5zdGF0dXNDb2RlKSB7XG4gICAgICAgIGRhdGEuc3RhdHVzQ29kZSA9IHNpbmsuc3RhdHVzQ29kZTtcbiAgICAgICAgcmVhbGx5TWFkZUNoYW5nZXMgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoT2JqZWN0LmtleXMoc2luay5yZXNwb25zZUhlYWRlcnMpKXtcbiAgICAgICAgZGF0YS5oZWFkZXJzID0gc2luay5yZXNwb25zZUhlYWRlcnM7XG4gICAgICAgIHJlYWxseU1hZGVDaGFuZ2VzID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlYWxseU1hZGVDaGFuZ2VzO1xuICAgIH0pO1xuICB9XG4pO1xuIiwiZXhwb3J0IGNsYXNzIFNlcnZlclNpbmsge1xuICBjb25zdHJ1Y3RvcihyZXF1ZXN0LCBhcmNoKSB7XG4gICAgdGhpcy5yZXF1ZXN0ID0gcmVxdWVzdDtcbiAgICB0aGlzLmFyY2ggPSBhcmNoO1xuICAgIHRoaXMuaGVhZCA9IFwiXCI7XG4gICAgdGhpcy5ib2R5ID0gXCJcIjtcbiAgICB0aGlzLmh0bWxCeUlkID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICB0aGlzLm1heWJlTWFkZUNoYW5nZXMgPSBmYWxzZTtcbiAgICB0aGlzLnN0YXR1c0NvZGUgPSBudWxsO1xuICAgIHRoaXMucmVzcG9uc2VIZWFkZXJzID0ge307XG4gIH1cblxuICBhcHBlbmRUb0hlYWQoaHRtbCkge1xuICAgIGlmIChhcHBlbmRDb250ZW50KHRoaXMsIFwiaGVhZFwiLCBodG1sKSkge1xuICAgICAgdGhpcy5tYXliZU1hZGVDaGFuZ2VzID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBhcHBlbmRUb0JvZHkoaHRtbCkge1xuICAgIGlmIChhcHBlbmRDb250ZW50KHRoaXMsIFwiYm9keVwiLCBodG1sKSkge1xuICAgICAgdGhpcy5tYXliZU1hZGVDaGFuZ2VzID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBhcHBlbmRUb0VsZW1lbnRCeUlkKGlkLCBodG1sKSB7XG4gICAgaWYgKGFwcGVuZENvbnRlbnQodGhpcy5odG1sQnlJZCwgaWQsIGh0bWwpKSB7XG4gICAgICB0aGlzLm1heWJlTWFkZUNoYW5nZXMgPSB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIHJlbmRlckludG9FbGVtZW50QnlJZChpZCwgaHRtbCkge1xuICAgIHRoaXMuaHRtbEJ5SWRbaWRdID0gXCJcIjtcbiAgICB0aGlzLmFwcGVuZFRvRWxlbWVudEJ5SWQoaWQsIGh0bWwpO1xuICB9XG5cbiAgcmVkaXJlY3QobG9jYXRpb24sIGNvZGUgPSAzMDEpIHtcbiAgICB0aGlzLm1heWJlTWFkZUNoYW5nZXMgPSB0cnVlO1xuICAgIHRoaXMuc3RhdHVzQ29kZSA9IGNvZGU7XG4gICAgdGhpcy5yZXNwb25zZUhlYWRlcnMuTG9jYXRpb24gPSBsb2NhdGlvbjtcbiAgfVxuXG4gIC8vIHNlcnZlciBvbmx5IG1ldGhvZHNcbiAgc2V0U3RhdHVzQ29kZShjb2RlKSB7XG4gICAgdGhpcy5tYXliZU1hZGVDaGFuZ2VzID0gdHJ1ZTtcbiAgICB0aGlzLnN0YXR1c0NvZGUgPSBjb2RlO1xuICB9XG5cbiAgc2V0SGVhZGVyKGtleSwgdmFsdWUpIHtcbiAgICB0aGlzLm1heWJlTWFkZUNoYW5nZXMgPSB0cnVlO1xuICAgIHRoaXMucmVzcG9uc2VIZWFkZXJzW2tleV0gPSB2YWx1ZTtcbiAgfVxuXG4gIGdldEhlYWRlcnMoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdC5oZWFkZXJzO1xuICB9XG5cbiAgZ2V0Q29va2llcygpIHtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0LmNvb2tpZXM7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzUmVhZGFibGUoc3RyZWFtKSB7XG4gIHJldHVybiAoXG4gICAgc3RyZWFtICE9PSBudWxsICYmXG4gICAgdHlwZW9mIHN0cmVhbSA9PT0gJ29iamVjdCcgJiZcbiAgICB0eXBlb2Ygc3RyZWFtLnBpcGUgPT09ICdmdW5jdGlvbicgJiZcbiAgICBzdHJlYW0ucmVhZGFibGUgIT09IGZhbHNlICYmXG4gICAgdHlwZW9mIHN0cmVhbS5fcmVhZCA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgIHR5cGVvZiBzdHJlYW0uX3JlYWRhYmxlU3RhdGUgPT09ICdvYmplY3QnXG4gICk7XG59XG5cbmZ1bmN0aW9uIGFwcGVuZENvbnRlbnQob2JqZWN0LCBwcm9wZXJ0eSwgY29udGVudCkge1xuICBsZXQgbWFkZUNoYW5nZXMgPSBmYWxzZTtcblxuICBpZiAoQXJyYXkuaXNBcnJheShjb250ZW50KSkge1xuICAgIGNvbnRlbnQuZm9yRWFjaChlbGVtID0+IHtcbiAgICAgIGlmIChhcHBlbmRDb250ZW50KG9iamVjdCwgcHJvcGVydHksIGVsZW0pKSB7XG4gICAgICAgIG1hZGVDaGFuZ2VzID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSBlbHNlIGlmIChpc1JlYWRhYmxlKGNvbnRlbnQpKSB7XG4gICAgb2JqZWN0W3Byb3BlcnR5XSA9IGNvbnRlbnQ7XG4gICAgbWFkZUNoYW5nZXMgPSB0cnVlO1xuICB9IGVsc2UgaWYgKChjb250ZW50ID0gY29udGVudCAmJiBjb250ZW50LnRvU3RyaW5nKFwidXRmOFwiKSkpIHtcbiAgICBvYmplY3RbcHJvcGVydHldID0gKG9iamVjdFtwcm9wZXJ0eV0gfHwgXCJcIikgKyBjb250ZW50O1xuICAgIG1hZGVDaGFuZ2VzID0gdHJ1ZTtcbiAgfSBcbiAgcmV0dXJuIG1hZGVDaGFuZ2VzO1xufVxuIl19
