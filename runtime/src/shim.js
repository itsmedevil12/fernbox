// The minimal ambient the bundled runtime needs in a context with no Node.
//
// esbuild prepends this as a banner, so it runs before any module body: some
// polyfills read `process.env` at import time, and an ordinary import in
// index.js would initialize after them.
//
// esbuild places the banner outside the generated IIFE, so these land as
// properties of the system context's global and every module inside resolves
// them through the scope chain. The user context is a separate realm and never
// sees them. The values are deliberately content-free: the sandbox must not
// learn anything about the host it runs on, so `env` is empty rather than a
// copy of the real one.

var process = {
  env: {},
  pid: 0,
  platform: "linux",
  // Some polyfills (the copy of readable-stream inside ripemd160) pick their
  // write strategy by comparing `process.version.slice(0, 5)` at import time,
  // so a version string has to exist before the boot bundle builds the real
  // `process`. The value describes a supported Node, not the host.
  version: "20.0.0",
  versions: { node: "20.0.0" },
  title: "node",
  browser: false,
  argv: [],
  // Streams route internal errors through nextTick. V8's microtask queue is
  // available in the isolate, so this is a real scheduler, not a no-op.
  nextTick: function (cb) {
    var args = Array.prototype.slice.call(arguments, 1);
    Promise.resolve().then(function () {
      cb.apply(null, args);
    });
  },
  // Polyfalls probe these to decide whether to warn; the answer is "don't".
  noDeprecation: true,
};

// The WHATWG codecs. V8 is ECMAScript only, so `TextEncoder` does not exist,
// and the url polyfill (`whatwg-url`) constructs one at module load. UTF-8 is
// the sandbox's text surface; utf-16le and windows-1252 are decoded too,
// because Node's TextDecoder accepts them and a dependency may probe for them.
// Installed conditionally so a future V8 that ships the real ones wins.
(function () {
  if (typeof globalThis.TextEncoder === "undefined") {
    var encodeUtf8 = function (input) {
      var text = String(input);
      var bytes = [];
      for (var i = 0; i < text.length; i++) {
        var c = text.charCodeAt(i);
        if (c >= 0xd800 && c <= 0xdbff) {
          var next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
          if (next >= 0xdc00 && next <= 0xdfff) {
            c = 0x10000 + ((c - 0xd800) << 10) + (next - 0xdc00);
            i++;
          } else {
            c = 0xfffd;
          }
        } else if (c >= 0xdc00 && c <= 0xdfff) {
          c = 0xfffd;
        }
        if (c < 0x80) bytes.push(c);
        else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
        else if (c < 0x10000)
          bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
        else
          bytes.push(
            0xf0 | (c >> 18),
            0x80 | ((c >> 12) & 0x3f),
            0x80 | ((c >> 6) & 0x3f),
            0x80 | (c & 0x3f),
          );
      }
      return Uint8Array.from(bytes);
    };

    globalThis.TextEncoder = class TextEncoder {
      constructor() {
        this.encoding = "utf-8";
      }
      encode(input) {
        return encodeUtf8(input === undefined ? "" : input);
      }
      encodeInto(source, destination) {
        var bytes = encodeUtf8(source);
        var written = Math.min(bytes.length, destination.length);
        destination.set(bytes.subarray(0, written));
        return { read: String(source).length, written: written };
      }
    };

    var WINDOWS_1252 = [
      0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030,
      0x160, 0x2039, 0x152, 0x8d, 0x17d, 0x8f, 0x90, 0x2018, 0x2019, 0x201c,
      0x201d, 0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x9d,
      0x17e, 0x178,
    ];

    var decodeUtf8 = function (bytes, fatal) {
      var points = [];
      var i = 0;
      var replace = function () {
        if (fatal) throw new TypeError("The encoded data was not valid utf-8");
        points.push(0xfffd);
      };
      while (i < bytes.length) {
        var b = bytes[i++];
        var need;
        var c;
        if (b < 0x80) {
          points.push(b);
          continue;
        } else if ((b & 0xe0) === 0xc0) {
          need = 1;
          c = b & 0x1f;
        } else if ((b & 0xf0) === 0xe0) {
          need = 2;
          c = b & 0x0f;
        } else if ((b & 0xf8) === 0xf0) {
          need = 3;
          c = b & 0x07;
        } else {
          replace();
          continue;
        }
        if (i + need > bytes.length) {
          replace();
          break;
        }
        var ok = true;
        for (var k = 0; k < need; k++) {
          var cont = bytes[i + k];
          if ((cont & 0xc0) !== 0x80) {
            ok = false;
            break;
          }
          c = (c << 6) | (cont & 0x3f);
        }
        if (!ok) {
          replace();
          continue;
        }
        i += need;
        var minimum = need === 1 ? 0x80 : need === 2 ? 0x800 : 0x10000;
        if (c < minimum || c > 0x10ffff || (c >= 0xd800 && c <= 0xdfff)) {
          replace();
          continue;
        }
        points.push(c);
      }
      var out = "";
      for (var j = 0; j < points.length; j += 4096)
        out += String.fromCodePoint.apply(null, points.slice(j, j + 4096));
      return out;
    };

    globalThis.TextDecoder = class TextDecoder {
      constructor(encoding, options) {
        var label = String(encoding === undefined ? "utf-8" : encoding)
          .toLowerCase()
          .trim();
        if (["utf-8", "utf8", "unicode-1-1-utf-8"].indexOf(label) >= 0) {
          this.encoding = "utf-8";
        } else if (["utf-16le", "utf-16"].indexOf(label) >= 0) {
          this.encoding = "utf-16le";
        } else if (
          ["latin1", "iso-8859-1", "windows-1252", "ascii", "us-ascii"].indexOf(label) >= 0
        ) {
          this.encoding = "windows-1252";
        } else {
          throw new RangeError("The encoding label provided ('" + encoding + "') is invalid.");
        }
        this.fatal = Boolean(options && options.fatal);
        this.ignoreBOM = Boolean(options && options.ignoreBOM);
      }
      decode(input) {
        if (input === undefined) return "";
        var bytes =
          input instanceof ArrayBuffer
            ? new Uint8Array(input)
            : ArrayBuffer.isView(input)
              ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
              : (function () {
                  throw new TypeError(
                    "The 'input' argument must be an instance of ArrayBuffer or ArrayBufferView",
                  );
                })();
        var at = 0;
        if (this.encoding === "utf-8") {
          if (!this.ignoreBOM && bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
            at = 3;
          return decodeUtf8(bytes.subarray(at), this.fatal);
        }
        if (this.encoding === "utf-16le") {
          if (!this.ignoreBOM && bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) at = 2;
          var units = [];
          for (var i = at; i + 1 < bytes.length; i += 2)
            units.push(bytes[i] | (bytes[i + 1] << 8));
          if (i < bytes.length) units.push(0xfffd);
          var out = "";
          for (var j = 0; j < units.length; j += 4096)
            out += String.fromCharCode.apply(null, units.slice(j, j + 4096));
          return out;
        }
        var text = "";
        for (var k = at; k < bytes.length; k++) {
          var b = bytes[k];
          text += String.fromCharCode(b >= 0x80 && b <= 0x9f ? WINDOWS_1252[b - 0x80] : b);
        }
        return text;
      }
    };
  }
})();
