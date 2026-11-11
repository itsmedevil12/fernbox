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

(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // node_modules/base64-js/index.js
  var require_base64_js = __commonJS({
    "node_modules/base64-js/index.js"(exports) {
      "use strict";
      exports.byteLength = byteLength2;
      exports.toByteArray = toByteArray;
      exports.fromByteArray = fromByteArray;
      var lookup = [];
      var revLookup = [];
      var Arr = typeof Uint8Array !== "undefined" ? Uint8Array : Array;
      var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      for (i = 0, len = code.length; i < len; ++i) {
        lookup[i] = code[i];
        revLookup[code.charCodeAt(i)] = i;
      }
      var i;
      var len;
      revLookup["-".charCodeAt(0)] = 62;
      revLookup["_".charCodeAt(0)] = 63;
      function getLens(b64) {
        var len2 = b64.length;
        if (len2 % 4 > 0) {
          throw new Error("Invalid string. Length must be a multiple of 4");
        }
        var validLen = b64.indexOf("=");
        if (validLen === -1) validLen = len2;
        var placeHoldersLen = validLen === len2 ? 0 : 4 - validLen % 4;
        return [validLen, placeHoldersLen];
      }
      function byteLength2(b64) {
        var lens = getLens(b64);
        var validLen = lens[0];
        var placeHoldersLen = lens[1];
        return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
      }
      function _byteLength(b64, validLen, placeHoldersLen) {
        return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
      }
      function toByteArray(b64) {
        var tmp;
        var lens = getLens(b64);
        var validLen = lens[0];
        var placeHoldersLen = lens[1];
        var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));
        var curByte = 0;
        var len2 = placeHoldersLen > 0 ? validLen - 4 : validLen;
        var i2;
        for (i2 = 0; i2 < len2; i2 += 4) {
          tmp = revLookup[b64.charCodeAt(i2)] << 18 | revLookup[b64.charCodeAt(i2 + 1)] << 12 | revLookup[b64.charCodeAt(i2 + 2)] << 6 | revLookup[b64.charCodeAt(i2 + 3)];
          arr[curByte++] = tmp >> 16 & 255;
          arr[curByte++] = tmp >> 8 & 255;
          arr[curByte++] = tmp & 255;
        }
        if (placeHoldersLen === 2) {
          tmp = revLookup[b64.charCodeAt(i2)] << 2 | revLookup[b64.charCodeAt(i2 + 1)] >> 4;
          arr[curByte++] = tmp & 255;
        }
        if (placeHoldersLen === 1) {
          tmp = revLookup[b64.charCodeAt(i2)] << 10 | revLookup[b64.charCodeAt(i2 + 1)] << 4 | revLookup[b64.charCodeAt(i2 + 2)] >> 2;
          arr[curByte++] = tmp >> 8 & 255;
          arr[curByte++] = tmp & 255;
        }
        return arr;
      }
      function tripletToBase64(num) {
        return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
      }
      function encodeChunk(uint8, start, end) {
        var tmp;
        var output = [];
        for (var i2 = start; i2 < end; i2 += 3) {
          tmp = (uint8[i2] << 16 & 16711680) + (uint8[i2 + 1] << 8 & 65280) + (uint8[i2 + 2] & 255);
          output.push(tripletToBase64(tmp));
        }
        return output.join("");
      }
      function fromByteArray(uint8) {
        var tmp;
        var len2 = uint8.length;
        var extraBytes = len2 % 3;
        var parts = [];
        var maxChunkLength = 16383;
        for (var i2 = 0, len22 = len2 - extraBytes; i2 < len22; i2 += maxChunkLength) {
          parts.push(encodeChunk(uint8, i2, i2 + maxChunkLength > len22 ? len22 : i2 + maxChunkLength));
        }
        if (extraBytes === 1) {
          tmp = uint8[len2 - 1];
          parts.push(
            lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "=="
          );
        } else if (extraBytes === 2) {
          tmp = (uint8[len2 - 2] << 8) + uint8[len2 - 1];
          parts.push(
            lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "="
          );
        }
        return parts.join("");
      }
    }
  });

  // node_modules/ieee754/index.js
  var require_ieee754 = __commonJS({
    "node_modules/ieee754/index.js"(exports) {
      exports.read = function(buffer, offset, isLE, mLen, nBytes) {
        var e, m;
        var eLen = nBytes * 8 - mLen - 1;
        var eMax = (1 << eLen) - 1;
        var eBias = eMax >> 1;
        var nBits = -7;
        var i = isLE ? nBytes - 1 : 0;
        var d = isLE ? -1 : 1;
        var s = buffer[offset + i];
        i += d;
        e = s & (1 << -nBits) - 1;
        s >>= -nBits;
        nBits += eLen;
        for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {
        }
        m = e & (1 << -nBits) - 1;
        e >>= -nBits;
        nBits += mLen;
        for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {
        }
        if (e === 0) {
          e = 1 - eBias;
        } else if (e === eMax) {
          return m ? NaN : (s ? -1 : 1) * Infinity;
        } else {
          m = m + Math.pow(2, mLen);
          e = e - eBias;
        }
        return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
      };
      exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
        var e, m, c;
        var eLen = nBytes * 8 - mLen - 1;
        var eMax = (1 << eLen) - 1;
        var eBias = eMax >> 1;
        var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
        var i = isLE ? 0 : nBytes - 1;
        var d = isLE ? 1 : -1;
        var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
        value = Math.abs(value);
        if (isNaN(value) || value === Infinity) {
          m = isNaN(value) ? 1 : 0;
          e = eMax;
        } else {
          e = Math.floor(Math.log(value) / Math.LN2);
          if (value * (c = Math.pow(2, -e)) < 1) {
            e--;
            c *= 2;
          }
          if (e + eBias >= 1) {
            value += rt / c;
          } else {
            value += rt * Math.pow(2, 1 - eBias);
          }
          if (value * c >= 2) {
            e++;
            c /= 2;
          }
          if (e + eBias >= eMax) {
            m = 0;
            e = eMax;
          } else if (e + eBias >= 1) {
            m = (value * c - 1) * Math.pow(2, mLen);
            e = e + eBias;
          } else {
            m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
            e = 0;
          }
        }
        for (; mLen >= 8; buffer[offset + i] = m & 255, i += d, m /= 256, mLen -= 8) {
        }
        e = e << mLen | m;
        eLen += mLen;
        for (; eLen > 0; buffer[offset + i] = e & 255, i += d, e /= 256, eLen -= 8) {
        }
        buffer[offset + i - d] |= s * 128;
      };
    }
  });

  // node_modules/buffer/index.js
  var require_buffer = __commonJS({
    "node_modules/buffer/index.js"(exports) {
      "use strict";
      var base64 = require_base64_js();
      var ieee754 = require_ieee754();
      var customInspectSymbol = typeof Symbol === "function" && typeof Symbol["for"] === "function" ? Symbol["for"]("nodejs.util.inspect.custom") : null;
      exports.Buffer = Buffer3;
      exports.SlowBuffer = SlowBuffer;
      exports.INSPECT_MAX_BYTES = 50;
      var K_MAX_LENGTH = 2147483647;
      exports.kMaxLength = K_MAX_LENGTH;
      Buffer3.TYPED_ARRAY_SUPPORT = typedArraySupport();
      if (!Buffer3.TYPED_ARRAY_SUPPORT && typeof console !== "undefined" && typeof console.error === "function") {
        console.error(
          "This browser lacks typed array (Uint8Array) support which is required by `buffer` v5.x. Use `buffer` v4.x if you require old browser support."
        );
      }
      function typedArraySupport() {
        try {
          var arr = new Uint8Array(1);
          var proto = { foo: function() {
            return 42;
          } };
          Object.setPrototypeOf(proto, Uint8Array.prototype);
          Object.setPrototypeOf(arr, proto);
          return arr.foo() === 42;
        } catch (e) {
          return false;
        }
      }
      Object.defineProperty(Buffer3.prototype, "parent", {
        enumerable: true,
        get: function() {
          if (!Buffer3.isBuffer(this)) return void 0;
          return this.buffer;
        }
      });
      Object.defineProperty(Buffer3.prototype, "offset", {
        enumerable: true,
        get: function() {
          if (!Buffer3.isBuffer(this)) return void 0;
          return this.byteOffset;
        }
      });
      function createBuffer(length) {
        if (length > K_MAX_LENGTH) {
          throw new RangeError('The value "' + length + '" is invalid for option "size"');
        }
        var buf = new Uint8Array(length);
        Object.setPrototypeOf(buf, Buffer3.prototype);
        return buf;
      }
      function Buffer3(arg, encodingOrOffset, length) {
        if (typeof arg === "number") {
          if (typeof encodingOrOffset === "string") {
            throw new TypeError(
              'The "string" argument must be of type string. Received type number'
            );
          }
          return allocUnsafe(arg);
        }
        return from(arg, encodingOrOffset, length);
      }
      Buffer3.poolSize = 8192;
      function from(value, encodingOrOffset, length) {
        if (typeof value === "string") {
          return fromString(value, encodingOrOffset);
        }
        if (ArrayBuffer.isView(value)) {
          return fromArrayView(value);
        }
        if (value == null) {
          throw new TypeError(
            "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
          );
        }
        if (isInstance(value, ArrayBuffer) || value && isInstance(value.buffer, ArrayBuffer)) {
          return fromArrayBuffer(value, encodingOrOffset, length);
        }
        if (typeof SharedArrayBuffer !== "undefined" && (isInstance(value, SharedArrayBuffer) || value && isInstance(value.buffer, SharedArrayBuffer))) {
          return fromArrayBuffer(value, encodingOrOffset, length);
        }
        if (typeof value === "number") {
          throw new TypeError(
            'The "value" argument must not be of type number. Received type number'
          );
        }
        var valueOf = value.valueOf && value.valueOf();
        if (valueOf != null && valueOf !== value) {
          return Buffer3.from(valueOf, encodingOrOffset, length);
        }
        var b = fromObject(value);
        if (b) return b;
        if (typeof Symbol !== "undefined" && Symbol.toPrimitive != null && typeof value[Symbol.toPrimitive] === "function") {
          return Buffer3.from(
            value[Symbol.toPrimitive]("string"),
            encodingOrOffset,
            length
          );
        }
        throw new TypeError(
          "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
        );
      }
      Buffer3.from = function(value, encodingOrOffset, length) {
        return from(value, encodingOrOffset, length);
      };
      Object.setPrototypeOf(Buffer3.prototype, Uint8Array.prototype);
      Object.setPrototypeOf(Buffer3, Uint8Array);
      function assertSize(size) {
        if (typeof size !== "number") {
          throw new TypeError('"size" argument must be of type number');
        } else if (size < 0) {
          throw new RangeError('The value "' + size + '" is invalid for option "size"');
        }
      }
      function alloc(size, fill, encoding) {
        assertSize(size);
        if (size <= 0) {
          return createBuffer(size);
        }
        if (fill !== void 0) {
          return typeof encoding === "string" ? createBuffer(size).fill(fill, encoding) : createBuffer(size).fill(fill);
        }
        return createBuffer(size);
      }
      Buffer3.alloc = function(size, fill, encoding) {
        return alloc(size, fill, encoding);
      };
      function allocUnsafe(size) {
        assertSize(size);
        return createBuffer(size < 0 ? 0 : checked(size) | 0);
      }
      Buffer3.allocUnsafe = function(size) {
        return allocUnsafe(size);
      };
      Buffer3.allocUnsafeSlow = function(size) {
        return allocUnsafe(size);
      };
      function fromString(string, encoding) {
        if (typeof encoding !== "string" || encoding === "") {
          encoding = "utf8";
        }
        if (!Buffer3.isEncoding(encoding)) {
          throw new TypeError("Unknown encoding: " + encoding);
        }
        var length = byteLength2(string, encoding) | 0;
        var buf = createBuffer(length);
        var actual = buf.write(string, encoding);
        if (actual !== length) {
          buf = buf.slice(0, actual);
        }
        return buf;
      }
      function fromArrayLike(array) {
        var length = array.length < 0 ? 0 : checked(array.length) | 0;
        var buf = createBuffer(length);
        for (var i = 0; i < length; i += 1) {
          buf[i] = array[i] & 255;
        }
        return buf;
      }
      function fromArrayView(arrayView) {
        if (isInstance(arrayView, Uint8Array)) {
          var copy = new Uint8Array(arrayView);
          return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength);
        }
        return fromArrayLike(arrayView);
      }
      function fromArrayBuffer(array, byteOffset, length) {
        if (byteOffset < 0 || array.byteLength < byteOffset) {
          throw new RangeError('"offset" is outside of buffer bounds');
        }
        if (array.byteLength < byteOffset + (length || 0)) {
          throw new RangeError('"length" is outside of buffer bounds');
        }
        var buf;
        if (byteOffset === void 0 && length === void 0) {
          buf = new Uint8Array(array);
        } else if (length === void 0) {
          buf = new Uint8Array(array, byteOffset);
        } else {
          buf = new Uint8Array(array, byteOffset, length);
        }
        Object.setPrototypeOf(buf, Buffer3.prototype);
        return buf;
      }
      function fromObject(obj) {
        if (Buffer3.isBuffer(obj)) {
          var len = checked(obj.length) | 0;
          var buf = createBuffer(len);
          if (buf.length === 0) {
            return buf;
          }
          obj.copy(buf, 0, 0, len);
          return buf;
        }
        if (obj.length !== void 0) {
          if (typeof obj.length !== "number" || numberIsNaN(obj.length)) {
            return createBuffer(0);
          }
          return fromArrayLike(obj);
        }
        if (obj.type === "Buffer" && Array.isArray(obj.data)) {
          return fromArrayLike(obj.data);
        }
      }
      function checked(length) {
        if (length >= K_MAX_LENGTH) {
          throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + K_MAX_LENGTH.toString(16) + " bytes");
        }
        return length | 0;
      }
      function SlowBuffer(length) {
        if (+length != length) {
          length = 0;
        }
        return Buffer3.alloc(+length);
      }
      Buffer3.isBuffer = function isBuffer(b) {
        return b != null && b._isBuffer === true && b !== Buffer3.prototype;
      };
      Buffer3.compare = function compare(a, b) {
        if (isInstance(a, Uint8Array)) a = Buffer3.from(a, a.offset, a.byteLength);
        if (isInstance(b, Uint8Array)) b = Buffer3.from(b, b.offset, b.byteLength);
        if (!Buffer3.isBuffer(a) || !Buffer3.isBuffer(b)) {
          throw new TypeError(
            'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
          );
        }
        if (a === b) return 0;
        var x = a.length;
        var y = b.length;
        for (var i = 0, len = Math.min(x, y); i < len; ++i) {
          if (a[i] !== b[i]) {
            x = a[i];
            y = b[i];
            break;
          }
        }
        if (x < y) return -1;
        if (y < x) return 1;
        return 0;
      };
      Buffer3.isEncoding = function isEncoding(encoding) {
        switch (String(encoding).toLowerCase()) {
          case "hex":
          case "utf8":
          case "utf-8":
          case "ascii":
          case "latin1":
          case "binary":
          case "base64":
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return true;
          default:
            return false;
        }
      };
      Buffer3.concat = function concat(list2, length) {
        if (!Array.isArray(list2)) {
          throw new TypeError('"list" argument must be an Array of Buffers');
        }
        if (list2.length === 0) {
          return Buffer3.alloc(0);
        }
        var i;
        if (length === void 0) {
          length = 0;
          for (i = 0; i < list2.length; ++i) {
            length += list2[i].length;
          }
        }
        var buffer = Buffer3.allocUnsafe(length);
        var pos = 0;
        for (i = 0; i < list2.length; ++i) {
          var buf = list2[i];
          if (isInstance(buf, Uint8Array)) {
            if (pos + buf.length > buffer.length) {
              Buffer3.from(buf).copy(buffer, pos);
            } else {
              Uint8Array.prototype.set.call(
                buffer,
                buf,
                pos
              );
            }
          } else if (!Buffer3.isBuffer(buf)) {
            throw new TypeError('"list" argument must be an Array of Buffers');
          } else {
            buf.copy(buffer, pos);
          }
          pos += buf.length;
        }
        return buffer;
      };
      function byteLength2(string, encoding) {
        if (Buffer3.isBuffer(string)) {
          return string.length;
        }
        if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
          return string.byteLength;
        }
        if (typeof string !== "string") {
          throw new TypeError(
            'The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof string
          );
        }
        var len = string.length;
        var mustMatch = arguments.length > 2 && arguments[2] === true;
        if (!mustMatch && len === 0) return 0;
        var loweredCase = false;
        for (; ; ) {
          switch (encoding) {
            case "ascii":
            case "latin1":
            case "binary":
              return len;
            case "utf8":
            case "utf-8":
              return utf8ToBytes(string).length;
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return len * 2;
            case "hex":
              return len >>> 1;
            case "base64":
              return base64ToBytes(string).length;
            default:
              if (loweredCase) {
                return mustMatch ? -1 : utf8ToBytes(string).length;
              }
              encoding = ("" + encoding).toLowerCase();
              loweredCase = true;
          }
        }
      }
      Buffer3.byteLength = byteLength2;
      function slowToString(encoding, start, end) {
        var loweredCase = false;
        if (start === void 0 || start < 0) {
          start = 0;
        }
        if (start > this.length) {
          return "";
        }
        if (end === void 0 || end > this.length) {
          end = this.length;
        }
        if (end <= 0) {
          return "";
        }
        end >>>= 0;
        start >>>= 0;
        if (end <= start) {
          return "";
        }
        if (!encoding) encoding = "utf8";
        while (true) {
          switch (encoding) {
            case "hex":
              return hexSlice(this, start, end);
            case "utf8":
            case "utf-8":
              return utf8Slice(this, start, end);
            case "ascii":
              return asciiSlice(this, start, end);
            case "latin1":
            case "binary":
              return latin1Slice(this, start, end);
            case "base64":
              return base64Slice(this, start, end);
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return utf16leSlice(this, start, end);
            default:
              if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
              encoding = (encoding + "").toLowerCase();
              loweredCase = true;
          }
        }
      }
      Buffer3.prototype._isBuffer = true;
      function swap(b, n, m) {
        var i = b[n];
        b[n] = b[m];
        b[m] = i;
      }
      Buffer3.prototype.swap16 = function swap16() {
        var len = this.length;
        if (len % 2 !== 0) {
          throw new RangeError("Buffer size must be a multiple of 16-bits");
        }
        for (var i = 0; i < len; i += 2) {
          swap(this, i, i + 1);
        }
        return this;
      };
      Buffer3.prototype.swap32 = function swap32() {
        var len = this.length;
        if (len % 4 !== 0) {
          throw new RangeError("Buffer size must be a multiple of 32-bits");
        }
        for (var i = 0; i < len; i += 4) {
          swap(this, i, i + 3);
          swap(this, i + 1, i + 2);
        }
        return this;
      };
      Buffer3.prototype.swap64 = function swap64() {
        var len = this.length;
        if (len % 8 !== 0) {
          throw new RangeError("Buffer size must be a multiple of 64-bits");
        }
        for (var i = 0; i < len; i += 8) {
          swap(this, i, i + 7);
          swap(this, i + 1, i + 6);
          swap(this, i + 2, i + 5);
          swap(this, i + 3, i + 4);
        }
        return this;
      };
      Buffer3.prototype.toString = function toString() {
        var length = this.length;
        if (length === 0) return "";
        if (arguments.length === 0) return utf8Slice(this, 0, length);
        return slowToString.apply(this, arguments);
      };
      Buffer3.prototype.toLocaleString = Buffer3.prototype.toString;
      Buffer3.prototype.equals = function equals(b) {
        if (!Buffer3.isBuffer(b)) throw new TypeError("Argument must be a Buffer");
        if (this === b) return true;
        return Buffer3.compare(this, b) === 0;
      };
      Buffer3.prototype.inspect = function inspect() {
        var str = "";
        var max = exports.INSPECT_MAX_BYTES;
        str = this.toString("hex", 0, max).replace(/(.{2})/g, "$1 ").trim();
        if (this.length > max) str += " ... ";
        return "<Buffer " + str + ">";
      };
      if (customInspectSymbol) {
        Buffer3.prototype[customInspectSymbol] = Buffer3.prototype.inspect;
      }
      Buffer3.prototype.compare = function compare(target, start, end, thisStart, thisEnd) {
        if (isInstance(target, Uint8Array)) {
          target = Buffer3.from(target, target.offset, target.byteLength);
        }
        if (!Buffer3.isBuffer(target)) {
          throw new TypeError(
            'The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof target
          );
        }
        if (start === void 0) {
          start = 0;
        }
        if (end === void 0) {
          end = target ? target.length : 0;
        }
        if (thisStart === void 0) {
          thisStart = 0;
        }
        if (thisEnd === void 0) {
          thisEnd = this.length;
        }
        if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
          throw new RangeError("out of range index");
        }
        if (thisStart >= thisEnd && start >= end) {
          return 0;
        }
        if (thisStart >= thisEnd) {
          return -1;
        }
        if (start >= end) {
          return 1;
        }
        start >>>= 0;
        end >>>= 0;
        thisStart >>>= 0;
        thisEnd >>>= 0;
        if (this === target) return 0;
        var x = thisEnd - thisStart;
        var y = end - start;
        var len = Math.min(x, y);
        var thisCopy = this.slice(thisStart, thisEnd);
        var targetCopy = target.slice(start, end);
        for (var i = 0; i < len; ++i) {
          if (thisCopy[i] !== targetCopy[i]) {
            x = thisCopy[i];
            y = targetCopy[i];
            break;
          }
        }
        if (x < y) return -1;
        if (y < x) return 1;
        return 0;
      };
      function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
        if (buffer.length === 0) return -1;
        if (typeof byteOffset === "string") {
          encoding = byteOffset;
          byteOffset = 0;
        } else if (byteOffset > 2147483647) {
          byteOffset = 2147483647;
        } else if (byteOffset < -2147483648) {
          byteOffset = -2147483648;
        }
        byteOffset = +byteOffset;
        if (numberIsNaN(byteOffset)) {
          byteOffset = dir ? 0 : buffer.length - 1;
        }
        if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
        if (byteOffset >= buffer.length) {
          if (dir) return -1;
          else byteOffset = buffer.length - 1;
        } else if (byteOffset < 0) {
          if (dir) byteOffset = 0;
          else return -1;
        }
        if (typeof val === "string") {
          val = Buffer3.from(val, encoding);
        }
        if (Buffer3.isBuffer(val)) {
          if (val.length === 0) {
            return -1;
          }
          return arrayIndexOf(buffer, val, byteOffset, encoding, dir);
        } else if (typeof val === "number") {
          val = val & 255;
          if (typeof Uint8Array.prototype.indexOf === "function") {
            if (dir) {
              return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset);
            } else {
              return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset);
            }
          }
          return arrayIndexOf(buffer, [val], byteOffset, encoding, dir);
        }
        throw new TypeError("val must be string, number or Buffer");
      }
      function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
        var indexSize = 1;
        var arrLength = arr.length;
        var valLength = val.length;
        if (encoding !== void 0) {
          encoding = String(encoding).toLowerCase();
          if (encoding === "ucs2" || encoding === "ucs-2" || encoding === "utf16le" || encoding === "utf-16le") {
            if (arr.length < 2 || val.length < 2) {
              return -1;
            }
            indexSize = 2;
            arrLength /= 2;
            valLength /= 2;
            byteOffset /= 2;
          }
        }
        function read2(buf, i2) {
          if (indexSize === 1) {
            return buf[i2];
          } else {
            return buf.readUInt16BE(i2 * indexSize);
          }
        }
        var i;
        if (dir) {
          var foundIndex = -1;
          for (i = byteOffset; i < arrLength; i++) {
            if (read2(arr, i) === read2(val, foundIndex === -1 ? 0 : i - foundIndex)) {
              if (foundIndex === -1) foundIndex = i;
              if (i - foundIndex + 1 === valLength) return foundIndex * indexSize;
            } else {
              if (foundIndex !== -1) i -= i - foundIndex;
              foundIndex = -1;
            }
          }
        } else {
          if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
          for (i = byteOffset; i >= 0; i--) {
            var found = true;
            for (var j = 0; j < valLength; j++) {
              if (read2(arr, i + j) !== read2(val, j)) {
                found = false;
                break;
              }
            }
            if (found) return i;
          }
        }
        return -1;
      }
      Buffer3.prototype.includes = function includes(val, byteOffset, encoding) {
        return this.indexOf(val, byteOffset, encoding) !== -1;
      };
      Buffer3.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
        return bidirectionalIndexOf(this, val, byteOffset, encoding, true);
      };
      Buffer3.prototype.lastIndexOf = function lastIndexOf(val, byteOffset, encoding) {
        return bidirectionalIndexOf(this, val, byteOffset, encoding, false);
      };
      function hexWrite(buf, string, offset, length) {
        offset = Number(offset) || 0;
        var remaining = buf.length - offset;
        if (!length) {
          length = remaining;
        } else {
          length = Number(length);
          if (length > remaining) {
            length = remaining;
          }
        }
        var strLen = string.length;
        if (length > strLen / 2) {
          length = strLen / 2;
        }
        for (var i = 0; i < length; ++i) {
          var parsed = parseInt(string.substr(i * 2, 2), 16);
          if (numberIsNaN(parsed)) return i;
          buf[offset + i] = parsed;
        }
        return i;
      }
      function utf8Write(buf, string, offset, length) {
        return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length);
      }
      function asciiWrite(buf, string, offset, length) {
        return blitBuffer(asciiToBytes(string), buf, offset, length);
      }
      function base64Write(buf, string, offset, length) {
        return blitBuffer(base64ToBytes(string), buf, offset, length);
      }
      function ucs2Write(buf, string, offset, length) {
        return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length);
      }
      Buffer3.prototype.write = function write2(string, offset, length, encoding) {
        if (offset === void 0) {
          encoding = "utf8";
          length = this.length;
          offset = 0;
        } else if (length === void 0 && typeof offset === "string") {
          encoding = offset;
          length = this.length;
          offset = 0;
        } else if (isFinite(offset)) {
          offset = offset >>> 0;
          if (isFinite(length)) {
            length = length >>> 0;
            if (encoding === void 0) encoding = "utf8";
          } else {
            encoding = length;
            length = void 0;
          }
        } else {
          throw new Error(
            "Buffer.write(string, encoding, offset[, length]) is no longer supported"
          );
        }
        var remaining = this.length - offset;
        if (length === void 0 || length > remaining) length = remaining;
        if (string.length > 0 && (length < 0 || offset < 0) || offset > this.length) {
          throw new RangeError("Attempt to write outside buffer bounds");
        }
        if (!encoding) encoding = "utf8";
        var loweredCase = false;
        for (; ; ) {
          switch (encoding) {
            case "hex":
              return hexWrite(this, string, offset, length);
            case "utf8":
            case "utf-8":
              return utf8Write(this, string, offset, length);
            case "ascii":
            case "latin1":
            case "binary":
              return asciiWrite(this, string, offset, length);
            case "base64":
              return base64Write(this, string, offset, length);
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return ucs2Write(this, string, offset, length);
            default:
              if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
              encoding = ("" + encoding).toLowerCase();
              loweredCase = true;
          }
        }
      };
      Buffer3.prototype.toJSON = function toJSON() {
        return {
          type: "Buffer",
          data: Array.prototype.slice.call(this._arr || this, 0)
        };
      };
      function base64Slice(buf, start, end) {
        if (start === 0 && end === buf.length) {
          return base64.fromByteArray(buf);
        } else {
          return base64.fromByteArray(buf.slice(start, end));
        }
      }
      function utf8Slice(buf, start, end) {
        end = Math.min(buf.length, end);
        var res = [];
        var i = start;
        while (i < end) {
          var firstByte = buf[i];
          var codePoint = null;
          var bytesPerSequence = firstByte > 239 ? 4 : firstByte > 223 ? 3 : firstByte > 191 ? 2 : 1;
          if (i + bytesPerSequence <= end) {
            var secondByte, thirdByte, fourthByte, tempCodePoint;
            switch (bytesPerSequence) {
              case 1:
                if (firstByte < 128) {
                  codePoint = firstByte;
                }
                break;
              case 2:
                secondByte = buf[i + 1];
                if ((secondByte & 192) === 128) {
                  tempCodePoint = (firstByte & 31) << 6 | secondByte & 63;
                  if (tempCodePoint > 127) {
                    codePoint = tempCodePoint;
                  }
                }
                break;
              case 3:
                secondByte = buf[i + 1];
                thirdByte = buf[i + 2];
                if ((secondByte & 192) === 128 && (thirdByte & 192) === 128) {
                  tempCodePoint = (firstByte & 15) << 12 | (secondByte & 63) << 6 | thirdByte & 63;
                  if (tempCodePoint > 2047 && (tempCodePoint < 55296 || tempCodePoint > 57343)) {
                    codePoint = tempCodePoint;
                  }
                }
                break;
              case 4:
                secondByte = buf[i + 1];
                thirdByte = buf[i + 2];
                fourthByte = buf[i + 3];
                if ((secondByte & 192) === 128 && (thirdByte & 192) === 128 && (fourthByte & 192) === 128) {
                  tempCodePoint = (firstByte & 15) << 18 | (secondByte & 63) << 12 | (thirdByte & 63) << 6 | fourthByte & 63;
                  if (tempCodePoint > 65535 && tempCodePoint < 1114112) {
                    codePoint = tempCodePoint;
                  }
                }
            }
          }
          if (codePoint === null) {
            codePoint = 65533;
            bytesPerSequence = 1;
          } else if (codePoint > 65535) {
            codePoint -= 65536;
            res.push(codePoint >>> 10 & 1023 | 55296);
            codePoint = 56320 | codePoint & 1023;
          }
          res.push(codePoint);
          i += bytesPerSequence;
        }
        return decodeCodePointsArray(res);
      }
      var MAX_ARGUMENTS_LENGTH = 4096;
      function decodeCodePointsArray(codePoints) {
        var len = codePoints.length;
        if (len <= MAX_ARGUMENTS_LENGTH) {
          return String.fromCharCode.apply(String, codePoints);
        }
        var res = "";
        var i = 0;
        while (i < len) {
          res += String.fromCharCode.apply(
            String,
            codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
          );
        }
        return res;
      }
      function asciiSlice(buf, start, end) {
        var ret = "";
        end = Math.min(buf.length, end);
        for (var i = start; i < end; ++i) {
          ret += String.fromCharCode(buf[i] & 127);
        }
        return ret;
      }
      function latin1Slice(buf, start, end) {
        var ret = "";
        end = Math.min(buf.length, end);
        for (var i = start; i < end; ++i) {
          ret += String.fromCharCode(buf[i]);
        }
        return ret;
      }
      function hexSlice(buf, start, end) {
        var len = buf.length;
        if (!start || start < 0) start = 0;
        if (!end || end < 0 || end > len) end = len;
        var out = "";
        for (var i = start; i < end; ++i) {
          out += hexSliceLookupTable[buf[i]];
        }
        return out;
      }
      function utf16leSlice(buf, start, end) {
        var bytes = buf.slice(start, end);
        var res = "";
        for (var i = 0; i < bytes.length - 1; i += 2) {
          res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
        }
        return res;
      }
      Buffer3.prototype.slice = function slice(start, end) {
        var len = this.length;
        start = ~~start;
        end = end === void 0 ? len : ~~end;
        if (start < 0) {
          start += len;
          if (start < 0) start = 0;
        } else if (start > len) {
          start = len;
        }
        if (end < 0) {
          end += len;
          if (end < 0) end = 0;
        } else if (end > len) {
          end = len;
        }
        if (end < start) end = start;
        var newBuf = this.subarray(start, end);
        Object.setPrototypeOf(newBuf, Buffer3.prototype);
        return newBuf;
      };
      function checkOffset(offset, ext, length) {
        if (offset % 1 !== 0 || offset < 0) throw new RangeError("offset is not uint");
        if (offset + ext > length) throw new RangeError("Trying to access beyond buffer length");
      }
      Buffer3.prototype.readUintLE = Buffer3.prototype.readUIntLE = function readUIntLE(offset, byteLength3, noAssert) {
        offset = offset >>> 0;
        byteLength3 = byteLength3 >>> 0;
        if (!noAssert) checkOffset(offset, byteLength3, this.length);
        var val = this[offset];
        var mul = 1;
        var i = 0;
        while (++i < byteLength3 && (mul *= 256)) {
          val += this[offset + i] * mul;
        }
        return val;
      };
      Buffer3.prototype.readUintBE = Buffer3.prototype.readUIntBE = function readUIntBE(offset, byteLength3, noAssert) {
        offset = offset >>> 0;
        byteLength3 = byteLength3 >>> 0;
        if (!noAssert) {
          checkOffset(offset, byteLength3, this.length);
        }
        var val = this[offset + --byteLength3];
        var mul = 1;
        while (byteLength3 > 0 && (mul *= 256)) {
          val += this[offset + --byteLength3] * mul;
        }
        return val;
      };
      Buffer3.prototype.readUint8 = Buffer3.prototype.readUInt8 = function readUInt8(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 1, this.length);
        return this[offset];
      };
      Buffer3.prototype.readUint16LE = Buffer3.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 2, this.length);
        return this[offset] | this[offset + 1] << 8;
      };
      Buffer3.prototype.readUint16BE = Buffer3.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 2, this.length);
        return this[offset] << 8 | this[offset + 1];
      };
      Buffer3.prototype.readUint32LE = Buffer3.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 4, this.length);
        return (this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16) + this[offset + 3] * 16777216;
      };
      Buffer3.prototype.readUint32BE = Buffer3.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 4, this.length);
        return this[offset] * 16777216 + (this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3]);
      };
      Buffer3.prototype.readIntLE = function readIntLE(offset, byteLength3, noAssert) {
        offset = offset >>> 0;
        byteLength3 = byteLength3 >>> 0;
        if (!noAssert) checkOffset(offset, byteLength3, this.length);
        var val = this[offset];
        var mul = 1;
        var i = 0;
        while (++i < byteLength3 && (mul *= 256)) {
          val += this[offset + i] * mul;
        }
        mul *= 128;
        if (val >= mul) val -= Math.pow(2, 8 * byteLength3);
        return val;
      };
      Buffer3.prototype.readIntBE = function readIntBE(offset, byteLength3, noAssert) {
        offset = offset >>> 0;
        byteLength3 = byteLength3 >>> 0;
        if (!noAssert) checkOffset(offset, byteLength3, this.length);
        var i = byteLength3;
        var mul = 1;
        var val = this[offset + --i];
        while (i > 0 && (mul *= 256)) {
          val += this[offset + --i] * mul;
        }
        mul *= 128;
        if (val >= mul) val -= Math.pow(2, 8 * byteLength3);
        return val;
      };
      Buffer3.prototype.readInt8 = function readInt8(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 1, this.length);
        if (!(this[offset] & 128)) return this[offset];
        return (255 - this[offset] + 1) * -1;
      };
      Buffer3.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 2, this.length);
        var val = this[offset] | this[offset + 1] << 8;
        return val & 32768 ? val | 4294901760 : val;
      };
      Buffer3.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 2, this.length);
        var val = this[offset + 1] | this[offset] << 8;
        return val & 32768 ? val | 4294901760 : val;
      };
      Buffer3.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 4, this.length);
        return this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16 | this[offset + 3] << 24;
      };
      Buffer3.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 4, this.length);
        return this[offset] << 24 | this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3];
      };
      Buffer3.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 4, this.length);
        return ieee754.read(this, offset, true, 23, 4);
      };
      Buffer3.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 4, this.length);
        return ieee754.read(this, offset, false, 23, 4);
      };
      Buffer3.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 8, this.length);
        return ieee754.read(this, offset, true, 52, 8);
      };
      Buffer3.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 8, this.length);
        return ieee754.read(this, offset, false, 52, 8);
      };
      function checkInt(buf, value, offset, ext, max, min) {
        if (!Buffer3.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance');
        if (value > max || value < min) throw new RangeError('"value" argument is out of bounds');
        if (offset + ext > buf.length) throw new RangeError("Index out of range");
      }
      Buffer3.prototype.writeUintLE = Buffer3.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength3, noAssert) {
        value = +value;
        offset = offset >>> 0;
        byteLength3 = byteLength3 >>> 0;
        if (!noAssert) {
          var maxBytes = Math.pow(2, 8 * byteLength3) - 1;
          checkInt(this, value, offset, byteLength3, maxBytes, 0);
        }
        var mul = 1;
        var i = 0;
        this[offset] = value & 255;
        while (++i < byteLength3 && (mul *= 256)) {
          this[offset + i] = value / mul & 255;
        }
        return offset + byteLength3;
      };
      Buffer3.prototype.writeUintBE = Buffer3.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength3, noAssert) {
        value = +value;
        offset = offset >>> 0;
        byteLength3 = byteLength3 >>> 0;
        if (!noAssert) {
          var maxBytes = Math.pow(2, 8 * byteLength3) - 1;
          checkInt(this, value, offset, byteLength3, maxBytes, 0);
        }
        var i = byteLength3 - 1;
        var mul = 1;
        this[offset + i] = value & 255;
        while (--i >= 0 && (mul *= 256)) {
          this[offset + i] = value / mul & 255;
        }
        return offset + byteLength3;
      };
      Buffer3.prototype.writeUint8 = Buffer3.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 1, 255, 0);
        this[offset] = value & 255;
        return offset + 1;
      };
      Buffer3.prototype.writeUint16LE = Buffer3.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
        this[offset] = value & 255;
        this[offset + 1] = value >>> 8;
        return offset + 2;
      };
      Buffer3.prototype.writeUint16BE = Buffer3.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
        this[offset] = value >>> 8;
        this[offset + 1] = value & 255;
        return offset + 2;
      };
      Buffer3.prototype.writeUint32LE = Buffer3.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
        this[offset + 3] = value >>> 24;
        this[offset + 2] = value >>> 16;
        this[offset + 1] = value >>> 8;
        this[offset] = value & 255;
        return offset + 4;
      };
      Buffer3.prototype.writeUint32BE = Buffer3.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
        this[offset] = value >>> 24;
        this[offset + 1] = value >>> 16;
        this[offset + 2] = value >>> 8;
        this[offset + 3] = value & 255;
        return offset + 4;
      };
      Buffer3.prototype.writeIntLE = function writeIntLE(value, offset, byteLength3, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) {
          var limit = Math.pow(2, 8 * byteLength3 - 1);
          checkInt(this, value, offset, byteLength3, limit - 1, -limit);
        }
        var i = 0;
        var mul = 1;
        var sub = 0;
        this[offset] = value & 255;
        while (++i < byteLength3 && (mul *= 256)) {
          if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
            sub = 1;
          }
          this[offset + i] = (value / mul >> 0) - sub & 255;
        }
        return offset + byteLength3;
      };
      Buffer3.prototype.writeIntBE = function writeIntBE(value, offset, byteLength3, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) {
          var limit = Math.pow(2, 8 * byteLength3 - 1);
          checkInt(this, value, offset, byteLength3, limit - 1, -limit);
        }
        var i = byteLength3 - 1;
        var mul = 1;
        var sub = 0;
        this[offset + i] = value & 255;
        while (--i >= 0 && (mul *= 256)) {
          if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
            sub = 1;
          }
          this[offset + i] = (value / mul >> 0) - sub & 255;
        }
        return offset + byteLength3;
      };
      Buffer3.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 1, 127, -128);
        if (value < 0) value = 255 + value + 1;
        this[offset] = value & 255;
        return offset + 1;
      };
      Buffer3.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
        this[offset] = value & 255;
        this[offset + 1] = value >>> 8;
        return offset + 2;
      };
      Buffer3.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
        this[offset] = value >>> 8;
        this[offset + 1] = value & 255;
        return offset + 2;
      };
      Buffer3.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
        this[offset] = value & 255;
        this[offset + 1] = value >>> 8;
        this[offset + 2] = value >>> 16;
        this[offset + 3] = value >>> 24;
        return offset + 4;
      };
      Buffer3.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
        if (value < 0) value = 4294967295 + value + 1;
        this[offset] = value >>> 24;
        this[offset + 1] = value >>> 16;
        this[offset + 2] = value >>> 8;
        this[offset + 3] = value & 255;
        return offset + 4;
      };
      function checkIEEE754(buf, value, offset, ext, max, min) {
        if (offset + ext > buf.length) throw new RangeError("Index out of range");
        if (offset < 0) throw new RangeError("Index out of range");
      }
      function writeFloat(buf, value, offset, littleEndian, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) {
          checkIEEE754(buf, value, offset, 4, 34028234663852886e22, -34028234663852886e22);
        }
        ieee754.write(buf, value, offset, littleEndian, 23, 4);
        return offset + 4;
      }
      Buffer3.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
        return writeFloat(this, value, offset, true, noAssert);
      };
      Buffer3.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
        return writeFloat(this, value, offset, false, noAssert);
      };
      function writeDouble(buf, value, offset, littleEndian, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) {
          checkIEEE754(buf, value, offset, 8, 17976931348623157e292, -17976931348623157e292);
        }
        ieee754.write(buf, value, offset, littleEndian, 52, 8);
        return offset + 8;
      }
      Buffer3.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
        return writeDouble(this, value, offset, true, noAssert);
      };
      Buffer3.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
        return writeDouble(this, value, offset, false, noAssert);
      };
      Buffer3.prototype.copy = function copy(target, targetStart, start, end) {
        if (!Buffer3.isBuffer(target)) throw new TypeError("argument should be a Buffer");
        if (!start) start = 0;
        if (!end && end !== 0) end = this.length;
        if (targetStart >= target.length) targetStart = target.length;
        if (!targetStart) targetStart = 0;
        if (end > 0 && end < start) end = start;
        if (end === start) return 0;
        if (target.length === 0 || this.length === 0) return 0;
        if (targetStart < 0) {
          throw new RangeError("targetStart out of bounds");
        }
        if (start < 0 || start >= this.length) throw new RangeError("Index out of range");
        if (end < 0) throw new RangeError("sourceEnd out of bounds");
        if (end > this.length) end = this.length;
        if (target.length - targetStart < end - start) {
          end = target.length - targetStart + start;
        }
        var len = end - start;
        if (this === target && typeof Uint8Array.prototype.copyWithin === "function") {
          this.copyWithin(targetStart, start, end);
        } else {
          Uint8Array.prototype.set.call(
            target,
            this.subarray(start, end),
            targetStart
          );
        }
        return len;
      };
      Buffer3.prototype.fill = function fill(val, start, end, encoding) {
        if (typeof val === "string") {
          if (typeof start === "string") {
            encoding = start;
            start = 0;
            end = this.length;
          } else if (typeof end === "string") {
            encoding = end;
            end = this.length;
          }
          if (encoding !== void 0 && typeof encoding !== "string") {
            throw new TypeError("encoding must be a string");
          }
          if (typeof encoding === "string" && !Buffer3.isEncoding(encoding)) {
            throw new TypeError("Unknown encoding: " + encoding);
          }
          if (val.length === 1) {
            var code = val.charCodeAt(0);
            if (encoding === "utf8" && code < 128 || encoding === "latin1") {
              val = code;
            }
          }
        } else if (typeof val === "number") {
          val = val & 255;
        } else if (typeof val === "boolean") {
          val = Number(val);
        }
        if (start < 0 || this.length < start || this.length < end) {
          throw new RangeError("Out of range index");
        }
        if (end <= start) {
          return this;
        }
        start = start >>> 0;
        end = end === void 0 ? this.length : end >>> 0;
        if (!val) val = 0;
        var i;
        if (typeof val === "number") {
          for (i = start; i < end; ++i) {
            this[i] = val;
          }
        } else {
          var bytes = Buffer3.isBuffer(val) ? val : Buffer3.from(val, encoding);
          var len = bytes.length;
          if (len === 0) {
            throw new TypeError('The value "' + val + '" is invalid for argument "value"');
          }
          for (i = 0; i < end - start; ++i) {
            this[i + start] = bytes[i % len];
          }
        }
        return this;
      };
      var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;
      function base64clean(str) {
        str = str.split("=")[0];
        str = str.trim().replace(INVALID_BASE64_RE, "");
        if (str.length < 2) return "";
        while (str.length % 4 !== 0) {
          str = str + "=";
        }
        return str;
      }
      function utf8ToBytes(string, units) {
        units = units || Infinity;
        var codePoint;
        var length = string.length;
        var leadSurrogate = null;
        var bytes = [];
        for (var i = 0; i < length; ++i) {
          codePoint = string.charCodeAt(i);
          if (codePoint > 55295 && codePoint < 57344) {
            if (!leadSurrogate) {
              if (codePoint > 56319) {
                if ((units -= 3) > -1) bytes.push(239, 191, 189);
                continue;
              } else if (i + 1 === length) {
                if ((units -= 3) > -1) bytes.push(239, 191, 189);
                continue;
              }
              leadSurrogate = codePoint;
              continue;
            }
            if (codePoint < 56320) {
              if ((units -= 3) > -1) bytes.push(239, 191, 189);
              leadSurrogate = codePoint;
              continue;
            }
            codePoint = (leadSurrogate - 55296 << 10 | codePoint - 56320) + 65536;
          } else if (leadSurrogate) {
            if ((units -= 3) > -1) bytes.push(239, 191, 189);
          }
          leadSurrogate = null;
          if (codePoint < 128) {
            if ((units -= 1) < 0) break;
            bytes.push(codePoint);
          } else if (codePoint < 2048) {
            if ((units -= 2) < 0) break;
            bytes.push(
              codePoint >> 6 | 192,
              codePoint & 63 | 128
            );
          } else if (codePoint < 65536) {
            if ((units -= 3) < 0) break;
            bytes.push(
              codePoint >> 12 | 224,
              codePoint >> 6 & 63 | 128,
              codePoint & 63 | 128
            );
          } else if (codePoint < 1114112) {
            if ((units -= 4) < 0) break;
            bytes.push(
              codePoint >> 18 | 240,
              codePoint >> 12 & 63 | 128,
              codePoint >> 6 & 63 | 128,
              codePoint & 63 | 128
            );
          } else {
            throw new Error("Invalid code point");
          }
        }
        return bytes;
      }
      function asciiToBytes(str) {
        var byteArray = [];
        for (var i = 0; i < str.length; ++i) {
          byteArray.push(str.charCodeAt(i) & 255);
        }
        return byteArray;
      }
      function utf16leToBytes(str, units) {
        var c, hi, lo;
        var byteArray = [];
        for (var i = 0; i < str.length; ++i) {
          if ((units -= 2) < 0) break;
          c = str.charCodeAt(i);
          hi = c >> 8;
          lo = c % 256;
          byteArray.push(lo);
          byteArray.push(hi);
        }
        return byteArray;
      }
      function base64ToBytes(str) {
        return base64.toByteArray(base64clean(str));
      }
      function blitBuffer(src, dst, offset, length) {
        for (var i = 0; i < length; ++i) {
          if (i + offset >= dst.length || i >= src.length) break;
          dst[i + offset] = src[i];
        }
        return i;
      }
      function isInstance(obj, type) {
        return obj instanceof type || obj != null && obj.constructor != null && obj.constructor.name != null && obj.constructor.name === type.name;
      }
      function numberIsNaN(obj) {
        return obj !== obj;
      }
      var hexSliceLookupTable = (function() {
        var alphabet = "0123456789abcdef";
        var table = new Array(256);
        for (var i = 0; i < 16; ++i) {
          var i16 = i * 16;
          for (var j = 0; j < 16; ++j) {
            table[i16 + j] = alphabet[i] + alphabet[j];
          }
        }
        return table;
      })();
    }
  });

  // node_modules/tslib/tslib.es6.mjs
  var tslib_es6_exports = {};
  __export(tslib_es6_exports, {
    __addDisposableResource: () => __addDisposableResource,
    __assign: () => __assign,
    __asyncDelegator: () => __asyncDelegator,
    __asyncGenerator: () => __asyncGenerator,
    __asyncValues: () => __asyncValues,
    __await: () => __await,
    __awaiter: () => __awaiter,
    __classPrivateFieldGet: () => __classPrivateFieldGet,
    __classPrivateFieldIn: () => __classPrivateFieldIn,
    __classPrivateFieldSet: () => __classPrivateFieldSet,
    __createBinding: () => __createBinding,
    __decorate: () => __decorate,
    __disposeResources: () => __disposeResources,
    __esDecorate: () => __esDecorate,
    __exportStar: () => __exportStar,
    __extends: () => __extends,
    __generator: () => __generator,
    __importDefault: () => __importDefault,
    __importStar: () => __importStar,
    __makeTemplateObject: () => __makeTemplateObject,
    __metadata: () => __metadata,
    __param: () => __param,
    __propKey: () => __propKey,
    __read: () => __read,
    __rest: () => __rest,
    __rewriteRelativeImportExtension: () => __rewriteRelativeImportExtension,
    __runInitializers: () => __runInitializers,
    __setFunctionName: () => __setFunctionName,
    __spread: () => __spread,
    __spreadArray: () => __spreadArray,
    __spreadArrays: () => __spreadArrays,
    __values: () => __values,
    default: () => tslib_es6_default
  });
  function __extends(d, b) {
    if (typeof b !== "function" && b !== null)
      throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
    extendStatics(d, b);
    function __() {
      this.constructor = d;
    }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
  }
  function __rest(s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
      t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
      for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
        if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
          t[p[i]] = s[p[i]];
      }
    return t;
  }
  function __decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
  }
  function __param(paramIndex, decorator) {
    return function(target, key) {
      decorator(target, key, paramIndex);
    };
  }
  function __esDecorate(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) {
      if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
      return f;
    }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
      var context = {};
      for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
      for (var p in contextIn.access) context.access[p] = contextIn.access[p];
      context.addInitializer = function(f) {
        if (done) throw new TypeError("Cannot add initializers after decoration has completed");
        extraInitializers.push(accept(f || null));
      };
      var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
      if (kind === "accessor") {
        if (result === void 0) continue;
        if (result === null || typeof result !== "object") throw new TypeError("Object expected");
        if (_ = accept(result.get)) descriptor.get = _;
        if (_ = accept(result.set)) descriptor.set = _;
        if (_ = accept(result.init)) initializers.unshift(_);
      } else if (_ = accept(result)) {
        if (kind === "field") initializers.unshift(_);
        else descriptor[key] = _;
      }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
  }
  function __runInitializers(thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
      value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
  }
  function __propKey(x) {
    return typeof x === "symbol" ? x : "".concat(x);
  }
  function __setFunctionName(f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
  }
  function __metadata(metadataKey, metadataValue) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(metadataKey, metadataValue);
  }
  function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P ? value : new P(function(resolve2) {
        resolve2(value);
      });
    }
    return new (P || (P = Promise))(function(resolve2, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done ? resolve2(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  }
  function __generator(thisArg, body) {
    var _ = { label: 0, sent: function() {
      if (t[0] & 1) throw t[1];
      return t[1];
    }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() {
      return this;
    }), g;
    function verb(n) {
      return function(v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError("Generator is already executing.");
      while (g && (g = 0, op[0] && (_ = 0)), _) try {
        if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
        if (y = 0, t) op = [op[0] & 2, t.value];
        switch (op[0]) {
          case 0:
          case 1:
            t = op;
            break;
          case 4:
            _.label++;
            return { value: op[1], done: false };
          case 5:
            _.label++;
            y = op[1];
            op = [0];
            continue;
          case 7:
            op = _.ops.pop();
            _.trys.pop();
            continue;
          default:
            if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
              _ = 0;
              continue;
            }
            if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
              _.label = op[1];
              break;
            }
            if (op[0] === 6 && _.label < t[1]) {
              _.label = t[1];
              t = op;
              break;
            }
            if (t && _.label < t[2]) {
              _.label = t[2];
              _.ops.push(op);
              break;
            }
            if (t[2]) _.ops.pop();
            _.trys.pop();
            continue;
        }
        op = body.call(thisArg, _);
      } catch (e) {
        op = [6, e];
        y = 0;
      } finally {
        f = t = 0;
      }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  }
  function __exportStar(m, o) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(o, p)) __createBinding(o, m, p);
  }
  function __values(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
      next: function() {
        if (o && i >= o.length) o = void 0;
        return { value: o && o[i++], done: !o };
      }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
  }
  function __read(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
      while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    } catch (error) {
      e = { error };
    } finally {
      try {
        if (r && !r.done && (m = i["return"])) m.call(i);
      } finally {
        if (e) throw e.error;
      }
    }
    return ar;
  }
  function __spread() {
    for (var ar = [], i = 0; i < arguments.length; i++)
      ar = ar.concat(__read(arguments[i]));
    return ar;
  }
  function __spreadArrays() {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
      for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
        r[k] = a[j];
    return r;
  }
  function __spreadArray(to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
      if (ar || !(i in from)) {
        if (!ar) ar = Array.prototype.slice.call(from, 0, i);
        ar[i] = from[i];
      }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
  }
  function __await(v) {
    return this instanceof __await ? (this.v = v, this) : new __await(v);
  }
  function __asyncGenerator(thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function() {
      return this;
    }, i;
    function awaitReturn(f) {
      return function(v) {
        return Promise.resolve(v).then(f, reject);
      };
    }
    function verb(n, f) {
      if (g[n]) {
        i[n] = function(v) {
          return new Promise(function(a, b) {
            q.push([n, v, a, b]) > 1 || resume(n, v);
          });
        };
        if (f) i[n] = f(i[n]);
      }
    }
    function resume(n, v) {
      try {
        step(g[n](v));
      } catch (e) {
        settle(q[0][3], e);
      }
    }
    function step(r) {
      r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);
    }
    function fulfill(value) {
      resume("next", value);
    }
    function reject(value) {
      resume("throw", value);
    }
    function settle(f, v) {
      if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]);
    }
  }
  function __asyncDelegator(o) {
    var i, p;
    return i = {}, verb("next"), verb("throw", function(e) {
      throw e;
    }), verb("return"), i[Symbol.iterator] = function() {
      return this;
    }, i;
    function verb(n, f) {
      i[n] = o[n] ? function(v) {
        return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v;
      } : f;
    }
  }
  function __asyncValues(o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function() {
      return this;
    }, i);
    function verb(n) {
      i[n] = o[n] && function(v) {
        return new Promise(function(resolve2, reject) {
          v = o[n](v), settle(resolve2, reject, v.done, v.value);
        });
      };
    }
    function settle(resolve2, reject, d, v) {
      Promise.resolve(v).then(function(v2) {
        resolve2({ value: v2, done: d });
      }, reject);
    }
  }
  function __makeTemplateObject(cooked, raw) {
    if (Object.defineProperty) {
      Object.defineProperty(cooked, "raw", { value: raw });
    } else {
      cooked.raw = raw;
    }
    return cooked;
  }
  function __importStar(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) {
      for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
    }
    __setModuleDefault(result, mod);
    return result;
  }
  function __importDefault(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  }
  function __classPrivateFieldGet(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
  }
  function __classPrivateFieldSet(receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
  }
  function __classPrivateFieldIn(state, receiver) {
    if (receiver === null || typeof receiver !== "object" && typeof receiver !== "function") throw new TypeError("Cannot use 'in' operator on non-object");
    return typeof state === "function" ? receiver === state : state.has(receiver);
  }
  function __addDisposableResource(env2, value, async) {
    if (value !== null && value !== void 0) {
      if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
      var dispose, inner;
      if (async) {
        if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
        dispose = value[Symbol.asyncDispose];
      }
      if (dispose === void 0) {
        if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
        dispose = value[Symbol.dispose];
        if (async) inner = dispose;
      }
      if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
      if (inner) dispose = function() {
        try {
          inner.call(this);
        } catch (e) {
          return Promise.reject(e);
        }
      };
      env2.stack.push({ value, dispose, async });
    } else if (async) {
      env2.stack.push({ async: true });
    }
    return value;
  }
  function __disposeResources(env2) {
    function fail(e) {
      env2.error = env2.hasError ? new _SuppressedError(e, env2.error, "An error was suppressed during disposal.") : e;
      env2.hasError = true;
    }
    var r, s = 0;
    function next() {
      while (r = env2.stack.pop()) {
        try {
          if (!r.async && s === 1) return s = 0, env2.stack.push(r), Promise.resolve().then(next);
          if (r.dispose) {
            var result = r.dispose.call(r.value);
            if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) {
              fail(e);
              return next();
            });
          } else s |= 1;
        } catch (e) {
          fail(e);
        }
      }
      if (s === 1) return env2.hasError ? Promise.reject(env2.error) : Promise.resolve();
      if (env2.hasError) throw env2.error;
    }
    return next();
  }
  function __rewriteRelativeImportExtension(path2, preserveJsx) {
    if (typeof path2 === "string" && /^\.\.?\//.test(path2)) {
      return path2.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function(m, tsx, d, ext, cm) {
        return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : d + ext + "." + cm.toLowerCase() + "js";
      });
    }
    return path2;
  }
  var extendStatics, __assign, __createBinding, __setModuleDefault, ownKeys, _SuppressedError, tslib_es6_default;
  var init_tslib_es6 = __esm({
    "node_modules/tslib/tslib.es6.mjs"() {
      extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      __assign = function() {
        __assign = Object.assign || function __assign2(t) {
          for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
          }
          return t;
        };
        return __assign.apply(this, arguments);
      };
      __createBinding = Object.create ? (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() {
            return m[k];
          } };
        }
        Object.defineProperty(o, k2, desc);
      }) : (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        o[k2] = m[k];
      });
      __setModuleDefault = Object.create ? (function(o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }) : function(o, v) {
        o["default"] = v;
      };
      ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      _SuppressedError = typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
        var e = new Error(message);
        return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
      };
      tslib_es6_default = {
        __extends,
        __assign,
        __rest,
        __decorate,
        __param,
        __esDecorate,
        __runInitializers,
        __propKey,
        __setFunctionName,
        __metadata,
        __awaiter,
        __generator,
        __createBinding,
        __exportStar,
        __values,
        __read,
        __spread,
        __spreadArrays,
        __spreadArray,
        __await,
        __asyncGenerator,
        __asyncDelegator,
        __asyncValues,
        __makeTemplateObject,
        __importStar,
        __importDefault,
        __classPrivateFieldGet,
        __classPrivateFieldSet,
        __classPrivateFieldIn,
        __addDisposableResource,
        __disposeResources,
        __rewriteRelativeImportExtension
      };
    }
  });

  // node_modules/path-browserify/index.js
  var require_path_browserify = __commonJS({
    "node_modules/path-browserify/index.js"(exports, module) {
      "use strict";
      function assertPath(path2) {
        if (typeof path2 !== "string") {
          throw new TypeError("Path must be a string. Received " + JSON.stringify(path2));
        }
      }
      function normalizeStringPosix(path2, allowAboveRoot) {
        var res = "";
        var lastSegmentLength = 0;
        var lastSlash = -1;
        var dots = 0;
        var code;
        for (var i = 0; i <= path2.length; ++i) {
          if (i < path2.length)
            code = path2.charCodeAt(i);
          else if (code === 47)
            break;
          else
            code = 47;
          if (code === 47) {
            if (lastSlash === i - 1 || dots === 1) {
            } else if (lastSlash !== i - 1 && dots === 2) {
              if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== 46 || res.charCodeAt(res.length - 2) !== 46) {
                if (res.length > 2) {
                  var lastSlashIndex = res.lastIndexOf("/");
                  if (lastSlashIndex !== res.length - 1) {
                    if (lastSlashIndex === -1) {
                      res = "";
                      lastSegmentLength = 0;
                    } else {
                      res = res.slice(0, lastSlashIndex);
                      lastSegmentLength = res.length - 1 - res.lastIndexOf("/");
                    }
                    lastSlash = i;
                    dots = 0;
                    continue;
                  }
                } else if (res.length === 2 || res.length === 1) {
                  res = "";
                  lastSegmentLength = 0;
                  lastSlash = i;
                  dots = 0;
                  continue;
                }
              }
              if (allowAboveRoot) {
                if (res.length > 0)
                  res += "/..";
                else
                  res = "..";
                lastSegmentLength = 2;
              }
            } else {
              if (res.length > 0)
                res += "/" + path2.slice(lastSlash + 1, i);
              else
                res = path2.slice(lastSlash + 1, i);
              lastSegmentLength = i - lastSlash - 1;
            }
            lastSlash = i;
            dots = 0;
          } else if (code === 46 && dots !== -1) {
            ++dots;
          } else {
            dots = -1;
          }
        }
        return res;
      }
      function _format(sep, pathObject) {
        var dir = pathObject.dir || pathObject.root;
        var base2 = pathObject.base || (pathObject.name || "") + (pathObject.ext || "");
        if (!dir) {
          return base2;
        }
        if (dir === pathObject.root) {
          return dir + base2;
        }
        return dir + sep + base2;
      }
      var posix = {
        // path.resolve([from ...], to)
        resolve: function resolve2() {
          var resolvedPath = "";
          var resolvedAbsolute = false;
          var cwd2;
          for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
            var path2;
            if (i >= 0)
              path2 = arguments[i];
            else {
              if (cwd2 === void 0)
                cwd2 = process.cwd();
              path2 = cwd2;
            }
            assertPath(path2);
            if (path2.length === 0) {
              continue;
            }
            resolvedPath = path2 + "/" + resolvedPath;
            resolvedAbsolute = path2.charCodeAt(0) === 47;
          }
          resolvedPath = normalizeStringPosix(resolvedPath, !resolvedAbsolute);
          if (resolvedAbsolute) {
            if (resolvedPath.length > 0)
              return "/" + resolvedPath;
            else
              return "/";
          } else if (resolvedPath.length > 0) {
            return resolvedPath;
          } else {
            return ".";
          }
        },
        normalize: function normalize(path2) {
          assertPath(path2);
          if (path2.length === 0) return ".";
          var isAbsolute = path2.charCodeAt(0) === 47;
          var trailingSeparator = path2.charCodeAt(path2.length - 1) === 47;
          path2 = normalizeStringPosix(path2, !isAbsolute);
          if (path2.length === 0 && !isAbsolute) path2 = ".";
          if (path2.length > 0 && trailingSeparator) path2 += "/";
          if (isAbsolute) return "/" + path2;
          return path2;
        },
        isAbsolute: function isAbsolute(path2) {
          assertPath(path2);
          return path2.length > 0 && path2.charCodeAt(0) === 47;
        },
        join: function join() {
          if (arguments.length === 0)
            return ".";
          var joined;
          for (var i = 0; i < arguments.length; ++i) {
            var arg = arguments[i];
            assertPath(arg);
            if (arg.length > 0) {
              if (joined === void 0)
                joined = arg;
              else
                joined += "/" + arg;
            }
          }
          if (joined === void 0)
            return ".";
          return posix.normalize(joined);
        },
        relative: function relative(from, to) {
          assertPath(from);
          assertPath(to);
          if (from === to) return "";
          from = posix.resolve(from);
          to = posix.resolve(to);
          if (from === to) return "";
          var fromStart = 1;
          for (; fromStart < from.length; ++fromStart) {
            if (from.charCodeAt(fromStart) !== 47)
              break;
          }
          var fromEnd = from.length;
          var fromLen = fromEnd - fromStart;
          var toStart = 1;
          for (; toStart < to.length; ++toStart) {
            if (to.charCodeAt(toStart) !== 47)
              break;
          }
          var toEnd = to.length;
          var toLen = toEnd - toStart;
          var length = fromLen < toLen ? fromLen : toLen;
          var lastCommonSep = -1;
          var i = 0;
          for (; i <= length; ++i) {
            if (i === length) {
              if (toLen > length) {
                if (to.charCodeAt(toStart + i) === 47) {
                  return to.slice(toStart + i + 1);
                } else if (i === 0) {
                  return to.slice(toStart + i);
                }
              } else if (fromLen > length) {
                if (from.charCodeAt(fromStart + i) === 47) {
                  lastCommonSep = i;
                } else if (i === 0) {
                  lastCommonSep = 0;
                }
              }
              break;
            }
            var fromCode = from.charCodeAt(fromStart + i);
            var toCode = to.charCodeAt(toStart + i);
            if (fromCode !== toCode)
              break;
            else if (fromCode === 47)
              lastCommonSep = i;
          }
          var out = "";
          for (i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i) {
            if (i === fromEnd || from.charCodeAt(i) === 47) {
              if (out.length === 0)
                out += "..";
              else
                out += "/..";
            }
          }
          if (out.length > 0)
            return out + to.slice(toStart + lastCommonSep);
          else {
            toStart += lastCommonSep;
            if (to.charCodeAt(toStart) === 47)
              ++toStart;
            return to.slice(toStart);
          }
        },
        _makeLong: function _makeLong(path2) {
          return path2;
        },
        dirname: function dirname(path2) {
          assertPath(path2);
          if (path2.length === 0) return ".";
          var code = path2.charCodeAt(0);
          var hasRoot = code === 47;
          var end = -1;
          var matchedSlash = true;
          for (var i = path2.length - 1; i >= 1; --i) {
            code = path2.charCodeAt(i);
            if (code === 47) {
              if (!matchedSlash) {
                end = i;
                break;
              }
            } else {
              matchedSlash = false;
            }
          }
          if (end === -1) return hasRoot ? "/" : ".";
          if (hasRoot && end === 1) return "//";
          return path2.slice(0, end);
        },
        basename: function basename(path2, ext) {
          if (ext !== void 0 && typeof ext !== "string") throw new TypeError('"ext" argument must be a string');
          assertPath(path2);
          var start = 0;
          var end = -1;
          var matchedSlash = true;
          var i;
          if (ext !== void 0 && ext.length > 0 && ext.length <= path2.length) {
            if (ext.length === path2.length && ext === path2) return "";
            var extIdx = ext.length - 1;
            var firstNonSlashEnd = -1;
            for (i = path2.length - 1; i >= 0; --i) {
              var code = path2.charCodeAt(i);
              if (code === 47) {
                if (!matchedSlash) {
                  start = i + 1;
                  break;
                }
              } else {
                if (firstNonSlashEnd === -1) {
                  matchedSlash = false;
                  firstNonSlashEnd = i + 1;
                }
                if (extIdx >= 0) {
                  if (code === ext.charCodeAt(extIdx)) {
                    if (--extIdx === -1) {
                      end = i;
                    }
                  } else {
                    extIdx = -1;
                    end = firstNonSlashEnd;
                  }
                }
              }
            }
            if (start === end) end = firstNonSlashEnd;
            else if (end === -1) end = path2.length;
            return path2.slice(start, end);
          } else {
            for (i = path2.length - 1; i >= 0; --i) {
              if (path2.charCodeAt(i) === 47) {
                if (!matchedSlash) {
                  start = i + 1;
                  break;
                }
              } else if (end === -1) {
                matchedSlash = false;
                end = i + 1;
              }
            }
            if (end === -1) return "";
            return path2.slice(start, end);
          }
        },
        extname: function extname(path2) {
          assertPath(path2);
          var startDot = -1;
          var startPart = 0;
          var end = -1;
          var matchedSlash = true;
          var preDotState = 0;
          for (var i = path2.length - 1; i >= 0; --i) {
            var code = path2.charCodeAt(i);
            if (code === 47) {
              if (!matchedSlash) {
                startPart = i + 1;
                break;
              }
              continue;
            }
            if (end === -1) {
              matchedSlash = false;
              end = i + 1;
            }
            if (code === 46) {
              if (startDot === -1)
                startDot = i;
              else if (preDotState !== 1)
                preDotState = 1;
            } else if (startDot !== -1) {
              preDotState = -1;
            }
          }
          if (startDot === -1 || end === -1 || // We saw a non-dot character immediately before the dot
          preDotState === 0 || // The (right-most) trimmed path component is exactly '..'
          preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
            return "";
          }
          return path2.slice(startDot, end);
        },
        format: function format2(pathObject) {
          if (pathObject === null || typeof pathObject !== "object") {
            throw new TypeError('The "pathObject" argument must be of type Object. Received type ' + typeof pathObject);
          }
          return _format("/", pathObject);
        },
        parse: function parse2(path2) {
          assertPath(path2);
          var ret = { root: "", dir: "", base: "", ext: "", name: "" };
          if (path2.length === 0) return ret;
          var code = path2.charCodeAt(0);
          var isAbsolute = code === 47;
          var start;
          if (isAbsolute) {
            ret.root = "/";
            start = 1;
          } else {
            start = 0;
          }
          var startDot = -1;
          var startPart = 0;
          var end = -1;
          var matchedSlash = true;
          var i = path2.length - 1;
          var preDotState = 0;
          for (; i >= start; --i) {
            code = path2.charCodeAt(i);
            if (code === 47) {
              if (!matchedSlash) {
                startPart = i + 1;
                break;
              }
              continue;
            }
            if (end === -1) {
              matchedSlash = false;
              end = i + 1;
            }
            if (code === 46) {
              if (startDot === -1) startDot = i;
              else if (preDotState !== 1) preDotState = 1;
            } else if (startDot !== -1) {
              preDotState = -1;
            }
          }
          if (startDot === -1 || end === -1 || // We saw a non-dot character immediately before the dot
          preDotState === 0 || // The (right-most) trimmed path component is exactly '..'
          preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
            if (end !== -1) {
              if (startPart === 0 && isAbsolute) ret.base = ret.name = path2.slice(1, end);
              else ret.base = ret.name = path2.slice(startPart, end);
            }
          } else {
            if (startPart === 0 && isAbsolute) {
              ret.name = path2.slice(1, startDot);
              ret.base = path2.slice(1, end);
            } else {
              ret.name = path2.slice(startPart, startDot);
              ret.base = path2.slice(startPart, end);
            }
            ret.ext = path2.slice(startDot, end);
          }
          if (startPart > 0) ret.dir = path2.slice(0, startPart - 1);
          else if (isAbsolute) ret.dir = "/";
          return ret;
        },
        sep: "/",
        delimiter: ":",
        win32: null,
        posix: null
      };
      posix.posix = posix;
      module.exports = posix;
    }
  });

  // node_modules/@jsonjoy.com/fs-node-builtins/lib/path.js
  var require_path = __commonJS({
    "node_modules/@jsonjoy.com/fs-node-builtins/lib/path.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.basename = exports.isAbsolute = exports.normalize = exports.dirname = exports.relative = exports.join = exports.posix = exports.sep = exports.resolve = void 0;
      var node_path_1 = require_path_browserify();
      Object.defineProperty(exports, "resolve", { enumerable: true, get: function() {
        return node_path_1.resolve;
      } });
      Object.defineProperty(exports, "sep", { enumerable: true, get: function() {
        return node_path_1.sep;
      } });
      Object.defineProperty(exports, "posix", { enumerable: true, get: function() {
        return node_path_1.posix;
      } });
      Object.defineProperty(exports, "join", { enumerable: true, get: function() {
        return node_path_1.join;
      } });
      Object.defineProperty(exports, "relative", { enumerable: true, get: function() {
        return node_path_1.relative;
      } });
      Object.defineProperty(exports, "dirname", { enumerable: true, get: function() {
        return node_path_1.dirname;
      } });
      Object.defineProperty(exports, "normalize", { enumerable: true, get: function() {
        return node_path_1.normalize;
      } });
      Object.defineProperty(exports, "isAbsolute", { enumerable: true, get: function() {
        return node_path_1.isAbsolute;
      } });
      Object.defineProperty(exports, "basename", { enumerable: true, get: function() {
        return node_path_1.basename;
      } });
    }
  });

  // node_modules/@jsonjoy.com/fs-core/lib/types.js
  var require_types = __commonJS({
    "node_modules/@jsonjoy.com/fs-core/lib/types.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
    }
  });

  // node_modules/@jsonjoy.com/fs-node-builtins/lib/buffer.js
  var require_buffer2 = __commonJS({
    "node_modules/@jsonjoy.com/fs-node-builtins/lib/buffer.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Buffer = void 0;
      var node_buffer_1 = require_buffer();
      Object.defineProperty(exports, "Buffer", { enumerable: true, get: function() {
        return node_buffer_1.Buffer;
      } });
    }
  });

  // node_modules/@jsonjoy.com/fs-node-builtins/lib/internal/buffer.js
  var require_buffer3 = __commonJS({
    "node_modules/@jsonjoy.com/fs-node-builtins/lib/internal/buffer.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.bufferFrom = exports.bufferAllocUnsafe = exports.Buffer = void 0;
      var buffer_1 = require_buffer2();
      Object.defineProperty(exports, "Buffer", { enumerable: true, get: function() {
        return buffer_1.Buffer;
      } });
      function bufferV0P12Ponyfill(arg0, ...args) {
        return new buffer_1.Buffer(arg0, ...args);
      }
      var bufferAllocUnsafe = buffer_1.Buffer.allocUnsafe || bufferV0P12Ponyfill;
      exports.bufferAllocUnsafe = bufferAllocUnsafe;
      var bufferFrom = buffer_1.Buffer.from || bufferV0P12Ponyfill;
      exports.bufferFrom = bufferFrom;
    }
  });

  // node_modules/@jsonjoy.com/fs-node-utils/lib/types/index.js
  var require_types2 = __commonJS({
    "node_modules/@jsonjoy.com/fs-node-utils/lib/types/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
    }
  });

  // node_modules/@jsonjoy.com/fs-node-utils/lib/constants.js
  var require_constants = __commonJS({
    "node_modules/@jsonjoy.com/fs-node-utils/lib/constants.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.FLAGS = exports.ERRSTR = exports.constants = exports.SEP = void 0;
      exports.SEP = "/";
      exports.constants = {
        O_RDONLY: 0,
        O_WRONLY: 1,
        O_RDWR: 2,
        S_IFMT: 61440,
        S_IFREG: 32768,
        S_IFDIR: 16384,
        S_IFCHR: 8192,
        S_IFBLK: 24576,
        S_IFIFO: 4096,
        S_IFLNK: 40960,
        S_IFSOCK: 49152,
        O_CREAT: 64,
        O_EXCL: 128,
        O_NOCTTY: 256,
        O_TRUNC: 512,
        O_APPEND: 1024,
        O_DIRECTORY: 65536,
        O_NOATIME: 262144,
        O_NOFOLLOW: 131072,
        O_SYNC: 1052672,
        O_SYMLINK: 2097152,
        O_DIRECT: 16384,
        O_NONBLOCK: 2048,
        S_IRWXU: 448,
        S_IRUSR: 256,
        S_IWUSR: 128,
        S_IXUSR: 64,
        S_IRWXG: 56,
        S_IRGRP: 32,
        S_IWGRP: 16,
        S_IXGRP: 8,
        S_IRWXO: 7,
        S_IROTH: 4,
        S_IWOTH: 2,
        S_IXOTH: 1,
        F_OK: 0,
        R_OK: 4,
        W_OK: 2,
        X_OK: 1,
        UV_FS_SYMLINK_DIR: 1,
        UV_FS_SYMLINK_JUNCTION: 2,
        UV_FS_COPYFILE_EXCL: 1,
        UV_FS_COPYFILE_FICLONE: 2,
        UV_FS_COPYFILE_FICLONE_FORCE: 4,
        COPYFILE_EXCL: 1,
        COPYFILE_FICLONE: 2,
        COPYFILE_FICLONE_FORCE: 4
      };
      exports.ERRSTR = {
        PATH_STR: "path must be a string, Buffer, or Uint8Array",
        // FD:             'file descriptor must be a unsigned 32-bit integer',
        FD: "fd must be a file descriptor",
        MODE_INT: "mode must be an int",
        CB: "callback must be a function",
        UID: "uid must be an unsigned int",
        GID: "gid must be an unsigned int",
        LEN: "len must be an integer",
        ATIME: "atime must be an integer",
        MTIME: "mtime must be an integer",
        PREFIX: "filename prefix is required",
        BUFFER: "buffer must be an instance of Buffer or StaticBuffer",
        OFFSET: "offset must be an integer",
        LENGTH: "length must be an integer",
        POSITION: "position must be an integer"
      };
      var { O_RDONLY, O_WRONLY, O_RDWR, O_CREAT, O_EXCL, O_TRUNC, O_APPEND, O_SYNC } = exports.constants;
      var FLAGS;
      (function(FLAGS2) {
        FLAGS2[FLAGS2["r"] = O_RDONLY] = "r";
        FLAGS2[FLAGS2["r+"] = O_RDWR] = "r+";
        FLAGS2[FLAGS2["rs"] = O_RDONLY | O_SYNC] = "rs";
        FLAGS2[FLAGS2["sr"] = FLAGS2.rs] = "sr";
        FLAGS2[FLAGS2["rs+"] = O_RDWR | O_SYNC] = "rs+";
        FLAGS2[FLAGS2["sr+"] = FLAGS2["rs+"]] = "sr+";
        FLAGS2[FLAGS2["w"] = O_WRONLY | O_CREAT | O_TRUNC] = "w";
        FLAGS2[FLAGS2["wx"] = O_WRONLY | O_CREAT | O_TRUNC | O_EXCL] = "wx";
        FLAGS2[FLAGS2["xw"] = FLAGS2.wx] = "xw";
        FLAGS2[FLAGS2["w+"] = O_RDWR | O_CREAT | O_TRUNC] = "w+";
        FLAGS2[FLAGS2["wx+"] = O_RDWR | O_CREAT | O_TRUNC | O_EXCL] = "wx+";
        FLAGS2[FLAGS2["xw+"] = FLAGS2["wx+"]] = "xw+";
        FLAGS2[FLAGS2["a"] = O_WRONLY | O_APPEND | O_CREAT] = "a";
        FLAGS2[FLAGS2["ax"] = O_WRONLY | O_APPEND | O_CREAT | O_EXCL] = "ax";
        FLAGS2[FLAGS2["xa"] = FLAGS2.ax] = "xa";
        FLAGS2[FLAGS2["a+"] = O_RDWR | O_APPEND | O_CREAT] = "a+";
        FLAGS2[FLAGS2["ax+"] = O_RDWR | O_APPEND | O_CREAT | O_EXCL] = "ax+";
        FLAGS2[FLAGS2["xa+"] = FLAGS2["ax+"]] = "xa+";
      })(FLAGS || (exports.FLAGS = FLAGS = {}));
    }
  });

  // node_modules/@jsonjoy.com/fs-node-utils/lib/consts/AMODE.js
  var require_AMODE = __commonJS({
    "node_modules/@jsonjoy.com/fs-node-utils/lib/consts/AMODE.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
    }
  });

  // node_modules/@jsonjoy.com/fs-node-utils/lib/consts/FLAG.js
  var require_FLAG = __commonJS({
    "node_modules/@jsonjoy.com/fs-node-utils/lib/consts/FLAG.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.FLAG = void 0;
      var FLAG;
      (function(FLAG2) {
        FLAG2[FLAG2["O_RDONLY"] = 0] = "O_RDONLY";
        FLAG2[FLAG2["O_WRONLY"] = 1] = "O_WRONLY";
        FLAG2[FLAG2["O_RDWR"] = 2] = "O_RDWR";
        FLAG2[FLAG2["O_ACCMODE"] = 3] = "O_ACCMODE";
        FLAG2[FLAG2["O_CREAT"] = 64] = "O_CREAT";
        FLAG2[FLAG2["O_EXCL"] = 128] = "O_EXCL";
        FLAG2[FLAG2["O_NOCTTY"] = 256] = "O_NOCTTY";
        FLAG2[FLAG2["O_TRUNC"] = 512] = "O_TRUNC";
        FLAG2[FLAG2["O_APPEND"] = 1024] = "O_APPEND";
        FLAG2[FLAG2["O_NONBLOCK"] = 2048] = "O_NONBLOCK";
        FLAG2[FLAG2["O_DSYNC"] = 4096] = "O_DSYNC";
        FLAG2[FLAG2["FASYNC"] = 8192] = "FASYNC";
        FLAG2[FLAG2["O_DIRECT"] = 16384] = "O_DIRECT";
        FLAG2[FLAG2["O_LARGEFILE"] = 0] = "O_LARGEFILE";
        FLAG2[FLAG2["O_DIRECTORY"] = 65536] = "O_DIRECTORY";
        FLAG2[FLAG2["O_NOFOLLOW"] = 131072] = "O_NOFOLLOW";
        FLAG2[FLAG2["O_NOATIME"] = 262144] = "O_NOATIME";
        FLAG2[FLAG2["O_CLOEXEC"] = 524288] = "O_CLOEXEC";
        FLAG2[FLAG2["O_SYNC"] = 1052672] = "O_SYNC";
        FLAG2[FLAG2["O_NDELAY"] = 2048] = "O_NDELAY";
      })(FLAG || (exports.FLAG = FLAG = {}));
    }
  });

  // node_modules/@jsonjoy.com/fs-node-utils/lib/path.js
  var require_path2 = __commonJS({
    "node_modules/@jsonjoy.com/fs-node-utils/lib/path.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.basename = exports.pathNormalize = exports.pathDirname = exports.pathRelative = exports.pathJoin = exports.pathSep = void 0;
      var path_1 = require_path();
      exports.pathSep = path_1.posix ? path_1.posix.sep : path_1.sep;
      exports.pathJoin = path_1.posix ? path_1.posix.join : path_1.join;
      exports.pathRelative = path_1.posix ? path_1.posix.relative : path_1.relative;
      exports.pathDirname = path_1.posix ? path_1.posix.dirname : path_1.dirname;
      exports.pathNormalize = path_1.posix ? path_1.posix.normalize : path_1.normalize;
      var basename = (path2, separator) => {
        if (path2[path2.length - 1] === separator)
          path2 = path2.slice(0, -1);
        const lastSlashIndex = path2.lastIndexOf(separator);
        return lastSlashIndex === -1 ? path2 : path2.slice(lastSlashIndex + 1);
      };
      exports.basename = basename;
    }
  });

  // node_modules/@jsonjoy.com/fs-node-utils/lib/inspectPrimitive.js
  var require_inspectPrimitive = __commonJS({
    "node_modules/@jsonjoy.com/fs-node-utils/lib/inspectPrimitive.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.addNumericalSeparator = exports.formatPrimitive = exports.formatNumber = exports.quoteString = exports.escapeString = void 0;
      var MAX_STRING_LENGTH = 1e4;
      var META = [];
      for (let i = 0; i < 160; i++)
        META.push(i < 32 || i > 126 ? "\\x" + (i < 16 ? "0" : "") + i.toString(16).toUpperCase() : "");
      META[8] = "\\b";
      META[9] = "\\t";
      META[10] = "\\n";
      META[12] = "\\f";
      META[13] = "\\r";
      META[39] = "\\'";
      META[92] = "\\\\";
      var escapeString = (str, quote) => {
        let result = "";
        let last = 0;
        const length = str.length;
        for (let i = 0; i < length; i++) {
          const point = str.charCodeAt(i);
          if (point === quote || point === 92 || point < 32 || point > 126 && point < 160) {
            result += str.slice(last, i) + META[point];
            last = i + 1;
          } else if (point >= 55296 && point <= 57343) {
            if (point <= 56319 && i + 1 < length) {
              const next = str.charCodeAt(i + 1);
              if (next >= 56320 && next <= 57343) {
                i++;
                continue;
              }
            }
            result += str.slice(last, i) + "\\u" + point.toString(16);
            last = i + 1;
          }
        }
        return last === 0 ? str : result + str.slice(last);
      };
      exports.escapeString = escapeString;
      var quoteString = (str) => {
        if (str.indexOf("'") === -1)
          return "'" + (0, exports.escapeString)(str, 39) + "'";
        if (str.indexOf('"') === -1)
          return '"' + (0, exports.escapeString)(str, -1) + '"';
        if (str.indexOf("`") === -1 && str.indexOf("${") === -1)
          return "`" + (0, exports.escapeString)(str, -1) + "`";
        return "'" + (0, exports.escapeString)(str, 39) + "'";
      };
      exports.quoteString = quoteString;
      var formatString = (value, indentation) => {
        let trailer = "";
        if (value.length > MAX_STRING_LENGTH) {
          const remaining = value.length - MAX_STRING_LENGTH;
          value = value.slice(0, MAX_STRING_LENGTH);
          trailer = "... " + remaining + " more character" + (remaining > 1 ? "s" : "");
        }
        const length = value.length;
        if (length <= 16 || length <= 76 - indentation)
          return (0, exports.quoteString)(value) + trailer;
        const separator = " +\n" + " ".repeat(indentation + 2);
        let out = "";
        let start = 0;
        let end = value.indexOf("\n");
        while (end !== -1 && end + 1 < length) {
          out += (0, exports.quoteString)(value.slice(start, end + 1)) + separator;
          start = end + 1;
          end = value.indexOf("\n", start);
        }
        return out + (0, exports.quoteString)(value.slice(start)) + trailer;
      };
      var formatNumber = (value) => Object.is(value, -0) ? "-0" : "" + value;
      exports.formatNumber = formatNumber;
      var formatPrimitive = (value, indentation) => {
        switch (typeof value) {
          case "string":
            return formatString(value, indentation);
          case "number":
            return (0, exports.formatNumber)(value);
          case "bigint":
            return value + "n";
          case "symbol":
            return value.toString();
          default:
            return "" + value;
        }
      };
      exports.formatPrimitive = formatPrimitive;
      var addNumericalSeparator = (val) => {
        let res = "";
        let i = val.length;
        const start = val.charCodeAt(0) === 45 ? 1 : 0;
        for (; i >= start + 4; i -= 3)
          res = "_" + val.slice(i - 3, i) + res;
        return val.slice(0, i) + res;
      };
      exports.addNumericalSeparator = addNumericalSeparator;
    }
  });

  // node_modules/@jsonjoy.com/fs-node-utils/lib/inspectLayout.js
  var require_inspectLayout = __commonJS({
    "node_modules/@jsonjoy.com/fs-node-utils/lib/inspectLayout.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.reduceToSingleString = exports.MAX_ARRAY_LENGTH = exports.BREAK_LENGTH = void 0;
      exports.BREAK_LENGTH = 80;
      exports.MAX_ARRAY_LENGTH = 100;
      var MAX_COLUMNS = 12;
      var join = (output, separator) => {
        let str = "";
        const length = output.length;
        for (let i = 0; i < length; i++)
          str += (i ? separator : "") + output[i];
        return str;
      };
      var groupArrayElements = (ctx, output, value) => {
        let totalLength = 0;
        let maxLength = 0;
        let outputLength = output.length;
        if (exports.MAX_ARRAY_LENGTH < output.length)
          outputLength--;
        const dataLen = [];
        for (let i = 0; i < outputLength; i++) {
          const len = output[i].length;
          dataLen.push(len);
          totalLength += len + 2;
          if (maxLength < len)
            maxLength = len;
        }
        const actualMax = maxLength + 2;
        if (actualMax * 3 + ctx.indentationLvl >= exports.BREAK_LENGTH || totalLength / actualMax <= 5 && maxLength > 6)
          return output;
        const averageBias = Math.sqrt(actualMax - totalLength / output.length);
        const biasedMax = Math.max(actualMax - 3 - averageBias, 1);
        const columns = Math.min(Math.round(Math.sqrt(2.5 * biasedMax * outputLength) / biasedMax), Math.floor((exports.BREAK_LENGTH - ctx.indentationLvl) / actualMax), MAX_COLUMNS);
        if (columns <= 1)
          return output;
        const maxLineLength = [];
        for (let i = 0; i < columns; i++) {
          let lineMaxLength = 0;
          for (let j = i; j < output.length; j += columns)
            if (dataLen[j] > lineMaxLength)
              lineMaxLength = dataLen[j];
          maxLineLength.push(lineMaxLength + 2);
        }
        let padStart = value !== void 0;
        for (let i = 0; padStart && i < output.length; i++)
          if (typeof value[i] !== "number" && typeof value[i] !== "bigint")
            padStart = false;
        const grouped = [];
        for (let i = 0; i < outputLength; i += columns) {
          const max = Math.min(i + columns, outputLength);
          let str = "";
          let j = i;
          for (; j < max - 1; j++) {
            const cell = output[j] + ", ";
            str += padStart ? cell.padStart(maxLineLength[j - i], " ") : cell.padEnd(maxLineLength[j - i], " ");
          }
          str += padStart ? output[j].padStart(maxLineLength[j - i] - 2, " ") : output[j];
          grouped.push(str);
        }
        if (exports.MAX_ARRAY_LENGTH < output.length)
          grouped.push(output[outputLength]);
        return grouped;
      };
      var isBelowBreakLength = (output, start, base2) => {
        let totalLength = output.length + start;
        if (totalLength + output.length > exports.BREAK_LENGTH)
          return false;
        for (let i = 0; i < output.length; i++) {
          totalLength += output[i].length;
          if (totalLength > exports.BREAK_LENGTH)
            return false;
        }
        return base2 === "" || base2.indexOf("\n") === -1;
      };
      var reduceToSingleString = (ctx, output, base2, braces, kind, recurseTimes, value) => {
        const entries = output.length;
        if (kind === 2 && entries > 6)
          output = groupArrayElements(ctx, output, value);
        const head = base2 ? base2 + " " + braces[0] : braces[0];
        if (ctx.currentDepth - recurseTimes < 3 && entries === output.length) {
          const start = output.length + ctx.indentationLvl + braces[0].length + base2.length + 10;
          if (isBelowBreakLength(output, start, base2)) {
            const joined = join(output, ", ");
            if (joined.indexOf("\n") === -1)
              return head + " " + joined + " " + braces[1];
          }
        }
        const indentation = "\n" + " ".repeat(ctx.indentationLvl);
        return head + indentation + "  " + join(output, "," + indentation + "  ") + indentation + braces[1];
      };
      exports.reduceToSingleString = reduceToSingleString;
    }
  });

  // node_modules/@jsonjoy.com/fs-node-utils/lib/inspectBrand.js
  var require_inspectBrand = __commonJS({
    "node_modules/@jsonjoy.com/fs-node-utils/lib/inspectBrand.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.boxedBase = exports.functionBase = exports.classBase = exports.hexBytes = exports.moreItems = exports.isIndex = exports.nonIndexKeys = exports.ownKeys = exports.prefixOf = exports.constructorName = exports.isInstance = exports.hasBrand = exports.regExpSource = exports.dataViewBuffer = exports.sharedArrayBufferByteLength = exports.arrayBufferByteLength = exports.mapSize = exports.setSize = exports.typedArrayLength = exports.typedArrayTag = exports.getOwn = exports.isEnumerable = exports.hasOwn = exports.objectToString = void 0;
      var inspectPrimitive_1 = require_inspectPrimitive();
      var INDEX_REG = /^(0|[1-9][0-9]*)$/;
      exports.objectToString = Object.prototype.toString;
      exports.hasOwn = Object.prototype.hasOwnProperty;
      exports.isEnumerable = Object.prototype.propertyIsEnumerable;
      exports.getOwn = Object.getOwnPropertyDescriptor;
      var getter = (proto, key) => (0, exports.getOwn)(proto, key).get;
      var TypedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
      exports.typedArrayTag = getter(TypedArrayPrototype, Symbol.toStringTag);
      exports.typedArrayLength = getter(TypedArrayPrototype, "length");
      exports.setSize = getter(Set.prototype, "size");
      exports.mapSize = getter(Map.prototype, "size");
      exports.arrayBufferByteLength = getter(ArrayBuffer.prototype, "byteLength");
      exports.sharedArrayBufferByteLength = typeof SharedArrayBuffer === "undefined" ? void 0 : getter(SharedArrayBuffer.prototype, "byteLength");
      exports.dataViewBuffer = getter(DataView.prototype, "buffer");
      exports.regExpSource = getter(RegExp.prototype, "source");
      var hasBrand = (check, value) => {
        try {
          check.call(value);
          return true;
        } catch {
          return false;
        }
      };
      exports.hasBrand = hasBrand;
      var isInstance = (value, ctor) => {
        try {
          return value instanceof ctor;
        } catch {
          return false;
        }
      };
      exports.isInstance = isInstance;
      var constructorName = (value) => {
        let obj = value;
        let first;
        while (obj) {
          const descriptor = (0, exports.getOwn)(obj, "constructor");
          const ctor = descriptor && descriptor.value;
          if (typeof ctor === "function" && ctor.name !== "" && (0, exports.isInstance)(value, ctor))
            return String(ctor.name);
          obj = Object.getPrototypeOf(obj);
          if (first === void 0)
            first = obj;
        }
        return first === null ? null : "Object";
      };
      exports.constructorName = constructorName;
      var prefixOf = (constructor, tag, fallback, size = "") => {
        if (constructor === null) {
          if (tag !== "" && fallback !== tag)
            return "[" + fallback + size + ": null prototype] [" + tag + "] ";
          return "[" + fallback + size + ": null prototype] ";
        }
        let result = constructor + size + " ";
        if (tag !== "") {
          const position = constructor.indexOf(tag);
          if (position === -1)
            result += "[" + tag + "] ";
          else {
            const end = position + tag.length;
            if (end !== constructor.length && constructor[end] === constructor[end].toLowerCase())
              result += "[" + tag + "] ";
          }
        }
        return result;
      };
      exports.prefixOf = prefixOf;
      var ownKeys2 = (value) => {
        const keys = Object.keys(value);
        const symbols = Object.getOwnPropertySymbols(value);
        for (let i = 0; i < symbols.length; i++)
          if (exports.isEnumerable.call(value, symbols[i]))
            keys.push(symbols[i]);
        return keys;
      };
      exports.ownKeys = ownKeys2;
      var nonIndexKeys = (value) => {
        const keys = (0, exports.ownKeys)(value);
        const out = [];
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          if (typeof key !== "string" || !INDEX_REG.test(key) || +key > 4294967294)
            out.push(key);
        }
        return out;
      };
      exports.nonIndexKeys = nonIndexKeys;
      var isIndex = (key) => INDEX_REG.test(key);
      exports.isIndex = isIndex;
      var moreItems = (remaining) => "... " + remaining + " more item" + (remaining > 1 ? "s" : "");
      exports.moreItems = moreItems;
      var hexBytes = (bytes, max) => {
        const length = bytes.length;
        const shown = length > max ? max : length;
        let str = "";
        for (let i = 0; i < shown; i++)
          str += (i ? " " : "") + (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
        const remaining = length - shown;
        return remaining > 0 ? str + " ... " + remaining + " more byte" + (remaining > 1 ? "s" : "") : str;
      };
      exports.hexBytes = hexBytes;
      var classBase = (value, constructor, tag) => {
        const name = exports.hasOwn.call(value, "name") && value.name || "(anonymous)";
        let base2 = "class " + name;
        if (constructor !== "Function" && constructor !== null)
          base2 += " [" + constructor + "]";
        if (tag !== "" && constructor !== tag)
          base2 += " [" + tag + "]";
        if (constructor === null)
          base2 += " extends [null prototype]";
        else {
          const superName = Object.getPrototypeOf(value).name;
          if (superName)
            base2 += " extends " + superName;
        }
        return "[" + base2 + "]";
      };
      exports.classBase = classBase;
      var CLASS_REG = /^(\s+[^(]*?)\s*{/;
      var COMMENTS_REG = /(\/\/.*?\n)|(\/\*(.|\n)*?\*\/)/g;
      var BOXED = {
        "[object Number]": Number.prototype.valueOf,
        "[object String]": String.prototype.valueOf,
        "[object Boolean]": Boolean.prototype.valueOf,
        "[object BigInt]": BigInt.prototype.valueOf,
        "[object Symbol]": Symbol.prototype.valueOf
      };
      var functionBase = (value, constructor, tag, formatName) => {
        const source = Function.prototype.toString.call(value);
        if (source.startsWith("class") && source.endsWith("}")) {
          const slice = source.slice(5, -1);
          const bracket = slice.indexOf("{");
          if (bracket !== -1 && (slice.slice(0, bracket).indexOf("(") === -1 || CLASS_REG.test(slice.replace(COMMENTS_REG, ""))))
            return (0, exports.classBase)(value, constructor, tag);
        }
        const brand = exports.objectToString.call(value);
        let type = brand.indexOf("GeneratorFunction") === -1 ? "Function" : "GeneratorFunction";
        if (brand.indexOf("Async") !== -1)
          type = "Async" + type;
        let base2 = "[" + type;
        if (constructor === null)
          base2 += " (null prototype)";
        const name = value.name;
        base2 += name === "" ? " (anonymous)" : ": " + (typeof name === "string" ? name : formatName(name));
        base2 += "]";
        if (constructor !== type && constructor !== null)
          base2 += " " + constructor;
        if (tag !== "" && constructor !== tag)
          base2 += " [" + tag + "]";
        return base2;
      };
      exports.functionBase = functionBase;
      var boxedBase = (value, keys, constructor, tag, indentation) => {
        const brand = exports.objectToString.call(value);
        const valueOf = BOXED[brand];
        if (valueOf === void 0)
          return;
        let primitive;
        try {
          primitive = valueOf.call(value);
        } catch {
          return;
        }
        const type = brand.slice(8, -1);
        if (type === "String")
          keys.splice(0, primitive.length);
        let base2 = "[" + type;
        if (type !== constructor)
          base2 += constructor === null ? " (null prototype)" : " (" + constructor + ")";
        base2 += ": " + (0, inspectPrimitive_1.formatPrimitive)(primitive, indentation) + "]";
        if (tag !== "" && tag !== constructor)
          base2 += " [" + tag + "]";
        return base2;
      };
      exports.boxedBase = boxedBase;
    }
  });

  // node_modules/@jsonjoy.com/fs-node-utils/lib/inspect.js
  var require_inspect = __commonJS({
    "node_modules/@jsonjoy.com/fs-node-utils/lib/inspect.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.inspect = void 0;
      var buffer_1 = require_buffer3();
      var inspectPrimitive_1 = require_inspectPrimitive();
      var inspectLayout_1 = require_inspectLayout();
      var inspectBrand_1 = require_inspectBrand();
      var INSPECT_MAX_BYTES = 50;
      var KEY_REG = /^[a-zA-Z_][a-zA-Z_0-9]*$/;
      var formatProperty = (ctx, value, recurseTimes, key, kind, desc) => {
        const descriptor = desc || (0, inspectBrand_1.getOwn)(value, key);
        let str;
        if (descriptor.value !== void 0) {
          ctx.indentationLvl += 2;
          str = formatValue(ctx, descriptor.value, recurseTimes);
          ctx.indentationLvl -= 2;
        } else if (descriptor.get !== void 0)
          str = descriptor.set !== void 0 ? "[Getter/Setter]" : "[Getter]";
        else
          str = descriptor.set !== void 0 ? "[Setter]" : "undefined";
        if (kind === 1)
          return str;
        let name;
        if (typeof key === "symbol")
          name = (0, inspectPrimitive_1.escapeString)(key.toString(), 39);
        else if (KEY_REG.test("" + key))
          name = key === "__proto__" ? "['__proto__']" : "" + key;
        else
          name = (0, inspectPrimitive_1.quoteString)("" + key);
        if (descriptor.enumerable === false)
          name = "[" + name + "]";
        return name + ": " + str;
      };
      var formatExtra = (ctx, value, recurseTimes, key) => {
        let item;
        ctx.indentationLvl += 2;
        try {
          item = value[key];
        } catch {
          ctx.indentationLvl += 2;
          item = value.buffer[key];
        }
        const str = formatValue(ctx, item, recurseTimes);
        ctx.indentationLvl -= 2;
        return "[" + key + "]: " + str;
      };
      var formatSparseArray = (ctx, value, recurseTimes, maxLength, output, i) => {
        const keys = Object.keys(value);
        let index = i;
        for (; i < keys.length && output.length < maxLength; i++) {
          const key = keys[i];
          const tmp = +key;
          if (tmp > 4294967294)
            break;
          if ("" + index !== key) {
            if (!(0, inspectBrand_1.isIndex)(key))
              break;
            const empty = tmp - index;
            output.push("<" + empty + " empty item" + (empty > 1 ? "s" : "") + ">");
            index = tmp;
            if (output.length === maxLength)
              break;
          }
          output.push(formatProperty(
            ctx,
            value,
            recurseTimes,
            key,
            1
            /* Kind.ArrayItem */
          ));
          index++;
        }
        const remaining = value.length - index;
        if (output.length !== maxLength) {
          if (remaining > 0)
            output.push("<" + remaining + " empty item" + (remaining > 1 ? "s" : "") + ">");
        } else if (remaining > 0)
          output.push((0, inspectBrand_1.moreItems)(remaining));
        return output;
      };
      var formatArray = (ctx, value, recurseTimes) => {
        const length = value.length;
        const max = length < inspectLayout_1.MAX_ARRAY_LENGTH ? length : inspectLayout_1.MAX_ARRAY_LENGTH;
        const output = [];
        for (let i = 0; i < max; i++) {
          const desc = (0, inspectBrand_1.getOwn)(value, i);
          if (desc === void 0)
            return formatSparseArray(ctx, value, recurseTimes, max, output, i);
          output.push(formatProperty(ctx, value, recurseTimes, i, 1, desc));
        }
        if (length > max)
          output.push((0, inspectBrand_1.moreItems)(length - max));
        return output;
      };
      var formatTypedArray = (ctx, value) => {
        const length = inspectBrand_1.typedArrayLength.call(value);
        const max = length < inspectLayout_1.MAX_ARRAY_LENGTH ? length : inspectLayout_1.MAX_ARRAY_LENGTH;
        const output = [];
        const bigint = length > 0 && typeof value[0] !== "number";
        for (let i = 0; i < max; i++)
          output.push(bigint ? value[i] + "n" : (0, inspectPrimitive_1.formatNumber)(value[i]));
        if (length > max)
          output.push((0, inspectBrand_1.moreItems)(length - max));
        return output;
      };
      var formatSet = (ctx, value, recurseTimes) => {
        const length = inspectBrand_1.setSize.call(value);
        const max = length < inspectLayout_1.MAX_ARRAY_LENGTH ? length : inspectLayout_1.MAX_ARRAY_LENGTH;
        const output = [];
        const iterator = Set.prototype.values.call(value);
        ctx.indentationLvl += 2;
        for (let entry = iterator.next(); !entry.done && output.length < max; entry = iterator.next())
          output.push(formatValue(ctx, entry.value, recurseTimes));
        if (length > max)
          output.push((0, inspectBrand_1.moreItems)(length - max));
        ctx.indentationLvl -= 2;
        return output;
      };
      var formatMap = (ctx, value, recurseTimes) => {
        const length = inspectBrand_1.mapSize.call(value);
        const max = length < inspectLayout_1.MAX_ARRAY_LENGTH ? length : inspectLayout_1.MAX_ARRAY_LENGTH;
        const output = [];
        const iterator = Map.prototype.entries.call(value);
        ctx.indentationLvl += 2;
        for (let entry = iterator.next(); !entry.done && output.length < max; entry = iterator.next())
          output.push(formatValue(ctx, entry.value[0], recurseTimes) + " => " + formatValue(ctx, entry.value[1], recurseTimes));
        if (length > max)
          output.push((0, inspectBrand_1.moreItems)(length - max));
        ctx.indentationLvl -= 2;
        return output;
      };
      var formatArrayBuffer = (ctx, value) => {
        let bytes;
        try {
          bytes = new Uint8Array(value);
        } catch {
          return ["(detached)"];
        }
        return ["[Uint8Contents]: <" + (0, inspectBrand_1.hexBytes)(bytes, inspectLayout_1.MAX_ARRAY_LENGTH) + ">"];
      };
      var noEntries = () => [];
      var formatRaw = (ctx, value, recurseTimes) => {
        const constructor = (0, inspectBrand_1.constructorName)(value);
        let rawTag = "";
        try {
          rawTag = value[Symbol.toStringTag];
        } catch {
        }
        const tag = typeof rawTag !== "string" || rawTag !== "" && inspectBrand_1.isEnumerable.call(value, Symbol.toStringTag) ? "" : rawTag;
        let keys;
        let base2 = "";
        let braces = ["{", "}"];
        let formatter = noEntries;
        let kind = 0;
        let fallback = "Object";
        let extraKeys;
        if (Symbol.iterator in value || constructor === null) {
          let typed;
          if (Array.isArray(value)) {
            fallback = "Array";
            keys = (0, inspectBrand_1.nonIndexKeys)(value);
            const prefix = constructor !== "Array" || tag !== "" ? (0, inspectBrand_1.prefixOf)(constructor, tag, "Array", "(" + value.length + ")") : "";
            braces = [prefix + "[", "]"];
            if (value.length === 0 && keys.length === 0)
              return braces[0] + "]";
            kind = 2;
            formatter = formatArray;
          } else if ((0, inspectBrand_1.hasBrand)(inspectBrand_1.setSize, value) || (0, inspectBrand_1.hasBrand)(inspectBrand_1.mapSize, value)) {
            const isSet = (0, inspectBrand_1.hasBrand)(inspectBrand_1.setSize, value);
            const size = isSet ? inspectBrand_1.setSize.call(value) : inspectBrand_1.mapSize.call(value);
            fallback = isSet ? "Set" : "Map";
            keys = (0, inspectBrand_1.ownKeys)(value);
            const prefix = (0, inspectBrand_1.prefixOf)(constructor, tag, fallback, "(" + size + ")");
            if (size === 0 && keys.length === 0)
              return prefix + "{}";
            braces = [prefix + "{", "}"];
            formatter = isSet ? formatSet : formatMap;
          } else if ((typed = inspectBrand_1.typedArrayTag.call(value)) !== void 0) {
            fallback = typed;
            keys = (0, inspectBrand_1.nonIndexKeys)(value);
            const length = inspectBrand_1.typedArrayLength.call(value);
            const prefix = (0, inspectBrand_1.prefixOf)(constructor, tag, constructor === null ? typed : "", "(" + length + ")");
            braces = [prefix + "[", "]"];
            if (length === 0 && keys.length === 0)
              return braces[0] + "]";
            kind = 2;
            formatter = formatTypedArray;
          }
        }
        if (keys === void 0) {
          keys = (0, inspectBrand_1.ownKeys)(value);
          if (typeof value === "function") {
            fallback = "Function";
            base2 = (0, inspectBrand_1.functionBase)(value, constructor, tag, (name) => formatValue(ctx, name, 0));
            if (keys.length === 0)
              return base2;
          } else if (constructor === "Object") {
            if (inspectBrand_1.objectToString.call(value) === "[object Arguments]" && inspectBrand_1.hasOwn.call(value, "callee"))
              braces[0] = "[Arguments] {";
            else if (tag !== "")
              braces[0] = (0, inspectBrand_1.prefixOf)(constructor, tag, "Object") + "{";
            if (keys.length === 0)
              return braces[0] + "}";
          } else if ((0, inspectBrand_1.hasBrand)(inspectBrand_1.regExpSource, value)) {
            fallback = "RegExp";
            const prefix = (0, inspectBrand_1.prefixOf)(constructor, tag, "RegExp");
            base2 = RegExp.prototype.toString.call(constructor === null ? new RegExp(value) : value);
            if (prefix !== "RegExp ")
              base2 = prefix + base2;
            if (keys.length === 0 || recurseTimes > ctx.depth)
              return base2;
          } else if ((0, inspectBrand_1.hasBrand)(Date.prototype.getTime, value)) {
            fallback = "Date";
            const prefix = (0, inspectBrand_1.prefixOf)(constructor, tag, "Date");
            const time = Date.prototype.getTime.call(value);
            base2 = time !== time ? Date.prototype.toString.call(value) : Date.prototype.toISOString.call(value);
            if (prefix !== "Date ")
              base2 = prefix + base2;
            if (keys.length === 0)
              return base2;
          } else if (inspectBrand_1.objectToString.call(value) === "[object Error]" || (0, inspectBrand_1.isInstance)(value, Error)) {
            fallback = "Error";
            const stack = value.stack;
            base2 = typeof stack === "string" && stack !== "" ? stack.replace(/\n/g, "\n" + " ".repeat(ctx.indentationLvl)) : "[" + Error.prototype.toString.call(value) + "]";
            if (keys.length === 0)
              return base2;
          } else if ((0, inspectBrand_1.hasBrand)(inspectBrand_1.arrayBufferByteLength, value) || inspectBrand_1.sharedArrayBufferByteLength !== void 0 && (0, inspectBrand_1.hasBrand)(inspectBrand_1.sharedArrayBufferByteLength, value)) {
            fallback = (0, inspectBrand_1.hasBrand)(inspectBrand_1.arrayBufferByteLength, value) ? "ArrayBuffer" : "SharedArrayBuffer";
            braces[0] = (0, inspectBrand_1.prefixOf)(constructor, tag, fallback) + "{";
            formatter = formatArrayBuffer;
            extraKeys = ["byteLength"];
          } else if ((0, inspectBrand_1.hasBrand)(inspectBrand_1.dataViewBuffer, value)) {
            fallback = "DataView";
            braces[0] = (0, inspectBrand_1.prefixOf)(constructor, tag, "DataView") + "{";
            extraKeys = ["byteLength", "byteOffset", "buffer"];
          } else {
            const boxed = (0, inspectBrand_1.boxedBase)(value, keys, constructor, tag, ctx.indentationLvl);
            if (boxed !== void 0) {
              base2 = boxed;
              if (keys.length === 0)
                return base2;
            } else {
              const style = (0, inspectBrand_1.prefixOf)(constructor, tag, constructor === null ? "Object" : "");
              if (keys.length === 0)
                return style + "{}";
              braces[0] = style + "{";
            }
          }
        }
        if (recurseTimes > ctx.depth) {
          const name = (0, inspectBrand_1.prefixOf)(constructor, tag, constructor === null ? fallback === tag ? "Object" : fallback : "").slice(0, -1);
          return constructor === null ? name : "[" + name + "]";
        }
        recurseTimes++;
        ctx.seen.push(value);
        ctx.currentDepth = recurseTimes;
        const output = formatter(ctx, value, recurseTimes);
        if (extraKeys !== void 0)
          for (let i = 0; i < extraKeys.length; i++)
            output.push(formatExtra(ctx, value, recurseTimes, extraKeys[i]));
        for (let i = 0; i < keys.length; i++)
          output.push(formatProperty(ctx, value, recurseTimes, keys[i], kind));
        const index = ctx.circular === void 0 ? void 0 : ctx.circular.get(value);
        if (index !== void 0)
          base2 = base2 === "" ? "<ref *" + index + ">" : "<ref *" + index + "> " + base2;
        ctx.seen.pop();
        return (0, inspectLayout_1.reduceToSingleString)(ctx, output, base2, braces, kind, recurseTimes, value);
      };
      var formatValue = (ctx, value, recurseTimes) => {
        if (typeof value !== "object" && typeof value !== "function")
          return (0, inspectPrimitive_1.formatPrimitive)(value, ctx.indentationLvl);
        if (value === null)
          return "null";
        if (buffer_1.Buffer.isBuffer(value))
          return "<" + value.constructor.name + " " + (0, inspectBrand_1.hexBytes)(value, INSPECT_MAX_BYTES) + ">";
        if (ctx.seen.indexOf(value) !== -1) {
          let circular = ctx.circular;
          if (circular === void 0)
            ctx.circular = circular = /* @__PURE__ */ new Map();
          let index = circular.get(value);
          if (index === void 0) {
            index = circular.size + 1;
            circular.set(value, index);
          }
          return "[Circular *" + index + "]";
        }
        return formatRaw(ctx, value, recurseTimes);
      };
      var inspect = (value, depth = 2) => formatValue({ depth, indentationLvl: 0, currentDepth: 0, seen: [], circular: void 0 }, value, 0);
      exports.inspect = inspect;
    }
  });

  // node_modules/@jsonjoy.com/fs-node-utils/lib/argErrors.js
  var require_argErrors = __commonJS({
    "node_modules/@jsonjoy.com/fs-node-utils/lib/argErrors.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.invalidUrlScheme = exports.methodNotImplemented = exports.invalidThis = exports.outOfRange = exports.invalidArgValue = exports.invalidArgType = exports.withNativeCode = exports.withCode = void 0;
      var inspect_1 = require_inspect();
      var inspectPrimitive_1 = require_inspectPrimitive();
      var TWO_POW_32 = 4294967296;
      var BIG_TWO_POW_32 = BigInt(TWO_POW_32);
      var withCode = (error, code) => {
        error.code = code;
        const tagged = error.name + " [" + code + "]";
        Object.defineProperty(error, "name", { value: tagged, enumerable: false, writable: true, configurable: true });
        void error.stack;
        delete error.name;
        Object.defineProperty(error, "toString", {
          value: function() {
            return tagged + ": " + this.message;
          },
          enumerable: false,
          writable: true,
          configurable: true
        });
        return error;
      };
      exports.withCode = withCode;
      var withNativeCode = (error, code) => {
        error.code = code;
        return error;
      };
      exports.withNativeCode = withNativeCode;
      var kindOf = (name) => name.indexOf(".") === -1 ? "argument" : "property";
      var describeType = (value) => {
        if (value === null)
          return "null";
        if (value === void 0)
          return "undefined";
        switch (typeof value) {
          case "bigint":
            return "type bigint (" + value + "n)";
          case "number":
            return "type number (" + (0, inspectPrimitive_1.formatNumber)(value) + ")";
          case "boolean":
            return "type boolean (" + value + ")";
          case "symbol":
            return "type symbol (" + value.toString() + ")";
          case "function":
            return "function " + value.name;
          case "string": {
            const str = value.length > 28 ? value.slice(0, 25) + "..." : value;
            return str.indexOf("'") === -1 ? "type string ('" + str + "')" : "type string (" + JSON.stringify(str) + ")";
          }
        }
        const ctor = value.constructor;
        return ctor && "name" in ctor ? "an instance of " + ctor.name : (0, inspect_1.inspect)(value, -1);
      };
      var describeNativeType = (value) => {
        switch (typeof value) {
          case "bigint":
            return "type bigint (" + value + ")";
          case "symbol":
            return value.toString();
          case "function":
            return "function";
          case "object": {
            if (value === null)
              break;
            const ctor = value.constructor;
            return "an instance of " + (ctor && ctor.name || "Object");
          }
        }
        return describeType(value);
      };
      var invalidArgType = (name, expected, actual, native) => {
        const head = name.endsWith(" argument") ? "The " + name + " " : 'The "' + name + '" ' + kindOf(name) + " ";
        const received = native ? describeNativeType(actual) : describeType(actual);
        const error = new TypeError(head + "must be " + expected + ". Received " + received);
        return native ? (0, exports.withNativeCode)(error, "ERR_INVALID_ARG_TYPE") : (0, exports.withCode)(error, "ERR_INVALID_ARG_TYPE");
      };
      exports.invalidArgType = invalidArgType;
      var invalidArgValue = (name, value, reason = "is invalid") => {
        let inspected = (0, inspect_1.inspect)(value);
        if (inspected.length > 128)
          inspected = inspected.slice(0, 128) + "...";
        return (0, exports.withCode)(new TypeError("The " + kindOf(name) + " '" + name + "' " + reason + ". Received " + inspected), "ERR_INVALID_ARG_VALUE");
      };
      exports.invalidArgValue = invalidArgValue;
      var outOfRange = (name, range, value, native) => {
        const message = 'The value of "' + name + '" is out of range. It must be ' + range + ". Received ";
        if (native)
          return (0, exports.withNativeCode)(new RangeError(message + String(value)), "ERR_OUT_OF_RANGE");
        let received;
        if (Number.isInteger(value) && Math.abs(value) > TWO_POW_32)
          received = (0, inspectPrimitive_1.addNumericalSeparator)("" + value);
        else if (typeof value === "bigint") {
          received = "" + value;
          if (value > BIG_TWO_POW_32 || value < -BIG_TWO_POW_32)
            received = (0, inspectPrimitive_1.addNumericalSeparator)(received);
          received += "n";
        } else
          received = (0, inspect_1.inspect)(value);
        return (0, exports.withCode)(new RangeError(message + received), "ERR_OUT_OF_RANGE");
      };
      exports.outOfRange = outOfRange;
      var invalidThis = (type) => (0, exports.withCode)(new TypeError('Value of "this" must be of type ' + type), "ERR_INVALID_THIS");
      exports.invalidThis = invalidThis;
      var methodNotImplemented = (method) => (0, exports.withCode)(new Error("The " + method + " method is not implemented"), "ERR_METHOD_NOT_IMPLEMENTED");
      exports.methodNotImplemented = methodNotImplemented;
      var invalidUrlScheme = (expected) => (0, exports.withCode)(new TypeError("The URL must be of scheme " + expected), "ERR_INVALID_URL_SCHEME");
      exports.invalidUrlScheme = invalidUrlScheme;
    }
  });

  // node_modules/@jsonjoy.com/fs-node-utils/lib/encoding.js
  var require_encoding = __commonJS({
    "node_modules/@jsonjoy.com/fs-node-utils/lib/encoding.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.ENCODING_UTF8 = void 0;
      exports.assertEncoding = assertEncoding;
      exports.strToEncoding = strToEncoding;
      var buffer_1 = require_buffer3();
      var argErrors_1 = require_argErrors();
      exports.ENCODING_UTF8 = "utf8";
      function assertEncoding(encoding) {
        if (encoding && !buffer_1.Buffer.isEncoding(encoding))
          throw (0, argErrors_1.invalidArgValue)("encoding", encoding, "is invalid encoding");
      }
      function strToEncoding(str, encoding) {
        if (!encoding || encoding === exports.ENCODING_UTF8)
          return str;
        if (encoding === "buffer")
          return new buffer_1.Buffer(str);
        return new buffer_1.Buffer(str).toString(encoding);
      }
    }
  });

  // node_modules/glob-to-regex.js/lib/index.js
  var require_lib = __commonJS({
    "node_modules/glob-to-regex.js/lib/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.toMatcher = exports.toRegex = exports.expandBraces = void 0;
      var NODOT = "(?!\\.)";
      var STAR = "[^/]*";
      var GLOBSTAR_NODOT = "[^/]*(?:/(?!\\.)[^/]*)*";
      var literal = (pattern, i, code) => {
        switch (code) {
          case 36:
          case 42:
          case 63:
          case 91:
          case 40:
          case 41:
          case 43:
          case 46:
          case 92:
          case 93:
          case 94:
          case 123:
          case 124:
          case 125:
            return "\\" + pattern[i];
          default:
            return pattern[i];
        }
      };
      var posixClass = (name) => {
        switch (name) {
          case "alnum":
            return "0-9A-Za-z";
          case "alpha":
            return "A-Za-z";
          case "ascii":
            return "\\x00-\\x7f";
          case "blank":
            return " \\t";
          case "cntrl":
            return "\\x00-\\x1f\\x7f";
          case "digit":
            return "0-9";
          case "graph":
            return "\\x21-\\x7e";
          case "lower":
            return "a-z";
          case "print":
            return "\\x20-\\x7e";
          case "punct":
            return "\\x21-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\x7e";
          case "space":
            return " \\t\\r\\n\\v\\f";
          case "upper":
            return "A-Z";
          case "word":
            return "0-9A-Za-z_";
          case "xdigit":
            return "0-9A-Fa-f";
        }
        return;
      };
      var classEnd = (pattern, i) => {
        const length = pattern.length;
        let j = i + 1;
        const first = pattern.charCodeAt(j);
        if (first === 33 || first === 94)
          j++;
        if (pattern.charCodeAt(j) === 93)
          j++;
        for (; j < length; j++) {
          const code = pattern.charCodeAt(j);
          if (code === 93)
            return j + 1;
          if (code === 91 && pattern.charCodeAt(j + 1) === 58) {
            const close = pattern.indexOf(":]", j + 2);
            if (close > 0)
              j = close + 1;
          }
        }
        return -1;
      };
      var member = (pattern, i) => {
        const code = pattern.charCodeAt(i);
        const special = code === 93 || code === 92 || code === 91 || code === 94 || code === 45;
        return (special ? "\\" : "") + pattern[i];
      };
      var classSource = (pattern, i, end) => {
        const last = end - 1;
        let j = i + 1;
        let out = "";
        let members = 0;
        const first = pattern.charCodeAt(j);
        const negate = first === 33 || first === 94;
        if (negate)
          j++;
        while (j < last) {
          if (pattern.charCodeAt(j) === 91 && pattern.charCodeAt(j + 1) === 58) {
            const close = pattern.indexOf(":]", j + 2);
            const cls = close > 0 ? posixClass(pattern.slice(j + 2, close)) : void 0;
            if (cls !== void 0) {
              out += cls;
              members += 2;
              j = close + 2;
              continue;
            }
          }
          if (pattern.charCodeAt(j + 1) === 45 && j + 2 < last) {
            if (pattern.charCodeAt(j + 2) >= pattern.charCodeAt(j)) {
              out += member(pattern, j) + "-" + member(pattern, j + 2);
              members += 2;
            }
            j += 3;
            continue;
          }
          out += member(pattern, j);
          members++;
          j++;
        }
        if (!negate && members === 1)
          return literal(pattern, last - 1, pattern.charCodeAt(last - 1));
        if (!members)
          return negate ? "[^/]" : "[]";
        return (negate ? "[^" : "[") + out + "]";
      };
      var groupEnd = (pattern, i) => {
        const length = pattern.length;
        let depth = 1;
        for (; i < length; i++) {
          const code = pattern.charCodeAt(i);
          if (code === 91) {
            const end = classEnd(pattern, i);
            if (end > 0)
              i = end - 1;
          } else if (code === 40)
            depth++;
          else if (code === 41 && !--depth)
            return i + 1;
        }
        return -1;
      };
      var splitAlts = (body) => {
        const length = body.length;
        const alts = [];
        let depth = 0;
        let from = 0;
        for (let i = 0; i < length; i++) {
          const code = body.charCodeAt(i);
          if (code === 91) {
            const end = classEnd(body, i);
            if (end > 0)
              i = end - 1;
          } else if (code === 40)
            depth++;
          else if (code === 41)
            depth--;
          else if (code === 124 && !depth) {
            alts.push(body.slice(from, i));
            from = i + 1;
          }
        }
        alts.push(body.slice(from));
        return alts;
      };
      var isExtglobPrefix = (code) => code === 63 || code === 42 || code === 43 || code === 64 || code === 33;
      var altsSource = (alts, extglob, nodot, tail, segStart) => {
        let out = "";
        for (let i = 0; i < alts.length; i++)
          out += (i ? "|" : "") + compile(alts[i], extglob, nodot, tail, segStart);
        return out;
      };
      var extglobSource = (type, alts, extglob, nodot, tail, segStart) => {
        const guard = nodot && segStart ? NODOT : "";
        const body = altsSource(alts, extglob, nodot, tail, segStart);
        switch (type) {
          case 63:
            return "(?:" + body + ")?";
          case 64:
            return "(?:" + body + ")";
          case 33:
            if (alts.length === 1 && !alts[0])
              return guard + "[^/]+";
            return "(?!(?:" + body + ")" + tail + "$)" + guard + STAR;
        }
        const more = guard ? altsSource(alts, extglob, nodot, tail, false) : body;
        if (more === body)
          return "(?:" + body + ")" + (type === 42 ? "*" : "+");
        const once2 = "(?:" + body + ")(?:" + more + ")*";
        return type === 42 ? "(?:" + once2 + ")?" : once2;
      };
      var compile = (pattern, extglob, nodot, tail, segStart) => {
        const length = pattern.length;
        let out = "";
        let i = 0;
        let start = segStart;
        while (i < length) {
          const code = pattern.charCodeAt(i);
          if (extglob && pattern.charCodeAt(i + 1) === 40 && isExtglobPrefix(code)) {
            const end = groupEnd(pattern, i + 2);
            if (end > 0) {
              const after = compile(pattern.slice(end), extglob, nodot, tail, false);
              const alts = splitAlts(pattern.slice(i + 2, end - 1));
              return out + extglobSource(code, alts, extglob, nodot, after + tail, start) + after;
            }
          }
          const atStart = start;
          const guard = nodot && atStart ? NODOT : "";
          start = false;
          switch (code) {
            case 42: {
              let j = i + 1;
              while (pattern.charCodeAt(j) === 42)
                j++;
              if (j === i + 1) {
                const whole = atStart && (j === length || pattern.charCodeAt(j) === 47);
                out += guard + (whole ? "[^/]+" : STAR);
                i = j;
                break;
              }
              let slash = pattern.charCodeAt(j) === 47;
              while (slash) {
                let k = j + 1;
                if (pattern.charCodeAt(k) !== 42 || pattern.charCodeAt(k + 1) !== 42)
                  break;
                k += 2;
                while (pattern.charCodeAt(k) === 42)
                  k++;
                if (k === length) {
                  j = k;
                  slash = false;
                } else if (pattern.charCodeAt(k) === 47)
                  j = k;
                else
                  break;
              }
              if (slash) {
                out += nodot ? "(?:" + guard + GLOBSTAR_NODOT + "/)?" : "(?:.*/)?";
                j++;
                start = true;
              } else
                out += nodot ? guard + GLOBSTAR_NODOT : ".*";
              i = j;
              break;
            }
            case 63:
              out += guard + "[^/]";
              i++;
              break;
            case 91: {
              const end = classEnd(pattern, i);
              if (end < 0) {
                out += "\\[";
                i++;
                break;
              }
              const cls = classSource(pattern, i, end);
              out += (cls.charCodeAt(0) === 91 ? guard : "") + cls;
              i = end;
              break;
            }
            case 47:
              out += "/";
              i++;
              start = true;
              break;
            default:
              out += literal(pattern, i, code);
              i++;
          }
        }
        return out;
      };
      var closingBrace = (pattern, open) => {
        const length = pattern.length;
        let depth = 0;
        for (let i = open; i < length; i++) {
          const code = pattern.charCodeAt(i);
          if (code === 123)
            depth++;
          else if (code === 125 && !--depth)
            return i;
        }
        return -1;
      };
      var commaSplit = (body) => {
        const length = body.length;
        const parts = [];
        let depth = 0;
        let from = 0;
        for (let i = 0; i < length; i++) {
          const code = body.charCodeAt(i);
          if (code === 123)
            depth++;
          else if (code === 125)
            depth--;
          else if (code === 44 && !depth) {
            parts.push(body.slice(from, i));
            from = i + 1;
          }
        }
        if (!parts.length)
          return;
        parts.push(body.slice(from));
        return parts;
      };
      var NUMERIC_RANGE = /^(-?\d+)\.\.(-?\d+)(?:\.\.(-?\d+))?$/;
      var ALPHA_RANGE = /^([a-zA-Z])\.\.([a-zA-Z])(?:\.\.(-?\d+))?$/;
      var PADDED = /^-?0\d/;
      var rangeOf = (body, max) => {
        let match = NUMERIC_RANGE.exec(body);
        const alpha = !match;
        if (alpha)
          match = ALPHA_RANGE.exec(body);
        if (!match)
          return;
        const from = alpha ? match[1].charCodeAt(0) : +match[1];
        const to = alpha ? match[2].charCodeAt(0) : +match[2];
        const step = match[3] === void 0 ? 1 : Math.abs(+match[3]) || 1;
        const width = !alpha && (PADDED.test(match[1]) || PADDED.test(match[2])) ? Math.max(match[1].length, match[2].length) : 0;
        const out = [];
        const dir = from <= to ? step : -step;
        for (let n = from; (dir > 0 ? n <= to : n >= to) && out.length < max; n += dir) {
          if (alpha) {
            out.push(String.fromCharCode(n));
            continue;
          }
          let s = String(n);
          const need = width - s.length;
          if (need > 0) {
            let zeros = "";
            for (let k = 0; k < need; k++)
              zeros += "0";
            s = n < 0 ? "-" + zeros + s.slice(1) : zeros + s;
          }
          out.push(s);
        }
        return out;
      };
      var expandInto = (pattern, out, max) => {
        for (let open = pattern.indexOf("{"); open >= 0; open = pattern.indexOf("{", open + 1)) {
          const close = closingBrace(pattern, open);
          if (close < 0)
            continue;
          const body = pattern.slice(open + 1, close);
          const alts = commaSplit(body) || rangeOf(body, max);
          if (!alts)
            continue;
          const prefix = pattern.slice(0, open);
          const suffixes = (0, exports.expandBraces)(pattern.slice(close + 1), max);
          for (let i = 0; i < alts.length; i++) {
            const heads = (0, exports.expandBraces)(alts[i], max);
            for (let j = 0; j < heads.length; j++) {
              const head = prefix + heads[j];
              for (let k = 0; k < suffixes.length; k++) {
                if (out.length >= max)
                  return;
                out.push(head + suffixes[k]);
              }
            }
          }
          return;
        }
        out.push(pattern);
      };
      var expandBraces = (pattern, max = 1e5) => {
        const out = [];
        expandInto(pattern, out, max);
        return out;
      };
      exports.expandBraces = expandBraces;
      var toRegex = (pattern, options) => {
        const extglob = !!options?.extglob;
        const nodot = options?.dot === false;
        let source;
        if (pattern.indexOf("{") < 0)
          source = compile(pattern, extglob, nodot, "", true);
        else {
          const set = (0, exports.expandBraces)(pattern);
          const length = set.length;
          if (length === 1)
            source = compile(set[0], extglob, nodot, "", true);
          else {
            const seen = /* @__PURE__ */ new Set();
            source = "(?:";
            for (let i = 0; i < length; i++) {
              const one = set[i];
              if (seen.has(one))
                continue;
              if (seen.size)
                source += "|";
              seen.add(one);
              source += compile(one, extglob, nodot, "", true);
            }
            source += ")";
          }
        }
        return new RegExp("^" + source + "$", options?.nocase ? "i" : "");
      };
      exports.toRegex = toRegex;
      var isRegExp = /^\/(.{1,4096})\/([gimsuy]{0,6})$/;
      var toMatcher = (pattern, options) => {
        const regexes = [];
        const patterns = Array.isArray(pattern) ? pattern : [pattern];
        for (const pat of patterns) {
          if (typeof pat === "string") {
            const match = isRegExp.exec(pat);
            if (match) {
              const [, expr, flags] = match;
              regexes.push(new RegExp(expr, flags));
            } else {
              regexes.push((0, exports.toRegex)(pat, options));
            }
          } else {
            regexes.push(pat);
          }
        }
        return regexes.length ? new Function("p", "return " + regexes.map((r) => r + ".test(p)").join("||")) : () => false;
      };
      exports.toMatcher = toMatcher;
    }
  });

  // node_modules/@jsonjoy.com/fs-node-utils/lib/watchIgnore.js
  var require_watchIgnore = __commonJS({
    "node_modules/@jsonjoy.com/fs-node-utils/lib/watchIgnore.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.watchIgnoreToMatcher = exports.watchIgnorePatternToMatcher = void 0;
      var glob_to_regex_js_1 = require_lib();
      var watchIgnorePatternToMatcher = (pattern) => {
        if (typeof pattern === "function")
          return pattern;
        if (pattern instanceof RegExp)
          return (filename) => pattern.test(filename);
        if (typeof pattern === "string") {
          const regex = (0, glob_to_regex_js_1.toRegex)(pattern);
          return (filename) => regex.test(filename);
        }
        throw new TypeError(`The "options.ignore" property must be of type string, RegExp, function, or an array thereof. Received ${typeof pattern}`);
      };
      exports.watchIgnorePatternToMatcher = watchIgnorePatternToMatcher;
      var watchIgnoreToMatcher = (ignore) => {
        if (Array.isArray(ignore)) {
          const matchers = ignore.map(exports.watchIgnorePatternToMatcher);
          return (filename) => matchers.some((matcher) => matcher(filename));
        }
        return (0, exports.watchIgnorePatternToMatcher)(ignore);
      };
      exports.watchIgnoreToMatcher = watchIgnoreToMatcher;
    }
  });

  // node_modules/@jsonjoy.com/fs-node-utils/lib/lists/fsCallbackApiList.js
  var require_fsCallbackApiList = __commonJS({
    "node_modules/@jsonjoy.com/fs-node-utils/lib/lists/fsCallbackApiList.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.fsCallbackApiList = void 0;
      exports.fsCallbackApiList = [
        "access",
        "appendFile",
        "chmod",
        "chown",
        "close",
        "copyFile",
        "cp",
        "createReadStream",
        "createWriteStream",
        "exists",
        "fchmod",
        "fchown",
        "fdatasync",
        "fstat",
        "fsync",
        "ftruncate",
        "futimes",
        "glob",
        "lchmod",
        "lchown",
        "link",
        "lstat",
        "mkdir",
        "mkdtemp",
        "open",
        "openAsBlob",
        "opendir",
        "read",
        "readv",
        "readdir",
        "readFile",
        "readlink",
        "realpath",
        "rename",
        "rm",
        "rmdir",
        "stat",
        "statfs",
        "symlink",
        "truncate",
        "unlink",
        "unwatchFile",
        "utimes",
        "lutimes",
        "watch",
        "watchFile",
        "write",
        "writev",
        "writeFile"
      ];
    }
  });

  // node_modules/@jsonjoy.com/fs-node-utils/lib/lists/fsSynchronousApiList.js
  var require_fsSynchronousApiList = __commonJS({
    "node_modules/@jsonjoy.com/fs-node-utils/lib/lists/fsSynchronousApiList.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.fsSynchronousApiList = void 0;
      exports.fsSynchronousApiList = [
        "accessSync",
        "appendFileSync",
        "chmodSync",
        "chownSync",
        "closeSync",
        "copyFileSync",
        "cpSync",
        "existsSync",
        "fchmodSync",
        "fchownSync",
        "fdatasyncSync",
        "fstatSync",
        "fsyncSync",
        "ftruncateSync",
        "futimesSync",
        "globSync",
        "lchmodSync",
        "lchownSync",
        "linkSync",
        "lstatSync",
        "mkdirSync",
        "mkdtempSync",
        "openSync",
        "opendirSync",
        "readdirSync",
        "readFileSync",
        "readlinkSync",
        "readSync",
        "readvSync",
        "realpathSync",
        "renameSync",
        "rmdirSync",
        "rmSync",
        "statfsSync",
        "statSync",
        "symlinkSync",
        "truncateSync",
        "unlinkSync",
        "utimesSync",
        "lutimesSync",
        "writeFileSync",
        "writeSync",
        "writevSync"
      ];
    }
  });

  // node_modules/@jsonjoy.com/fs-node-utils/lib/lists/fsCommonObjectsList.js
  var require_fsCommonObjectsList = __commonJS({
    "node_modules/@jsonjoy.com/fs-node-utils/lib/lists/fsCommonObjectsList.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.fsCommonObjectsList = void 0;
      exports.fsCommonObjectsList = [
        "F_OK",
        "R_OK",
        "W_OK",
        "X_OK",
        "constants",
        "Stats",
        "StatFs",
        "Dir",
        "Dirent",
        "StatWatcher",
        "FSWatcher",
        "ReadStream",
        "WriteStream"
      ];
    }
  });

  // node_modules/@jsonjoy.com/fs-node-utils/lib/index.js
  var require_lib2 = __commonJS({
    "node_modules/@jsonjoy.com/fs-node-utils/lib/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.fsCommonObjectsList = exports.fsSynchronousApiList = exports.fsCallbackApiList = void 0;
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_types2(), exports);
      tslib_1.__exportStar(require_constants(), exports);
      tslib_1.__exportStar(require_AMODE(), exports);
      tslib_1.__exportStar(require_FLAG(), exports);
      tslib_1.__exportStar(require_path2(), exports);
      tslib_1.__exportStar(require_encoding(), exports);
      tslib_1.__exportStar(require_watchIgnore(), exports);
      var fsCallbackApiList_1 = require_fsCallbackApiList();
      Object.defineProperty(exports, "fsCallbackApiList", { enumerable: true, get: function() {
        return fsCallbackApiList_1.fsCallbackApiList;
      } });
      var fsSynchronousApiList_1 = require_fsSynchronousApiList();
      Object.defineProperty(exports, "fsSynchronousApiList", { enumerable: true, get: function() {
        return fsSynchronousApiList_1.fsSynchronousApiList;
      } });
      var fsCommonObjectsList_1 = require_fsCommonObjectsList();
      Object.defineProperty(exports, "fsCommonObjectsList", { enumerable: true, get: function() {
        return fsCommonObjectsList_1.fsCommonObjectsList;
      } });
    }
  });

  // node_modules/@jsonjoy.com/fs-core/lib/json.js
  var require_json = __commonJS({
    "node_modules/@jsonjoy.com/fs-core/lib/json.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.flattenJSON = void 0;
      var buffer_1 = require_buffer3();
      var fs_node_utils_1 = require_lib2();
      var flattenJSON = (nestedJSON) => {
        const flatJSON = {};
        function flatten(pathPrefix, node) {
          for (const path2 in node) {
            const contentOrNode = node[path2];
            const joinedPath = (0, fs_node_utils_1.pathJoin)(pathPrefix, path2);
            if (typeof contentOrNode === "string" || contentOrNode instanceof buffer_1.Buffer) {
              flatJSON[joinedPath] = contentOrNode;
            } else if (typeof contentOrNode === "object" && contentOrNode !== null && !(contentOrNode instanceof buffer_1.Buffer) && Object.keys(contentOrNode).length > 0) {
              flatten(joinedPath, contentOrNode);
            } else {
              flatJSON[joinedPath] = null;
            }
          }
        }
        flatten("", nestedJSON);
        return flatJSON;
      };
      exports.flattenJSON = flattenJSON;
    }
  });

  // node_modules/@jsonjoy.com/fs-core/lib/constants.js
  var require_constants2 = __commonJS({
    "node_modules/@jsonjoy.com/fs-core/lib/constants.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
    }
  });

  // node_modules/@jsonjoy.com/fs-core/lib/result.js
  var require_result = __commonJS({
    "node_modules/@jsonjoy.com/fs-core/lib/result.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Ok = Ok;
      exports.Err = Err;
      function Ok(value) {
        return { ok: true, value };
      }
      function Err(err) {
        return { ok: false, err };
      }
    }
  });

  // node_modules/thingies/lib/fanout.js
  var require_fanout = __commonJS({
    "node_modules/thingies/lib/fanout.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.FanOut = void 0;
      var FanOut = class {
        constructor() {
          this.listeners = /* @__PURE__ */ new Set();
        }
        emit(data) {
          this.listeners.forEach((listener) => listener(data));
        }
        listen(listener) {
          const listeners2 = this.listeners;
          listeners2.add(listener);
          return () => listeners2.delete(listener);
        }
      };
      exports.FanOut = FanOut;
    }
  });

  // node_modules/node-stdlib-browser/esm/proxy/process.js
  var process_exports = {};
  __export(process_exports, {
    addListener: () => addListener,
    arch: () => arch,
    argv: () => argv,
    binding: () => binding,
    browser: () => browser,
    chdir: () => chdir,
    cwd: () => cwd,
    default: () => api,
    dlopen: () => dlopen,
    emit: () => emit,
    emitWarning: () => emitWarning,
    env: () => env,
    execArgv: () => execArgv,
    execPath: () => execPath,
    exit: () => exit,
    features: () => features,
    kill: () => kill,
    listeners: () => listeners,
    memoryUsage: () => memoryUsage,
    nextTick: () => nextTick,
    off: () => off,
    on: () => on,
    once: () => once,
    pid: () => pid,
    platform: () => platform,
    prependListener: () => prependListener,
    prependOnceListener: () => prependOnceListener,
    removeAllListeners: () => removeAllListeners,
    removeListener: () => removeListener,
    title: () => title,
    umask: () => umask,
    uptime: () => uptime,
    uvCounters: () => uvCounters,
    version: () => version,
    versions: () => versions
  });
  function defaultSetTimout() {
    throw new Error("setTimeout has not been defined");
  }
  function defaultClearTimeout() {
    throw new Error("clearTimeout has not been defined");
  }
  function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
      return setTimeout(fun, 0);
    }
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
      cachedSetTimeout = setTimeout;
      return setTimeout(fun, 0);
    }
    try {
      return cachedSetTimeout(fun, 0);
    } catch (e) {
      try {
        return cachedSetTimeout.call(null, fun, 0);
      } catch (e2) {
        return cachedSetTimeout.call(this, fun, 0);
      }
    }
  }
  function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
      return clearTimeout(marker);
    }
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
      cachedClearTimeout = clearTimeout;
      return clearTimeout(marker);
    }
    try {
      return cachedClearTimeout(marker);
    } catch (e) {
      try {
        return cachedClearTimeout.call(null, marker);
      } catch (e2) {
        return cachedClearTimeout.call(this, marker);
      }
    }
  }
  function cleanUpNextTick() {
    if (!draining || !currentQueue) {
      return;
    }
    draining = false;
    if (currentQueue.length) {
      queue = currentQueue.concat(queue);
    } else {
      queueIndex = -1;
    }
    if (queue.length) {
      drainQueue();
    }
  }
  function drainQueue() {
    if (draining) {
      return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;
    var len = queue.length;
    while (len) {
      currentQueue = queue;
      queue = [];
      while (++queueIndex < len) {
        if (currentQueue) {
          currentQueue[queueIndex].run();
        }
      }
      queueIndex = -1;
      len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
  }
  function Item(fun, array) {
    this.fun = fun;
    this.array = array;
  }
  function noop$1() {
  }
  function noop() {
  }
  var browser$1, process2, cachedSetTimeout, cachedClearTimeout, queue, draining, currentQueue, queueIndex, browser, emitWarning, binding, exit, pid, features, kill, dlopen, uptime, memoryUsage, uvCounters, platform, arch, execPath, execArgv, api, addListener, argv, chdir, cwd, emit, env, listeners, nextTick, off, on, once, prependListener, prependOnceListener, removeAllListeners, removeListener, title, umask, version, versions;
  var init_process = __esm({
    "node_modules/node-stdlib-browser/esm/proxy/process.js"() {
      browser$1 = { exports: {} };
      process2 = browser$1.exports = {};
      (function() {
        try {
          if (typeof setTimeout === "function") {
            cachedSetTimeout = setTimeout;
          } else {
            cachedSetTimeout = defaultSetTimout;
          }
        } catch (e) {
          cachedSetTimeout = defaultSetTimout;
        }
        try {
          if (typeof clearTimeout === "function") {
            cachedClearTimeout = clearTimeout;
          } else {
            cachedClearTimeout = defaultClearTimeout;
          }
        } catch (e) {
          cachedClearTimeout = defaultClearTimeout;
        }
      })();
      queue = [];
      draining = false;
      queueIndex = -1;
      process2.nextTick = function(fun) {
        var args = new Array(arguments.length - 1);
        if (arguments.length > 1) {
          for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
          }
        }
        queue.push(new Item(fun, args));
        if (queue.length === 1 && !draining) {
          runTimeout(drainQueue);
        }
      };
      Item.prototype.run = function() {
        this.fun.apply(null, this.array);
      };
      process2.title = "browser";
      process2.browser = true;
      process2.env = {};
      process2.argv = [];
      process2.version = "";
      process2.versions = {};
      process2.on = noop$1;
      process2.addListener = noop$1;
      process2.once = noop$1;
      process2.off = noop$1;
      process2.removeListener = noop$1;
      process2.removeAllListeners = noop$1;
      process2.emit = noop$1;
      process2.prependListener = noop$1;
      process2.prependOnceListener = noop$1;
      process2.listeners = function(name) {
        return [];
      };
      process2.binding = function(name) {
        throw new Error("process.binding is not supported");
      };
      process2.cwd = function() {
        return "/";
      };
      process2.chdir = function(dir) {
        throw new Error("process.chdir is not supported");
      };
      process2.umask = function() {
        return 0;
      };
      browser = /** @type {boolean} */
      browser$1.exports.browser;
      emitWarning = noop;
      binding = /** @type {Function} */
      browser$1.exports.binding;
      exit = noop;
      pid = 1;
      features = {};
      kill = noop;
      dlopen = noop;
      uptime = noop;
      memoryUsage = noop;
      uvCounters = noop;
      platform = "browser";
      arch = "browser";
      execPath = "browser";
      execArgv = /** @type {string[]} */
      [];
      api = {
        nextTick: browser$1.exports.nextTick,
        title: browser$1.exports.title,
        browser,
        env: browser$1.exports.env,
        argv: browser$1.exports.argv,
        version: browser$1.exports.version,
        versions: browser$1.exports.versions,
        on: browser$1.exports.on,
        addListener: browser$1.exports.addListener,
        once: browser$1.exports.once,
        off: browser$1.exports.off,
        removeListener: browser$1.exports.removeListener,
        removeAllListeners: browser$1.exports.removeAllListeners,
        emit: browser$1.exports.emit,
        emitWarning,
        prependListener: browser$1.exports.prependListener,
        prependOnceListener: browser$1.exports.prependOnceListener,
        listeners: browser$1.exports.listeners,
        binding,
        cwd: browser$1.exports.cwd,
        chdir: browser$1.exports.chdir,
        umask: browser$1.exports.umask,
        exit,
        pid,
        features,
        kill,
        dlopen,
        uptime,
        memoryUsage,
        uvCounters,
        platform,
        arch,
        execPath,
        execArgv
      };
      addListener = browser$1.exports.addListener;
      argv = browser$1.exports.argv;
      chdir = browser$1.exports.chdir;
      cwd = browser$1.exports.cwd;
      emit = browser$1.exports.emit;
      env = browser$1.exports.env;
      listeners = browser$1.exports.listeners;
      nextTick = browser$1.exports.nextTick;
      off = browser$1.exports.off;
      on = browser$1.exports.on;
      once = browser$1.exports.once;
      prependListener = browser$1.exports.prependListener;
      prependOnceListener = browser$1.exports.prependOnceListener;
      removeAllListeners = browser$1.exports.removeAllListeners;
      removeListener = browser$1.exports.removeListener;
      title = browser$1.exports.title;
      umask = browser$1.exports.umask;
      version = browser$1.exports.version;
      versions = browser$1.exports.versions;
    }
  });

  // node_modules/@jsonjoy.com/fs-core/lib/process.js
  var require_process = __commonJS({
    "node_modules/@jsonjoy.com/fs-core/lib/process.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.createProcess = createProcess;
      var maybeReturnProcess = () => {
        if (typeof process !== "undefined") {
          return process;
        }
        try {
          return init_process(), __toCommonJS(process_exports);
        } catch {
          return void 0;
        }
      };
      function createProcess() {
        const p = maybeReturnProcess() || {};
        if (!p.cwd)
          p.cwd = () => "/";
        if (!p.emitWarning)
          p.emitWarning = (message, type) => {
            console.warn(`${type}${type ? ": " : ""}${message}`);
          };
        if (!p.env)
          p.env = {};
        return p;
      }
      exports.default = createProcess();
    }
  });

  // node_modules/@jsonjoy.com/fs-core/lib/Node.js
  var require_Node = __commonJS({
    "node_modules/@jsonjoy.com/fs-core/lib/Node.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Node = void 0;
      var fanout_1 = require_fanout();
      var process_1 = require_process();
      var buffer_1 = require_buffer3();
      var fs_node_utils_1 = require_lib2();
      var { S_IFMT, S_IFDIR, S_IFREG, S_IFLNK, S_IFCHR } = fs_node_utils_1.constants;
      var getuid = () => process_1.default.getuid?.() ?? 0;
      var getgid = () => process_1.default.getgid?.() ?? 0;
      var EMPTY_BUFFER = (0, buffer_1.bufferAllocUnsafe)(0);
      var Node = class {
        constructor(ino, mode = 438, uid = getuid(), gid = getgid()) {
          this.changes = new fanout_1.FanOut();
          this._uid = getuid();
          this._gid = getgid();
          this._atime = /* @__PURE__ */ new Date();
          this._mtime = /* @__PURE__ */ new Date();
          this._ctime = /* @__PURE__ */ new Date();
          this._btime = /* @__PURE__ */ new Date();
          this.buf = EMPTY_BUFFER;
          this.capacity = 0;
          this.size = 0;
          this.rdev = 0;
          this._nlink = 1;
          this.mode = mode;
          this.ino = ino;
          this._uid = uid;
          this._gid = gid;
        }
        set ctime(ctime) {
          this._ctime = ctime;
        }
        get ctime() {
          return this._ctime;
        }
        /**
         * Birth (creation) time of this node. Unlike `ctime`, it is set once when the
         * node is created and is never advanced by writes or metadata changes. The
         * setter exists only for restore paths, like snapshot deserialization.
         */
        set btime(btime) {
          this._btime = btime;
        }
        get btime() {
          return this._btime;
        }
        set uid(uid) {
          this._uid = uid;
          this.ctime = /* @__PURE__ */ new Date();
        }
        get uid() {
          return this._uid;
        }
        set gid(gid) {
          this._gid = gid;
          this.ctime = /* @__PURE__ */ new Date();
        }
        get gid() {
          return this._gid;
        }
        set atime(atime) {
          this._atime = atime;
        }
        get atime() {
          return this._atime;
        }
        set mtime(mtime) {
          this._mtime = mtime;
          this.ctime = /* @__PURE__ */ new Date();
        }
        get mtime() {
          return this._mtime;
        }
        get perm() {
          return this.mode & ~S_IFMT;
        }
        set perm(perm) {
          this.mode = this.mode & S_IFMT | perm & ~S_IFMT;
          this.ctime = /* @__PURE__ */ new Date();
        }
        set nlink(nlink) {
          this._nlink = nlink;
          this.ctime = /* @__PURE__ */ new Date();
        }
        get nlink() {
          return this._nlink;
        }
        getString(encoding = "utf8") {
          this.atime = /* @__PURE__ */ new Date();
          return this.getBuffer().toString(encoding);
        }
        setString(str) {
          this._setBuf((0, buffer_1.bufferFrom)(str, "utf8"));
        }
        getBuffer() {
          this.atime = /* @__PURE__ */ new Date();
          if (!this.buf)
            this.buf = (0, buffer_1.bufferAllocUnsafe)(0);
          return (0, buffer_1.bufferFrom)(this.buf.subarray(0, this.size));
        }
        setBuffer(buf) {
          const copy = (0, buffer_1.bufferFrom)(buf);
          this._setBuf(copy);
        }
        _setBuf(buf) {
          const size = buf.length;
          this.buf = buf;
          this.capacity = size;
          this.size = size;
          this.touch();
        }
        getSize() {
          return this.size;
        }
        setModeProperty(property) {
          this.mode = property;
        }
        isFile() {
          return (this.mode & S_IFMT) === S_IFREG;
        }
        isDirectory() {
          return (this.mode & S_IFMT) === S_IFDIR;
        }
        isSymlink() {
          return (this.mode & S_IFMT) === S_IFLNK;
        }
        isCharacterDevice() {
          return (this.mode & S_IFMT) === S_IFCHR;
        }
        makeSymlink(symlink) {
          this.mode = S_IFLNK | 438;
          this.symlink = symlink;
        }
        write(buf, off2 = 0, len = buf.length, pos = 0) {
          const bufLength = buf.length;
          if (off2 + len > bufLength)
            len = bufLength - off2;
          if (len <= 0)
            return 0;
          const requiredSize = pos + len;
          if (requiredSize > this.capacity) {
            let newCapacity = Math.max(this.capacity * 2, 64);
            while (newCapacity < requiredSize)
              newCapacity *= 2;
            const newBuf = (0, buffer_1.bufferAllocUnsafe)(newCapacity);
            if (this.size > 0)
              this.buf.copy(newBuf, 0, 0, this.size);
            this.buf = newBuf;
            this.capacity = newCapacity;
          }
          if (pos > this.size)
            this.buf.fill(0, this.size, pos);
          buf.copy(this.buf, pos, off2, off2 + len);
          if (requiredSize > this.size)
            this.size = requiredSize;
          this.touch();
          return len;
        }
        /**
         * Read data from the file.
         *
         * @param buf Buffer to read data into.
         * @param off Offset int the `buf` where to start writing data.
         * @param len How many bytes to read. Equals to `buf.byteLength` by default.
         * @param pos Position offset in file where to start reading. Defaults to `0`.
         * @returns Returns the number of bytes read.
         */
        read(buf, off2 = 0, len = buf.byteLength, pos = 0) {
          this.atime = /* @__PURE__ */ new Date();
          if (pos >= this.size)
            return 0;
          let actualLen = len;
          if (actualLen > buf.byteLength)
            actualLen = buf.byteLength;
          if (actualLen + pos > this.size)
            actualLen = this.size - pos;
          if (actualLen <= 0)
            return 0;
          const buf2 = buf instanceof buffer_1.Buffer ? buf : buffer_1.Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
          this.buf.copy(buf2, off2, pos, pos + actualLen);
          return actualLen;
        }
        truncate(len = 0) {
          if (len <= 0) {
            this.buf = EMPTY_BUFFER;
            this.capacity = 0;
            this.size = 0;
            this.touch();
            return;
          }
          if (len <= this.size)
            this.size = len;
          else {
            if (len > this.capacity) {
              let newCapacity = Math.max(this.capacity * 2, 64);
              while (newCapacity < len)
                newCapacity *= 2;
              const buf = (0, buffer_1.bufferAllocUnsafe)(newCapacity);
              if (this.size > 0)
                this.buf.copy(buf, 0, 0, this.size);
              buf.fill(0, this.size, len);
              this.buf = buf;
              this.capacity = newCapacity;
            } else
              this.buf.fill(0, this.size, len);
            this.size = len;
          }
          this.touch();
        }
        chmod(perm) {
          this.mode = this.mode & S_IFMT | perm & ~S_IFMT;
          this.touch();
        }
        chown(uid, gid) {
          this.uid = uid;
          this.gid = gid;
          this.touch();
        }
        touch() {
          this.mtime = /* @__PURE__ */ new Date();
          this.changes.emit(["modify"]);
        }
        canRead(uid = getuid(), gid = getgid()) {
          if (this.perm & 4) {
            return true;
          }
          if (gid === this.gid) {
            if (this.perm & 32) {
              return true;
            }
          }
          if (uid === this.uid) {
            if (this.perm & 256) {
              return true;
            }
          }
          return false;
        }
        canWrite(uid = getuid(), gid = getgid()) {
          if (this.perm & 2) {
            return true;
          }
          if (gid === this.gid) {
            if (this.perm & 16) {
              return true;
            }
          }
          if (uid === this.uid) {
            if (this.perm & 128) {
              return true;
            }
          }
          return false;
        }
        canExecute(uid = getuid(), gid = getgid()) {
          if (this.perm & 1) {
            return true;
          }
          if (gid === this.gid) {
            if (this.perm & 8) {
              return true;
            }
          }
          if (uid === this.uid) {
            if (this.perm & 64) {
              return true;
            }
          }
          return false;
        }
        del() {
          this.changes.emit(["delete"]);
        }
        toJSON() {
          return {
            ino: this.ino,
            uid: this.uid,
            gid: this.gid,
            atime: this.atime.getTime(),
            mtime: this.mtime.getTime(),
            ctime: this.ctime.getTime(),
            btime: this.btime.getTime(),
            perm: this.perm,
            mode: this.mode,
            nlink: this.nlink,
            symlink: this.symlink,
            data: this.getString()
          };
        }
      };
      exports.Node = Node;
    }
  });

  // node_modules/@jsonjoy.com/fs-core/lib/Link.js
  var require_Link = __commonJS({
    "node_modules/@jsonjoy.com/fs-core/lib/Link.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Link = void 0;
      var fs_node_utils_1 = require_lib2();
      var fanout_1 = require_fanout();
      var { S_IFREG } = fs_node_utils_1.constants;
      var Link = class _Link {
        get steps() {
          return this._steps;
        }
        // Recursively sync children steps, e.g. in case of dir rename
        set steps(val) {
          this._steps = val;
          for (const [child, link2] of this.children.entries()) {
            if (child === "." || child === "..") {
              continue;
            }
            link2?.syncSteps();
          }
        }
        constructor(vol, parent, name) {
          this.changes = new fanout_1.FanOut();
          this.children = /* @__PURE__ */ new Map();
          this._steps = [];
          this.ino = 0;
          this.length = 0;
          this.vol = vol;
          this.parent = parent;
          this.name = name;
          this.syncSteps();
        }
        setNode(node) {
          this.node = node;
          this.ino = node.ino;
        }
        getNode() {
          return this.node;
        }
        createChild(name, node = this.vol.createNode(S_IFREG | 438)) {
          const link2 = new _Link(this.vol, this, name);
          link2.setNode(node);
          if (node.isDirectory()) {
            link2.children.set(".", link2);
            link2.getNode().nlink++;
          }
          this.setChild(name, link2);
          return link2;
        }
        setChild(name, link2 = new _Link(this.vol, this, name)) {
          this.children.set(name, link2);
          link2.parent = this;
          this.length++;
          const node = link2.getNode();
          if (node.isDirectory()) {
            link2.children.set("..", this);
            this.getNode().nlink++;
          }
          this.getNode().mtime = /* @__PURE__ */ new Date();
          this.changes.emit(["child:add", link2, this]);
          return link2;
        }
        deleteChild(link2) {
          const node = link2.getNode();
          if (node.isDirectory()) {
            link2.children.delete("..");
            this.getNode().nlink--;
          }
          this.children.delete(link2.getName());
          this.length--;
          this.getNode().mtime = /* @__PURE__ */ new Date();
          this.changes.emit(["child:del", link2, this]);
        }
        getChild(name) {
          this.getNode().atime = /* @__PURE__ */ new Date();
          return this.children.get(name);
        }
        getPath() {
          return this.steps.join(
            "/"
            /* PATH.SEP */
          );
        }
        getParentPath() {
          const parent = this.steps.slice(0, -1).join(
            "/"
            /* PATH.SEP */
          );
          return parent ? parent : "/";
        }
        getName() {
          return this.steps[this.steps.length - 1];
        }
        toJSON() {
          return {
            steps: this.steps,
            ino: this.ino,
            children: Array.from(this.children.keys())
          };
        }
        syncSteps() {
          this.steps = this.parent ? this.parent.steps.concat([this.name]) : [this.name];
        }
      };
      exports.Link = Link;
    }
  });

  // node_modules/@jsonjoy.com/fs-core/lib/File.js
  var require_File = __commonJS({
    "node_modules/@jsonjoy.com/fs-core/lib/File.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.File = void 0;
      var fs_node_utils_1 = require_lib2();
      var { O_APPEND } = fs_node_utils_1.constants;
      var File = class {
        /**
         * Open a Link-Node pair. `node` is provided separately as that might be a different node
         * rather the one `link` points to, because it might be a symlink.
         * @param link
         * @param node
         * @param flags
         * @param fd
         */
        constructor(link2, node, flags, fd) {
          this.link = link2;
          this.node = node;
          this.flags = flags;
          this.fd = fd;
          this.position = 0;
        }
        getString(encoding = "utf8") {
          return this.node.getString();
        }
        setString(str) {
          this.node.setString(str);
        }
        getBuffer() {
          return this.node.getBuffer();
        }
        setBuffer(buf) {
          this.node.setBuffer(buf);
        }
        getSize() {
          return this.node.getSize();
        }
        truncate(len) {
          this.node.truncate(len);
        }
        seekTo(position) {
          this.position = position;
        }
        write(buf, offset = 0, length = buf.length, position) {
          const append = !!(this.flags & O_APPEND);
          const explicit = !append && typeof position === "number";
          const pos = append ? this.node.getSize() : explicit ? position : this.position;
          const bytes = this.node.write(buf, offset, length, pos);
          if (!explicit)
            this.position = pos + bytes;
          return bytes;
        }
        read(buf, offset = 0, length = buf.byteLength, position) {
          const explicit = typeof position === "number";
          const pos = explicit ? position : this.position;
          const bytes = this.node.read(buf, offset, length, pos);
          if (!explicit)
            this.position = pos + bytes;
          return bytes;
        }
        chmod(perm) {
          this.node.chmod(perm);
        }
        chown(uid, gid) {
          this.node.chown(uid, gid);
        }
      };
      exports.File = File;
    }
  });

  // node_modules/@jsonjoy.com/fs-node-utils/lib/validators.js
  var require_validators = __commonJS({
    "node_modules/@jsonjoy.com/fs-node-utils/lib/validators.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.validateAbortSignal = exports.validateBuffer = exports.validateStringArray = exports.validateArray = exports.validateOneOf = exports.validateObject = exports.validateFunction = exports.validateBoolean = exports.validateString = exports.validateUint32 = exports.validateInt32 = exports.validateInteger = exports.INT32_MAX = void 0;
      var argErrors_1 = require_argErrors();
      exports.INT32_MAX = 2147483647;
      var INT32_MIN = -2147483648;
      var UINT32_MAX = 4294967295;
      var MAX_SAFE = 9007199254740991;
      var validateRange = (value, name, min, max) => {
        if (typeof value !== "number")
          throw (0, argErrors_1.invalidArgType)(name, "of type number", value);
        if (!Number.isInteger(value))
          throw (0, argErrors_1.outOfRange)(name, "an integer", value);
        if (value < min || value > max)
          throw (0, argErrors_1.outOfRange)(name, ">= " + min + " && <= " + max, value);
      };
      var validateInteger = (value, name, min = -MAX_SAFE, max = MAX_SAFE) => validateRange(value, name, min, max);
      exports.validateInteger = validateInteger;
      var validateInt32 = (value, name, min = INT32_MIN, max = exports.INT32_MAX) => validateRange(value, name, min, max);
      exports.validateInt32 = validateInt32;
      var validateUint32 = (value, name, positive) => validateRange(value, name, positive ? 1 : 0, UINT32_MAX);
      exports.validateUint32 = validateUint32;
      var validateString = (value, name) => {
        if (typeof value !== "string")
          throw (0, argErrors_1.invalidArgType)(name, "of type string", value);
      };
      exports.validateString = validateString;
      var validateBoolean = (value, name) => {
        if (typeof value !== "boolean")
          throw (0, argErrors_1.invalidArgType)(name, "of type boolean", value);
      };
      exports.validateBoolean = validateBoolean;
      var validateFunction = (value, name) => {
        if (typeof value !== "function")
          throw (0, argErrors_1.invalidArgType)(name, "of type function", value);
      };
      exports.validateFunction = validateFunction;
      var validateObject = (value, name, options = 0) => {
        if (value === null && !(options & 1) || Array.isArray(value) && !(options & 2) || value !== null && typeof value !== "object" && (typeof value !== "function" || !(options & 4)))
          throw (0, argErrors_1.invalidArgType)(name, "of type object", value);
      };
      exports.validateObject = validateObject;
      var validateOneOf = (value, name, oneOf) => {
        if (oneOf.includes(value))
          return;
        let allowed = "";
        for (let i = 0; i < oneOf.length; i++) {
          const one = oneOf[i];
          allowed += (i ? ", " : "") + (typeof one === "string" ? "'" + one + "'" : String(one));
        }
        throw (0, argErrors_1.invalidArgValue)(name, value, "must be one of: " + allowed);
      };
      exports.validateOneOf = validateOneOf;
      var validateArray = (value, name, minLength = 0) => {
        if (!Array.isArray(value))
          throw (0, argErrors_1.invalidArgType)(name, "an instance of Array", value);
        if (value.length < minLength)
          throw (0, argErrors_1.invalidArgValue)(name, value, "must have a length of at least " + minLength);
      };
      exports.validateArray = validateArray;
      var validateStringArray = (value, name) => {
        (0, exports.validateArray)(value, name);
        const array = value;
        for (let i = 0; i < array.length; i++)
          if (typeof array[i] !== "string")
            throw (0, argErrors_1.invalidArgType)(name + "[" + i + "]", "of type string", array[i]);
      };
      exports.validateStringArray = validateStringArray;
      var validateBuffer = (buffer, name = "buffer") => {
        if (!ArrayBuffer.isView(buffer))
          throw (0, argErrors_1.invalidArgType)(name, "an instance of Buffer, TypedArray, or DataView", buffer);
      };
      exports.validateBuffer = validateBuffer;
      var validateAbortSignal = (signal, name) => {
        if (signal !== void 0 && (signal === null || typeof signal !== "object" || !("aborted" in signal)))
          throw (0, argErrors_1.invalidArgType)(name, "an instance of AbortSignal", signal);
      };
      exports.validateAbortSignal = validateAbortSignal;
    }
  });

  // node_modules/@jsonjoy.com/fs-core/lib/util.js
  var require_util = __commonJS({
    "node_modules/@jsonjoy.com/fs-core/lib/util.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.filenameToSteps = exports.resolve = exports.unixify = exports.isWin = void 0;
      exports.isFd = isFd;
      exports.validateFd = validateFd;
      exports.dataToBuffer = dataToBuffer;
      exports.nullCheck = nullCheck;
      exports.pathToFilename = pathToFilename;
      var path_1 = require_path();
      var buffer_1 = require_buffer3();
      var process_1 = require_process();
      var fs_node_utils_1 = require_lib2();
      var argErrors_1 = require_argErrors();
      var validators_1 = require_validators();
      exports.isWin = process_1.default.platform === "win32";
      var resolveCrossPlatform = path_1.resolve;
      var isSeparator = (str, i) => {
        let char = str[i];
        return i > 0 && (char === "/" || exports.isWin && char === "\\");
      };
      var removeTrailingSeparator = (str) => {
        let i = str.length - 1;
        if (i < 2)
          return str;
        while (isSeparator(str, i))
          i--;
        return str.substr(0, i + 1);
      };
      var normalizePath = (str, stripTrailing) => {
        if (typeof str !== "string")
          throw new TypeError("expected a string");
        str = str.replace(/[\\\/]+/g, "/");
        if (stripTrailing !== false)
          str = removeTrailingSeparator(str);
        return str;
      };
      var unixify = (filepath, stripTrailing = true) => {
        if (exports.isWin) {
          filepath = normalizePath(filepath, stripTrailing);
          return filepath.replace(/^([a-zA-Z]+:|\.\/)/, "");
        }
        return filepath;
      };
      exports.unixify = unixify;
      var resolve2 = (filename, base2 = process_1.default.cwd()) => resolveCrossPlatform(base2, filename);
      exports.resolve = resolve2;
      if (exports.isWin) {
        const _resolve = resolve2;
        exports.resolve = resolve2 = (filename, base2) => (0, exports.unixify)(_resolve(filename, base2));
      }
      var filenameToSteps = (filename, base2) => {
        const fullPath = resolve2(filename, base2);
        const fullPathSansSlash = fullPath.substring(1);
        if (!fullPathSansSlash)
          return [];
        return fullPathSansSlash.split(fs_node_utils_1.pathSep);
      };
      exports.filenameToSteps = filenameToSteps;
      function isFd(path2) {
        return path2 >>> 0 === path2;
      }
      function validateFd(fd) {
        if (typeof fd !== "number")
          throw (0, argErrors_1.invalidArgType)("fd", "of type number", fd, true);
        if ((fd < 0 || fd > validators_1.INT32_MAX) && fd !== Infinity && fd !== -Infinity)
          throw (0, argErrors_1.outOfRange)("fd", ">= 0 && <= " + validators_1.INT32_MAX, fd, true);
        if (!Number.isInteger(fd))
          throw (0, argErrors_1.outOfRange)("fd", "an integer", fd, true);
      }
      function dataToBuffer(data, encoding = fs_node_utils_1.ENCODING_UTF8) {
        if (buffer_1.Buffer.isBuffer(data))
          return data;
        else if (data instanceof Uint8Array)
          return (0, buffer_1.bufferFrom)(data);
        else if (encoding === "buffer")
          return (0, buffer_1.bufferFrom)(String(data), "utf8");
        else
          return (0, buffer_1.bufferFrom)(String(data), encoding);
      }
      var NO_NULL_BYTES = "must be a string, Uint8Array, or URL without null bytes";
      var checkNullByte = (path2, name, received) => {
        if (path2.indexOf("\0") === -1)
          return;
        throw (0, argErrors_1.invalidArgValue)(name, received, NO_NULL_BYTES);
      };
      function nullCheck(path2, name = "path") {
        if (path2 instanceof Uint8Array) {
          for (let i = 0; i < path2.length; i++)
            if (!path2[i])
              throw (0, argErrors_1.invalidArgValue)(name, path2, NO_NULL_BYTES);
          return true;
        }
        const str = "" + path2;
        checkNullByte(str, name, str);
        return true;
      }
      var isURL = (value) => !!value && !!value.href && !!value.protocol && value.auth === void 0 && value.path === void 0;
      var getPathFromURL = (url) => {
        if (url.protocol !== "file:")
          throw (0, argErrors_1.invalidUrlScheme)("file");
        if (url.hostname !== "")
          throw (0, argErrors_1.withCode)(new TypeError('File URL host must be "localhost" or empty on ' + process_1.default.platform), "ERR_INVALID_FILE_URL_HOST");
        const pathname = url.pathname;
        for (let n = 0; n < pathname.length; n++) {
          if (pathname[n] === "%") {
            const third = pathname.codePointAt(n + 2) | 32;
            if (pathname[n + 1] === "2" && third === 102)
              throw (0, argErrors_1.withCode)(new TypeError("File URL path must not include encoded / characters"), "ERR_INVALID_FILE_URL_PATH");
          }
        }
        const filepath = decodeURIComponent(pathname);
        return exports.isWin ? filepath.replace(/^\/([a-zA-Z]:)/, "$1") : filepath;
      };
      function pathToFilename(path2, name = "path") {
        const received = path2;
        if (path2 instanceof Uint8Array)
          path2 = (0, buffer_1.bufferFrom)(path2);
        if (typeof path2 !== "string" && !buffer_1.Buffer.isBuffer(path2)) {
          if (!isURL(path2))
            throw (0, argErrors_1.invalidArgType)(name, "of type string or an instance of Buffer or URL", path2);
          path2 = getPathFromURL(path2);
        }
        const pathString = String(path2);
        checkNullByte(pathString, name, received instanceof Uint8Array ? received : pathString);
        return pathString;
      }
    }
  });

  // node_modules/@jsonjoy.com/fs-core/lib/SystemError.js
  var require_SystemError = __commonJS({
    "node_modules/@jsonjoy.com/fs-core/lib/SystemError.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.SystemError = void 0;
      var SystemError = class extends Error {
        constructor(code, prefix, info) {
          const path2 = info.path;
          const dest = info.dest;
          let message = prefix + ": " + info.syscall + " returned " + info.code + " (" + info.message + ")";
          if (path2 !== void 0)
            message += " " + path2;
          if (dest !== void 0)
            message += " => " + dest;
          super(message);
          this.code = code;
          this.info = info;
          this.errno = info.errno;
          this.syscall = info.syscall;
          if (path2 !== void 0)
            this.path = path2;
          if (dest !== void 0)
            this.dest = dest;
        }
        toString() {
          return this.name + " [" + this.code + "]: " + this.message;
        }
      };
      exports.SystemError = SystemError;
      SystemError.prototype.name = "SystemError";
    }
  });

  // node_modules/@jsonjoy.com/fs-core/lib/errors.js
  var require_errors = __commonJS({
    "node_modules/@jsonjoy.com/fs-core/lib/errors.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.createEisdirError = exports.createWatchError = exports.createStatError = exports.createError = void 0;
      var SystemError_1 = require_SystemError();
      var UV = {
        EPERM: [-1, "operation not permitted"],
        ENOENT: [-2, "no such file or directory"],
        EIO: [-5, "i/o error"],
        EBADF: [-9, "bad file descriptor"],
        EAGAIN: [-11, "resource temporarily unavailable"],
        EACCES: [-13, "permission denied"],
        EBUSY: [-16, "resource busy or locked"],
        EEXIST: [-17, "file already exists"],
        EXDEV: [-18, "cross-device link not permitted"],
        ENOTDIR: [-20, "not a directory"],
        EISDIR: [-21, "illegal operation on a directory"],
        EINVAL: [-22, "invalid argument"],
        ENFILE: [-23, "file table overflow"],
        EMFILE: [-24, "too many open files"],
        ETXTBSY: [-26, "text file is busy"],
        EFBIG: [-27, "file too large"],
        ENOSPC: [-28, "no space left on device"],
        ESPIPE: [-29, "invalid seek"],
        EROFS: [-30, "read-only file system"],
        EMLINK: [-31, "too many links"],
        ERANGE: [-34, "result too large"],
        ENAMETOOLONG: [-36, "name too long"],
        ENOSYS: [-38, "function not implemented"],
        ENOTEMPTY: [-39, "directory not empty"],
        ELOOP: [-40, "too many symbolic links encountered"],
        EPROTO: [-71, "protocol error"],
        EOVERFLOW: [-75, "value too large for defined data type"],
        ENOTSUP: [-95, "operation not supported on socket"]
      };
      var formatMessage = (code, uv, syscall, path2, dest) => {
        let message = code + ": " + (uv ? uv[1] : "unknown error") + ", " + syscall;
        if (path2)
          message += " '" + path2 + "'";
        if (dest)
          message += " -> '" + dest + "'";
        return message;
      };
      var createError = (code, syscall = "", path2 = "", dest = "", Constructor = Error) => {
        const uv = UV[code];
        const error = new Constructor(formatMessage(code, uv, syscall, path2, dest));
        if (uv)
          error.errno = uv[0];
        error.code = code;
        error.syscall = syscall;
        if (path2)
          error.path = path2;
        if (dest)
          error.dest = dest;
        return error;
      };
      exports.createError = createError;
      var createStatError = (code, syscall = "", path2 = "", dest = "") => {
        const uv = UV[code];
        return {
          errno: uv ? uv[0] : void 0,
          code,
          syscall,
          path: path2,
          dest,
          message: formatMessage(code, uv, syscall, path2, dest),
          toError: () => (0, exports.createError)(code, syscall, path2, dest)
        };
      };
      exports.createStatError = createStatError;
      var createWatchError = (code, filename) => {
        const uv = UV[code];
        const error = new Error(formatMessage(code, uv, "watch", filename, ""));
        if (uv)
          error.errno = uv[0];
        error.syscall = "watch";
        error.code = code;
        error.path = filename;
        error.filename = filename;
        return error;
      };
      exports.createWatchError = createWatchError;
      var createEisdirError = (syscall, path2) => new SystemError_1.SystemError("ERR_FS_EISDIR", "Path is a directory", {
        code: "EISDIR",
        message: "is a directory",
        path: path2,
        syscall,
        errno: -UV.EISDIR[0]
      });
      exports.createEisdirError = createEisdirError;
    }
  });

  // node_modules/@jsonjoy.com/fs-core/lib/watch/FsEvent.js
  var require_FsEvent = __commonJS({
    "node_modules/@jsonjoy.com/fs-core/lib/watch/FsEvent.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.FsEvent = void 0;
      var FsEvent = class {
        constructor(type, steps, node, link2, oldSteps = void 0) {
          this.type = type;
          this.steps = steps;
          this.node = node;
          this.link = link2;
          this.oldSteps = oldSteps;
        }
      };
      exports.FsEvent = FsEvent;
    }
  });

  // node_modules/@jsonjoy.com/fs-core/lib/Superblock.js
  var require_Superblock = __commonJS({
    "node_modules/@jsonjoy.com/fs-core/lib/Superblock.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Superblock = void 0;
      var path_1 = require_path();
      var Node_1 = require_Node();
      var Link_1 = require_Link();
      var File_1 = require_File();
      var buffer_1 = require_buffer3();
      var process_1 = require_process();
      var fs_node_utils_1 = require_lib2();
      var fs_node_utils_2 = require_lib2();
      var util_1 = require_util();
      var errors_1 = require_errors();
      var argErrors_1 = require_argErrors();
      var json_1 = require_json();
      var result_1 = require_result();
      var fanout_1 = require_fanout();
      var FsEvent_1 = require_FsEvent();
      var { O_RDONLY, O_WRONLY, O_RDWR, O_CREAT, O_EXCL, O_TRUNC, O_DIRECTORY, O_NOFOLLOW } = fs_node_utils_1.constants;
      var MAX_SYMLINK_HOPS = 40;
      var endsWithSep = (path2, win32) => {
        let i = path2.length - 1;
        if (i < 1)
          return false;
        let code = path2.charCodeAt(i);
        if (code === 46)
          code = path2.charCodeAt(--i);
        return code === 47 || win32 && code === 92;
      };
      var Superblock = class _Superblock {
        static fromJSON(json, cwd2, opts) {
          const vol = new _Superblock(opts);
          vol.fromJSON(json, cwd2);
          return vol;
        }
        static fromNestedJSON(json, cwd2, opts) {
          const vol = new _Superblock(opts);
          vol.fromNestedJSON(json, cwd2);
          return vol;
        }
        constructor(opts = {}) {
          this.ino = 0;
          this.inodes = {};
          this.releasedInos = [];
          this.fds = {};
          this.releasedFds = [];
          this.maxFiles = 1e4;
          this.openFiles = 0;
          this.changes = new fanout_1.FanOut();
          this.open = (filename, flagsNum, modeNum, resolveSymlinks = true) => {
            const file = this.openFile(filename, flagsNum, modeNum, resolveSymlinks);
            if (!file)
              throw (0, errors_1.createError)("ENOENT", "open", filename);
            return file.fd;
          };
          this.writeFile = (id, buf, flagsNum, modeNum) => {
            const isUserFd = typeof id === "number";
            let fd;
            if (isUserFd)
              fd = id;
            else
              fd = this.open((0, util_1.pathToFilename)(id), flagsNum, modeNum);
            let offset = 0;
            let length = buf.length;
            try {
              while (length > 0) {
                const written = this.write(fd, buf, offset, length, null);
                offset += written;
                length -= written;
              }
            } finally {
              if (!isUserFd)
                this.close(fd);
            }
          };
          this.read = (fd, buffer, offset, length, position) => {
            if (offset < 0)
              throw (0, argErrors_1.outOfRange)("offset", ">= 0 && <= 9007199254740991", offset);
            if (length === 0)
              return 0;
            if (length < 0)
              throw (0, argErrors_1.outOfRange)("length", ">= 0", length);
            if (offset + length > buffer.byteLength) {
              throw (0, argErrors_1.outOfRange)("length", "<= " + (buffer.byteLength - offset), length);
            }
            const file = this.getFileByFdOrThrow(fd, "read");
            if (file.node.isSymlink()) {
              throw (0, errors_1.createError)("EPERM", "read", file.link.getPath());
            }
            return file.read(buffer, Number(offset), Number(length), position === -1 || typeof position !== "number" ? void 0 : position);
          };
          this.readv = (fd, buffers, position) => {
            const file = this.getFileByFdOrThrow(fd, "read");
            let p = position ?? void 0;
            if (p === -1)
              p = void 0;
            let bytesRead = 0;
            for (const buffer of buffers) {
              const bytes = file.read(buffer, 0, buffer.byteLength, p);
              if (p !== void 0)
                p += bytes;
              bytesRead += bytes;
              if (bytes < buffer.byteLength)
                break;
            }
            return bytesRead;
          };
          this.link = (filename1, filename2) => {
            let link1;
            try {
              link1 = this.getLinkOrThrow(filename1, "link");
            } catch (err) {
              if (err.code)
                err = (0, errors_1.createError)(err.code, "link", filename1, filename2);
              throw err;
            }
            const dirname2 = (0, path_1.dirname)(filename2);
            let dir2;
            try {
              dir2 = this.getLinkOrThrow(dirname2, "link");
            } catch (err) {
              if (err.code)
                err = (0, errors_1.createError)(err.code, "link", filename1, filename2);
              throw err;
            }
            const name = (0, path_1.basename)(filename2);
            if (dir2.getChild(name))
              throw (0, errors_1.createError)("EEXIST", "link", filename1, filename2);
            const node = link1.getNode();
            node.nlink++;
            const newLink = dir2.createChild(name, node);
            this.emit(new FsEvent_1.FsEvent(0, newLink.steps, node, newLink));
          };
          this.unlink = (filename) => {
            const link2 = this.getLinkOrThrow(filename, "unlink");
            if (link2.getNode().isDirectory())
              throw (0, errors_1.createError)("EPERM", "unlink", filename);
            this._emitDeleteRecursive(link2);
            this.deleteLink(link2);
            const node = link2.getNode();
            node.nlink--;
            if (node.nlink <= 0) {
              this.deleteNode(node);
            }
          };
          this.symlink = (targetFilename, pathFilename) => {
            if (!targetFilename)
              throw (0, errors_1.createError)("ENOENT", "symlink", targetFilename, pathFilename);
            const pathSteps = this.filenameToSteps(pathFilename);
            let dirLink;
            try {
              dirLink = this.getLinkParentAsDirOrThrow(pathSteps);
            } catch (err) {
              if (err.code)
                err = (0, errors_1.createError)(err.code, "symlink", targetFilename, pathFilename);
              throw err;
            }
            const name = pathSteps[pathSteps.length - 1];
            if (dirLink.getChild(name))
              throw (0, errors_1.createError)("EEXIST", "symlink", targetFilename, pathFilename);
            const node = dirLink.getNode();
            if (!node.canExecute() || !node.canWrite())
              throw (0, errors_1.createError)("EACCES", "symlink", targetFilename, pathFilename);
            const symlink = dirLink.createChild(name);
            symlink.getNode().makeSymlink(targetFilename);
            this.emit(new FsEvent_1.FsEvent(0, symlink.steps, symlink.getNode(), symlink));
            return symlink;
          };
          this.rename = (oldPathFilename, newPathFilename) => {
            let link2;
            try {
              link2 = this.getResolvedLinkOrThrow(oldPathFilename);
            } catch (err) {
              if (err.code)
                err = (0, errors_1.createError)(err.code, "rename", oldPathFilename, newPathFilename);
              throw err;
            }
            let newPathDirLink;
            try {
              newPathDirLink = this.getLinkParentAsDirOrThrow(newPathFilename);
            } catch (err) {
              if (err.code)
                err = (0, errors_1.createError)(err.code, "rename", oldPathFilename, newPathFilename);
              throw err;
            }
            const oldLinkParent = link2.parent;
            if (!oldLinkParent)
              throw (0, errors_1.createError)("EINVAL", "rename", oldPathFilename, newPathFilename);
            const oldParentNode = oldLinkParent.getNode();
            const newPathDirNode = newPathDirLink.getNode();
            if (!oldParentNode.canExecute() || !oldParentNode.canWrite() || !newPathDirNode.canExecute() || !newPathDirNode.canWrite()) {
              throw (0, errors_1.createError)("EACCES", "rename", oldPathFilename, newPathFilename);
            }
            oldLinkParent.deleteChild(link2);
            const name = (0, path_1.basename)(newPathFilename);
            const oldSteps = link2.steps;
            link2.name = name;
            link2.steps = [...newPathDirLink.steps, name];
            newPathDirLink.setChild(link2.getName(), link2);
            this.emit(new FsEvent_1.FsEvent(4, link2.steps, link2.getNode(), link2, oldSteps));
          };
          this.mkdir = (filename, modeNum) => {
            const steps = this.filenameToSteps(filename);
            if (!steps.length)
              throw (0, errors_1.createError)("EEXIST", "mkdir", filename);
            const dir = this.getLinkParentAsDirOrThrow(filename, "mkdir");
            const name = steps[steps.length - 1];
            if (dir.getChild(name))
              throw (0, errors_1.createError)("EEXIST", "mkdir", filename);
            const node = dir.getNode();
            if (!node.canWrite() || !node.canExecute())
              throw (0, errors_1.createError)("EACCES", "mkdir", filename);
            const child = dir.createChild(name, this.createNode(fs_node_utils_1.constants.S_IFDIR | modeNum));
            this.emit(new FsEvent_1.FsEvent(0, child.steps, child.getNode(), child));
          };
          this.mkdirp = (filename, modeNum) => {
            let created = false;
            const steps = this.filenameToSteps(filename);
            let curr = null;
            let i = steps.length;
            for (i = steps.length; i >= 0; i--) {
              curr = this.getResolvedLink(steps.slice(0, i));
              if (curr)
                break;
            }
            if (!curr) {
              curr = this.root;
              i = 0;
            }
            curr = this.getResolvedLinkOrThrow(fs_node_utils_2.pathSep + steps.slice(0, i).join(fs_node_utils_2.pathSep), "mkdir");
            for (i; i < steps.length; i++) {
              const node = curr.getNode();
              if (node.isDirectory()) {
                if (!node.canExecute() || !node.canWrite())
                  throw (0, errors_1.createError)("EACCES", "mkdir", filename);
              } else {
                throw (0, errors_1.createError)("ENOTDIR", "mkdir", filename);
              }
              created = true;
              curr = curr.createChild(steps[i], this.createNode(fs_node_utils_1.constants.S_IFDIR | modeNum));
              this.emit(new FsEvent_1.FsEvent(0, curr.steps, curr.getNode(), curr));
            }
            return created ? filename : void 0;
          };
          this.rmdir = (filename, recursive = false) => {
            const link2 = this.getLinkAsDirOrThrow(filename, "rmdir");
            if (link2.length && !recursive)
              throw (0, errors_1.createError)("ENOTEMPTY", "rmdir", filename);
            this._emitDeleteRecursive(link2);
            this.deleteLink(link2);
          };
          this.rm = (filename, force = false, recursive = false) => {
            let link2;
            try {
              link2 = this.getResolvedLinkOrThrow(filename, "lstat");
            } catch (err) {
              if (err.code === "ENOENT" && force)
                return;
              else
                throw err;
            }
            if (link2.getNode().isDirectory() && !recursive)
              throw (0, errors_1.createEisdirError)("rm", filename);
            if (!link2.parent?.getNode().canWrite())
              throw (0, errors_1.createError)("EACCES", "rm", filename);
            this._emitDeleteRecursive(link2);
            this.deleteLink(link2);
          };
          this.close = (fd) => {
            (0, util_1.validateFd)(fd);
            const file = this.getFileByFdOrThrow(fd, "close");
            this.closeFile(file);
          };
          this.ftruncate = (fd, len) => {
            const file = this.getFileByFdOrThrow(fd, "ftruncate");
            file.truncate(len);
            this.emit(new FsEvent_1.FsEvent(2, file.link.steps, file.node, file.link));
          };
          this.fchmod = (fd, modeNum) => {
            const file = this.getFileByFdOrThrow(fd, "fchmod");
            file.chmod(modeNum);
            this.emit(new FsEvent_1.FsEvent(3, file.link.steps, file.node, file.link));
          };
          this.chmod = (filename, modeNum) => {
            const link2 = this.getResolvedLinkOrThrow(filename, "chmod");
            link2.getNode().chmod(modeNum);
            this.emit(new FsEvent_1.FsEvent(3, link2.steps, link2.getNode(), link2));
          };
          this.lchmod = (filename, modeNum) => {
            const link2 = this.getLinkOrThrow(filename, "lchmod");
            link2.getNode().chmod(modeNum);
            this.emit(new FsEvent_1.FsEvent(3, link2.steps, link2.getNode(), link2));
          };
          this.fchown = (fd, uid, gid) => {
            const file = this.getFileByFdOrThrow(fd, "fchown");
            file.chown(uid, gid);
            this.emit(new FsEvent_1.FsEvent(3, file.link.steps, file.node, file.link));
          };
          this.chown = (filename, uid, gid) => {
            const link2 = this.getResolvedLinkOrThrow(filename, "chown");
            link2.getNode().chown(uid, gid);
            this.emit(new FsEvent_1.FsEvent(3, link2.steps, link2.getNode(), link2));
          };
          this.lchown = (filename, uid, gid) => {
            const link2 = this.getLinkOrThrow(filename, "lchown");
            link2.getNode().chown(uid, gid);
            this.emit(new FsEvent_1.FsEvent(3, link2.steps, link2.getNode(), link2));
          };
          this.futimes = (fd, atime, mtime) => {
            const file = this.getFileByFdOrThrow(fd, "futime");
            const node = file.node;
            node.atime = new Date(atime * 1e3);
            node.mtime = new Date(mtime * 1e3);
            this.emit(new FsEvent_1.FsEvent(3, file.link.steps, file.node, file.link));
          };
          this.utimes = (filename, atime, mtime, followSymlinks = true) => {
            const link2 = followSymlinks ? this.getResolvedLinkOrThrow(filename, "utime") : this.getLinkOrThrow(filename, "lutime");
            const node = link2.getNode();
            node.atime = new Date(atime * 1e3);
            node.mtime = new Date(mtime * 1e3);
            this.emit(new FsEvent_1.FsEvent(3, link2.steps, node, link2));
          };
          this.process = opts.process ?? process_1.default;
          const root = this.createLink();
          root.setNode(this.createNode(fs_node_utils_1.constants.S_IFDIR | 511));
          root.setChild(".", root);
          root.getNode().nlink++;
          root.setChild("..", root);
          root.getNode().nlink++;
          this.root = root;
        }
        filenameToSteps(filename) {
          return (0, util_1.filenameToSteps)(filename, this.process.cwd());
        }
        emit(change) {
          this.changes.emit(change);
        }
        createLink(parent, name, isDirectory = false, mode) {
          if (!parent) {
            return new Link_1.Link(this, void 0, "");
          }
          if (!name) {
            throw new Error("createLink: name cannot be empty");
          }
          const finalPerm = mode ?? (isDirectory ? 511 : 438);
          const hasFileType = mode && mode & fs_node_utils_1.constants.S_IFMT;
          const modeType = hasFileType ? mode & fs_node_utils_1.constants.S_IFMT : isDirectory ? fs_node_utils_1.constants.S_IFDIR : fs_node_utils_1.constants.S_IFREG;
          const finalMode = finalPerm & ~fs_node_utils_1.constants.S_IFMT | modeType;
          return parent.createChild(name, this.createNode(finalMode));
        }
        deleteLink(link2) {
          const parent = link2.parent;
          if (parent) {
            parent.deleteChild(link2);
            return true;
          }
          return false;
        }
        _emitDeleteRecursive(link2) {
          if (link2.getNode().isDirectory()) {
            for (const [name, child] of link2.children.entries()) {
              if (child && name !== "." && name !== "..") {
                this._emitDeleteRecursive(child);
              }
            }
          }
          this.emit(new FsEvent_1.FsEvent(1, link2.steps, link2.getNode(), link2));
        }
        newInoNumber() {
          const releasedFd = this.releasedInos.pop();
          if (releasedFd)
            return releasedFd;
          else {
            this.ino = (this.ino + 1) % 4294967295;
            return this.ino;
          }
        }
        newFdNumber() {
          const releasedFd = this.releasedFds.pop();
          return typeof releasedFd === "number" ? releasedFd : _Superblock.fd--;
        }
        createNode(mode) {
          const uid = this.process.getuid?.() ?? 0;
          const gid = this.process.getgid?.() ?? 0;
          const node = new Node_1.Node(this.newInoNumber(), mode, uid, gid);
          this.inodes[node.ino] = node;
          return node;
        }
        deleteNode(node) {
          node.del();
          delete this.inodes[node.ino];
          this.releasedInos.push(node.ino);
        }
        walk(stepsOrFilenameOrLink, resolveSymlinks = false, checkExistence = false, checkAccess = false, funcName, budget) {
          let steps;
          let filename;
          if (stepsOrFilenameOrLink instanceof Link_1.Link) {
            steps = stepsOrFilenameOrLink.steps;
            filename = fs_node_utils_2.pathSep + steps.join(fs_node_utils_2.pathSep);
          } else if (typeof stepsOrFilenameOrLink === "string") {
            steps = this.filenameToSteps(stepsOrFilenameOrLink);
            filename = stepsOrFilenameOrLink;
          } else {
            steps = stepsOrFilenameOrLink;
            filename = fs_node_utils_2.pathSep + steps.join(fs_node_utils_2.pathSep);
          }
          let curr = this.root;
          let i = 0;
          let hops = budget ? budget.hops : 0;
          const uid = this.process.getuid?.() ?? 0;
          const gid = this.process.getgid?.() ?? 0;
          while (i < steps.length) {
            let node = curr.getNode();
            if (node.isDirectory()) {
              if (checkAccess && !node.canExecute(uid, gid)) {
                return (0, result_1.Err)((0, errors_1.createStatError)("EACCES", funcName, filename));
              }
            } else {
              if (i < steps.length - 1) {
                return (0, result_1.Err)((0, errors_1.createStatError)("ENOTDIR", funcName, filename));
              }
            }
            curr = curr.getChild(steps[i]) ?? null;
            if (!curr)
              if (checkExistence) {
                return (0, result_1.Err)((0, errors_1.createStatError)("ENOENT", funcName, filename));
              } else {
                return (0, result_1.Ok)(null);
              }
            node = curr?.getNode();
            if (node.isSymlink() && (resolveSymlinks || i < steps.length - 1)) {
              if (++hops > MAX_SYMLINK_HOPS)
                return (0, result_1.Err)((0, errors_1.createStatError)("ELOOP", funcName, filename));
              if (budget)
                budget.hops = hops;
              const resolvedPath = (0, path_1.isAbsolute)(node.symlink) ? node.symlink : (0, fs_node_utils_2.pathJoin)((0, path_1.dirname)(curr.getPath()), node.symlink);
              steps = this.filenameToSteps(resolvedPath).concat(steps.slice(i + 1));
              curr = this.root;
              i = 0;
              continue;
            }
            if (checkExistence && !node.isDirectory() && i < steps.length - 1) {
              const errorCode = this.process.platform === "win32" ? "ENOENT" : "ENOTDIR";
              return (0, result_1.Err)((0, errors_1.createStatError)(errorCode, funcName, filename));
            }
            i++;
          }
          return (0, result_1.Ok)(curr);
        }
        // Returns a `Link` (hard link) referenced by path "split" into steps.
        getLink(steps) {
          const result = this.walk(steps, false, false, false);
          if (result.ok) {
            return result.value;
          }
          throw result.err.toError();
        }
        // Just link `getLink`, but throws a correct user error, if link to found.
        getLinkOrThrow(filename, funcName) {
          const result = this.walk(filename, false, true, true, funcName);
          if (result.ok) {
            return result.value;
          }
          throw result.err.toError();
        }
        // Just like `getLink`, but also dereference/resolves symbolic links.
        getResolvedLink(filenameOrSteps) {
          const result = this.walk(filenameOrSteps, true, false, false);
          if (result.ok) {
            return result.value;
          }
          throw result.err.toError();
        }
        /**
         * Just like `getLinkOrThrow`, but also dereference/resolves symbolic links.
         */
        getResolvedLinkOrThrow(filename, funcName) {
          const result = this.walk(filename, true, true, true, funcName);
          if (result.ok) {
            return result.value;
          }
          throw result.err.toError();
        }
        getResolvedLinkResult(filename, funcName) {
          const result = this.walk(filename, true, true, true, funcName);
          if (result.ok) {
            return (0, result_1.Ok)(result.value);
          }
          return result;
        }
        resolveSymlinks(link2) {
          return this.getResolvedLink(link2.steps.slice(1));
        }
        /**
         * Just like `getLinkOrThrow`, but also verifies that the link is a directory.
         */
        getLinkAsDirOrThrow(filename, funcName) {
          const link2 = this.getLinkOrThrow(filename, funcName);
          if (!link2.getNode().isDirectory())
            throw (0, errors_1.createError)("ENOTDIR", funcName, filename);
          return link2;
        }
        // Get the immediate parent directory of the link.
        getLinkParent(steps) {
          return this.getLink(steps.slice(0, -1));
        }
        // TODO: does not follow a final symlink, so mkdir/symlink/rename('/dirlink/x') give ENOTDIR and link() attaches to the symlink.
        getLinkParentAsDirOrThrow(filenameOrSteps, funcName) {
          const steps = (filenameOrSteps instanceof Array ? filenameOrSteps : this.filenameToSteps(filenameOrSteps)).slice(0, -1);
          const filename = fs_node_utils_2.pathSep + steps.join(fs_node_utils_2.pathSep);
          const link2 = this.getLinkOrThrow(filename, funcName);
          if (!link2.getNode().isDirectory())
            throw (0, errors_1.createError)("ENOTDIR", funcName, filename);
          return link2;
        }
        getFileByFd(fd) {
          return this.fds[String(fd)];
        }
        getFileByFdOrThrow(fd, funcName) {
          (0, util_1.validateFd)(fd);
          const file = this.getFileByFd(fd);
          if (!file)
            throw (0, errors_1.createError)("EBADF", funcName);
          return file;
        }
        _toJSON(link2 = this.root, json = {}, path2, asBuffer) {
          let isEmpty = true;
          let children = link2.children;
          if (link2.getNode().isFile()) {
            children = /* @__PURE__ */ new Map([[link2.getName(), link2.parent.getChild(link2.getName())]]);
            link2 = link2.parent;
          }
          for (const name of children.keys()) {
            if (name === "." || name === "..") {
              continue;
            }
            isEmpty = false;
            const child = link2.getChild(name);
            if (!child) {
              throw new Error("_toJSON: unexpected undefined");
            }
            const node = child.getNode();
            if (node.isFile()) {
              let filename = child.getPath();
              if (path2)
                filename = (0, fs_node_utils_2.pathRelative)(path2, filename);
              json[filename] = asBuffer ? node.getBuffer() : node.getString();
            } else if (node.isDirectory()) {
              this._toJSON(child, json, path2, asBuffer);
            }
          }
          let dirPath = link2.getPath();
          if (path2)
            dirPath = (0, fs_node_utils_2.pathRelative)(path2, dirPath);
          if (dirPath && isEmpty) {
            json[dirPath] = null;
          }
          return json;
        }
        toJSON(paths, json = {}, isRelative = false, asBuffer = false) {
          const links = [];
          if (paths) {
            if (!Array.isArray(paths))
              paths = [paths];
            for (const path2 of paths) {
              const filename = (0, util_1.pathToFilename)(path2);
              const link2 = this.getResolvedLink(filename);
              if (!link2)
                continue;
              links.push(link2);
            }
          } else {
            links.push(this.root);
          }
          if (!links.length)
            return json;
          for (const link2 of links)
            this._toJSON(link2, json, isRelative ? link2.getPath() : "", asBuffer);
          return json;
        }
        fromJSON(json, cwd2 = this.process.cwd()) {
          for (let filename in json) {
            const data = json[filename];
            filename = (0, util_1.resolve)(filename, cwd2);
            if (typeof data === "string" || data instanceof buffer_1.Buffer) {
              const dir = (0, path_1.dirname)(filename);
              this.mkdirp(
                dir,
                511
                /* MODE.DIR */
              );
              const buffer = (0, util_1.dataToBuffer)(data);
              this.writeFile(
                filename,
                buffer,
                fs_node_utils_2.FLAGS.w,
                438
                /* MODE.DEFAULT */
              );
            } else {
              this.mkdirp(
                filename,
                511
                /* MODE.DIR */
              );
            }
          }
        }
        fromNestedJSON(json, cwd2) {
          this.fromJSON((0, json_1.flattenJSON)(json), cwd2);
        }
        reset() {
          this.ino = 0;
          this.inodes = {};
          this.releasedInos = [];
          this.fds = {};
          this.releasedFds = [];
          this.openFiles = 0;
          this.root = this.createLink();
          this.root.setNode(this.createNode(fs_node_utils_1.constants.S_IFDIR | 511));
        }
        // Legacy interface
        mountSync(mountpoint, json) {
          this.fromJSON(json, mountpoint);
        }
        openLink(link2, flagsNum, resolveSymlinks = true, filename = link2.getPath()) {
          if (this.openFiles >= this.maxFiles) {
            throw (0, errors_1.createError)("EMFILE", "open", filename);
          }
          let realLink = link2;
          if (resolveSymlinks)
            realLink = this.getResolvedLinkOrThrow(link2.getPath(), "open");
          const node = realLink.getNode();
          if (node.isDirectory()) {
            if ((flagsNum & (O_RDONLY | O_RDWR | O_WRONLY)) !== O_RDONLY)
              throw (0, errors_1.createError)("EISDIR", "open", filename);
          } else {
            if (flagsNum & O_DIRECTORY)
              throw (0, errors_1.createError)("ENOTDIR", "open", filename);
          }
          if (node.isSymlink() && flagsNum & O_NOFOLLOW)
            throw (0, errors_1.createError)("ELOOP", "open", filename);
          if ((flagsNum & (O_RDONLY | O_RDWR | O_WRONLY)) !== O_WRONLY) {
            if (!node.canRead()) {
              throw (0, errors_1.createError)("EACCES", "open", filename);
            }
          }
          if (flagsNum & (O_WRONLY | O_RDWR)) {
            if (!node.canWrite()) {
              throw (0, errors_1.createError)("EACCES", "open", filename);
            }
          }
          const file = new File_1.File(link2, node, flagsNum, this.newFdNumber());
          this.fds[file.fd] = file;
          this.openFiles++;
          if (flagsNum & O_TRUNC) {
            const hadContent = file.node.getSize() > 0;
            file.truncate();
            if (hadContent)
              this.emit(new FsEvent_1.FsEvent(2, file.link.steps, file.node, file.link));
          }
          return file;
        }
        // O_CREAT with a trailing separator: Linux looks the parent up first and only then fails with EISDIR.
        throwCreatDir(path2, filename, budget) {
          const dir = this.walk((0, path_1.dirname)(path2), true, true, true, "open", budget);
          if (!dir.ok)
            throw (0, errors_1.createError)(dir.err.code, "open", filename);
          const node = dir.value.getNode();
          if (!node.isDirectory())
            throw (0, errors_1.createError)("ENOTDIR", "open", filename);
          if (!node.canExecute())
            throw (0, errors_1.createError)("EACCES", "open", filename);
          throw (0, errors_1.createError)("EISDIR", "open", filename);
        }
        openFile(filename, flagsNum, modeNum, resolveSymlinks = true) {
          if (this.openFiles >= this.maxFiles)
            throw (0, errors_1.createError)("EMFILE", "open", filename);
          if ((flagsNum & (O_CREAT | O_DIRECTORY)) === (O_CREAT | O_DIRECTORY))
            throw (0, errors_1.createError)("EINVAL", "open", filename);
          const win32 = this.process.platform === "win32";
          const budget = { hops: 0 };
          let trailingSlash = endsWithSep(filename, win32);
          if (trailingSlash && flagsNum & O_CREAT)
            this.throwCreatDir(filename, filename, budget);
          const excl = (flagsNum & (O_CREAT | O_EXCL)) === (O_CREAT | O_EXCL);
          const follow = trailingSlash || resolveSymlinks && !(flagsNum & O_NOFOLLOW) && !excl;
          let path2 = filename;
          let link2 = null;
          for (; ; ) {
            const hops = budget.hops;
            const result = this.walk(path2, false, true, true, "open", budget);
            if (!result.ok) {
              const code = result.err.code;
              if (code !== "ENOENT" || !(flagsNum & O_CREAT))
                throw (0, errors_1.createError)(code, "open", filename);
              budget.hops = hops;
              link2 = null;
              break;
            }
            link2 = result.value;
            const node = link2.getNode();
            if (!follow || !node.isSymlink())
              break;
            if (++budget.hops > MAX_SYMLINK_HOPS)
              throw (0, errors_1.createError)("ELOOP", "open", filename);
            path2 = (0, path_1.isAbsolute)(node.symlink) ? node.symlink : (0, fs_node_utils_2.pathJoin)((0, path_1.dirname)(link2.getPath()), node.symlink);
            if (endsWithSep(path2, win32)) {
              if (flagsNum & O_CREAT)
                this.throwCreatDir(path2, filename, budget);
              trailingSlash = true;
            }
          }
          if (link2) {
            const node = link2.getNode();
            if (excl)
              throw (0, errors_1.createError)("EEXIST", "open", filename);
            if (trailingSlash && !node.isDirectory())
              throw (0, errors_1.createError)("ENOTDIR", "open", filename);
            if (flagsNum & O_CREAT && node.isDirectory())
              throw (0, errors_1.createError)("EISDIR", "open", filename);
            return this.openLink(link2, flagsNum, false, filename);
          }
          const dir = this.walk((0, path_1.dirname)(path2), true, true, true, "open", budget);
          if (!dir.ok)
            throw (0, errors_1.createError)(dir.err.code, "open", filename);
          const dirLink = dir.value;
          const dirNode = dirLink.getNode();
          if (!dirNode.isDirectory())
            throw (0, errors_1.createError)("ENOTDIR", "open", filename);
          if (!dirNode.canExecute() || !dirNode.canWrite())
            throw (0, errors_1.createError)("EACCES", "open", filename);
          modeNum ?? (modeNum = 438);
          const steps = (0, util_1.filenameToSteps)(path2);
          link2 = this.createLink(dirLink, steps[steps.length - 1], false, modeNum);
          this.emit(new FsEvent_1.FsEvent(0, link2.steps, link2.getNode(), link2));
          return this.openLink(link2, flagsNum, false, filename);
        }
        closeFile(file) {
          if (!this.fds[file.fd])
            return;
          this.openFiles--;
          delete this.fds[file.fd];
          this.releasedFds.push(file.fd);
        }
        write(fd, buf, offset, length, position) {
          const file = this.getFileByFdOrThrow(fd, "write");
          if (file.node.isSymlink()) {
            throw (0, errors_1.createError)("EBADF", "write", file.link.getPath());
          }
          const bytes = file.write(buf, offset, length, position === -1 || typeof position !== "number" ? void 0 : position);
          if (bytes > 0)
            this.emit(new FsEvent_1.FsEvent(2, file.link.steps, file.node, file.link));
          return bytes;
        }
      };
      exports.Superblock = Superblock;
      Superblock.fd = 2147483647;
    }
  });

  // node_modules/@jsonjoy.com/fs-core/lib/watch/CoreWatcher.js
  var require_CoreWatcher = __commonJS({
    "node_modules/@jsonjoy.com/fs-core/lib/watch/CoreWatcher.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.CoreWatcher = exports.CoreWatchEvent = void 0;
      var fanout_1 = require_fanout();
      var CoreWatchEvent = class {
        constructor(type, steps, node, link2, oldSteps = void 0) {
          this.type = type;
          this.steps = steps;
          this.node = node;
          this.link = link2;
          this.oldSteps = oldSteps;
        }
      };
      exports.CoreWatchEvent = CoreWatchEvent;
      var CoreWatcher = class {
        /** @throws ENOENT-style error when the watch target does not exist. */
        constructor(core, path2, opts = {}) {
          this.changes = new fanout_1.FanOut();
          this.link = opts.follow ?? true ? core.getResolvedLinkOrThrow(path2, "watch") : core.getLinkOrThrow(path2, "watch");
          this.node = this.link.getNode();
          this.recursive = !!opts.recursive;
          this.unsub = core.changes.listen((event) => this.onEvent(event));
        }
        get closed() {
          return !this.unsub;
        }
        onEvent(event) {
          const rootLength = this.link.steps.length;
          const isSelf = event.link === this.link || event.node === this.node && (event.type === 2 || event.type === 3);
          if (isSelf) {
            this.changes.emit(new CoreWatchEvent(event.type, [], event.node, this.link));
            if (event.type === 1)
              this.close();
            return;
          }
          if (event.type === 4) {
            const from = event.oldSteps && this.inScope(event.oldSteps) ? event.oldSteps.slice(rootLength) : void 0;
            const to = this.inScope(event.steps) ? event.steps.slice(rootLength) : void 0;
            if (from && to)
              this.changes.emit(new CoreWatchEvent(4, to, event.node, event.link, from));
            else if (from)
              this.changes.emit(new CoreWatchEvent(1, from, event.node, event.link));
            else if (to)
              this.changes.emit(new CoreWatchEvent(0, to, event.node, event.link));
            return;
          }
          if (this.inScope(event.steps))
            this.changes.emit(new CoreWatchEvent(event.type, event.steps.slice(rootLength), event.node, event.link));
        }
        inScope(steps) {
          const root = this.link.steps;
          if (steps.length <= root.length)
            return false;
          if (!this.recursive && steps.length !== root.length + 1)
            return false;
          for (let i = 0; i < root.length; i++)
            if (steps[i] !== root[i])
              return false;
          return true;
        }
        /** Stop watching and unsubscribe from the volume change stream. */
        close() {
          this.unsub?.();
          this.unsub = void 0;
        }
      };
      exports.CoreWatcher = CoreWatcher;
    }
  });

  // node_modules/@jsonjoy.com/fs-core/lib/index.js
  var require_lib3 = __commonJS({
    "node_modules/@jsonjoy.com/fs-core/lib/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.SystemError = exports.createWatchError = exports.createEisdirError = exports.createStatError = exports.createError = exports.resolve = exports.pathToFilename = exports.nullCheck = exports.validateFd = exports.isWin = exports.isFd = exports.filenameToSteps = exports.dataToBuffer = exports.Superblock = exports.File = exports.Link = exports.Node = void 0;
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_types(), exports);
      tslib_1.__exportStar(require_json(), exports);
      tslib_1.__exportStar(require_constants2(), exports);
      tslib_1.__exportStar(require_result(), exports);
      var Node_1 = require_Node();
      Object.defineProperty(exports, "Node", { enumerable: true, get: function() {
        return Node_1.Node;
      } });
      var Link_1 = require_Link();
      Object.defineProperty(exports, "Link", { enumerable: true, get: function() {
        return Link_1.Link;
      } });
      var File_1 = require_File();
      Object.defineProperty(exports, "File", { enumerable: true, get: function() {
        return File_1.File;
      } });
      var Superblock_1 = require_Superblock();
      Object.defineProperty(exports, "Superblock", { enumerable: true, get: function() {
        return Superblock_1.Superblock;
      } });
      tslib_1.__exportStar(require_FsEvent(), exports);
      tslib_1.__exportStar(require_CoreWatcher(), exports);
      var util_1 = require_util();
      Object.defineProperty(exports, "dataToBuffer", { enumerable: true, get: function() {
        return util_1.dataToBuffer;
      } });
      Object.defineProperty(exports, "filenameToSteps", { enumerable: true, get: function() {
        return util_1.filenameToSteps;
      } });
      Object.defineProperty(exports, "isFd", { enumerable: true, get: function() {
        return util_1.isFd;
      } });
      Object.defineProperty(exports, "isWin", { enumerable: true, get: function() {
        return util_1.isWin;
      } });
      Object.defineProperty(exports, "validateFd", { enumerable: true, get: function() {
        return util_1.validateFd;
      } });
      Object.defineProperty(exports, "nullCheck", { enumerable: true, get: function() {
        return util_1.nullCheck;
      } });
      Object.defineProperty(exports, "pathToFilename", { enumerable: true, get: function() {
        return util_1.pathToFilename;
      } });
      Object.defineProperty(exports, "resolve", { enumerable: true, get: function() {
        return util_1.resolve;
      } });
      var errors_1 = require_errors();
      Object.defineProperty(exports, "createError", { enumerable: true, get: function() {
        return errors_1.createError;
      } });
      Object.defineProperty(exports, "createStatError", { enumerable: true, get: function() {
        return errors_1.createStatError;
      } });
      Object.defineProperty(exports, "createEisdirError", { enumerable: true, get: function() {
        return errors_1.createEisdirError;
      } });
      Object.defineProperty(exports, "createWatchError", { enumerable: true, get: function() {
        return errors_1.createWatchError;
      } });
      var SystemError_1 = require_SystemError();
      Object.defineProperty(exports, "SystemError", { enumerable: true, get: function() {
        return SystemError_1.SystemError;
      } });
    }
  });

  // node_modules/@jsonjoy.com/fs-node/lib/Stats.js
  var require_Stats = __commonJS({
    "node_modules/@jsonjoy.com/fs-node/lib/Stats.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Stats = void 0;
      var fs_node_utils_1 = require_lib2();
      var { S_IFMT, S_IFDIR, S_IFREG, S_IFBLK, S_IFCHR, S_IFLNK, S_IFIFO, S_IFSOCK } = fs_node_utils_1.constants;
      var Stats = class _Stats {
        static build(node, bigint = false) {
          const stats = new _Stats();
          const { uid, gid, atime, mtime, ctime, btime } = node;
          const getStatNumber = !bigint ? (number) => number : (number) => BigInt(number);
          stats.uid = getStatNumber(uid);
          stats.gid = getStatNumber(gid);
          stats.rdev = getStatNumber(node.rdev);
          stats.blksize = getStatNumber(4096);
          stats.ino = getStatNumber(node.ino);
          stats.size = getStatNumber(node.getSize());
          stats.blocks = getStatNumber(1);
          stats.atime = new Date(atime.getTime());
          stats.mtime = new Date(mtime.getTime());
          stats.ctime = new Date(ctime.getTime());
          stats.birthtime = new Date(btime.getTime());
          stats.atimeMs = getStatNumber(atime.getTime());
          stats.mtimeMs = getStatNumber(mtime.getTime());
          stats.ctimeMs = getStatNumber(ctime.getTime());
          stats.birthtimeMs = getStatNumber(btime.getTime());
          if (bigint) {
            stats.atimeNs = BigInt(atime.getTime()) * BigInt(1e6);
            stats.mtimeNs = BigInt(mtime.getTime()) * BigInt(1e6);
            stats.ctimeNs = BigInt(ctime.getTime()) * BigInt(1e6);
            stats.birthtimeNs = BigInt(btime.getTime()) * BigInt(1e6);
          }
          stats.dev = getStatNumber(0);
          stats.mode = getStatNumber(node.mode);
          stats.nlink = getStatNumber(node.nlink);
          return stats;
        }
        _checkModeProperty(property) {
          return (Number(this.mode) & S_IFMT) === property;
        }
        isDirectory() {
          return this._checkModeProperty(S_IFDIR);
        }
        isFile() {
          return this._checkModeProperty(S_IFREG);
        }
        isBlockDevice() {
          return this._checkModeProperty(S_IFBLK);
        }
        isCharacterDevice() {
          return this._checkModeProperty(S_IFCHR);
        }
        isSymbolicLink() {
          return this._checkModeProperty(S_IFLNK);
        }
        isFIFO() {
          return this._checkModeProperty(S_IFIFO);
        }
        isSocket() {
          return this._checkModeProperty(S_IFSOCK);
        }
      };
      exports.Stats = Stats;
      exports.default = Stats;
    }
  });

  // node_modules/@jsonjoy.com/fs-node/lib/Dirent.js
  var require_Dirent = __commonJS({
    "node_modules/@jsonjoy.com/fs-node/lib/Dirent.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Dirent = void 0;
      var fs_node_utils_1 = require_lib2();
      var { S_IFMT, S_IFDIR, S_IFREG, S_IFBLK, S_IFCHR, S_IFLNK, S_IFIFO, S_IFSOCK } = fs_node_utils_1.constants;
      var Dirent = class _Dirent {
        constructor() {
          this.name = "";
          this.parentPath = "";
          this.mode = 0;
          this.path = "";
        }
        static build(link2, encoding, parentPath = link2.getParentPath()) {
          const dirent = new _Dirent();
          const { mode } = link2.getNode();
          dirent.name = (0, fs_node_utils_1.strToEncoding)(link2.getName(), encoding);
          dirent.mode = mode;
          dirent.parentPath = parentPath;
          dirent.path = parentPath;
          return dirent;
        }
        _checkModeProperty(property) {
          return (this.mode & S_IFMT) === property;
        }
        isDirectory() {
          return this._checkModeProperty(S_IFDIR);
        }
        isFile() {
          return this._checkModeProperty(S_IFREG);
        }
        isBlockDevice() {
          return this._checkModeProperty(S_IFBLK);
        }
        isCharacterDevice() {
          return this._checkModeProperty(S_IFCHR);
        }
        isSymbolicLink() {
          return this._checkModeProperty(S_IFLNK);
        }
        isFIFO() {
          return this._checkModeProperty(S_IFIFO);
        }
        isSocket() {
          return this._checkModeProperty(S_IFSOCK);
        }
      };
      exports.Dirent = Dirent;
      exports.default = Dirent;
    }
  });

  // node_modules/@jsonjoy.com/fs-node/lib/StatFs.js
  var require_StatFs = __commonJS({
    "node_modules/@jsonjoy.com/fs-node/lib/StatFs.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.StatFs = void 0;
      var StatFs = class _StatFs {
        static build(superblock, bigint = false) {
          const statfs = new _StatFs();
          const getStatNumber = !bigint ? (number) => number : (number) => BigInt(number);
          statfs.type = getStatNumber(2240043254);
          statfs.bsize = getStatNumber(4096);
          const totalInodes = Object.keys(superblock.inodes).length;
          const totalBlocks = 1e6;
          const usedBlocks = Math.min(totalInodes * 2, totalBlocks);
          const freeBlocks = totalBlocks - usedBlocks;
          statfs.blocks = getStatNumber(totalBlocks);
          statfs.bfree = getStatNumber(freeBlocks);
          statfs.bavail = getStatNumber(freeBlocks);
          const maxFiles = 1e6;
          statfs.files = getStatNumber(maxFiles);
          statfs.ffree = getStatNumber(maxFiles - totalInodes);
          return statfs;
        }
      };
      exports.StatFs = StatFs;
      exports.default = StatFs;
    }
  });

  // node_modules/punycode/punycode.js
  var require_punycode = __commonJS({
    "node_modules/punycode/punycode.js"(exports, module) {
      (function(root) {
        var freeExports = typeof exports == "object" && exports && !exports.nodeType && exports;
        var freeModule = typeof module == "object" && module && !module.nodeType && module;
        var freeGlobal = typeof global == "object" && global;
        if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal || freeGlobal.self === freeGlobal) {
          root = freeGlobal;
        }
        var punycode2, maxInt = 2147483647, base2 = 36, tMin = 1, tMax = 26, skew = 38, damp = 700, initialBias = 72, initialN = 128, delimiter = "-", regexPunycode = /^xn--/, regexNonASCII = /[^\x20-\x7E]/, regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g, errors = {
          "overflow": "Overflow: input needs wider integers to process",
          "not-basic": "Illegal input >= 0x80 (not a basic code point)",
          "invalid-input": "Invalid input"
        }, baseMinusTMin = base2 - tMin, floor = Math.floor, stringFromCharCode = String.fromCharCode, key;
        function error(type) {
          throw new RangeError(errors[type]);
        }
        function map(array, fn) {
          var length = array.length;
          var result = [];
          while (length--) {
            result[length] = fn(array[length]);
          }
          return result;
        }
        function mapDomain(string, fn) {
          var parts = string.split("@");
          var result = "";
          if (parts.length > 1) {
            result = parts[0] + "@";
            string = parts[1];
          }
          string = string.replace(regexSeparators, ".");
          var labels = string.split(".");
          var encoded = map(labels, fn).join(".");
          return result + encoded;
        }
        function ucs2decode(string) {
          var output = [], counter = 0, length = string.length, value, extra;
          while (counter < length) {
            value = string.charCodeAt(counter++);
            if (value >= 55296 && value <= 56319 && counter < length) {
              extra = string.charCodeAt(counter++);
              if ((extra & 64512) == 56320) {
                output.push(((value & 1023) << 10) + (extra & 1023) + 65536);
              } else {
                output.push(value);
                counter--;
              }
            } else {
              output.push(value);
            }
          }
          return output;
        }
        function ucs2encode(array) {
          return map(array, function(value) {
            var output = "";
            if (value > 65535) {
              value -= 65536;
              output += stringFromCharCode(value >>> 10 & 1023 | 55296);
              value = 56320 | value & 1023;
            }
            output += stringFromCharCode(value);
            return output;
          }).join("");
        }
        function basicToDigit(codePoint) {
          if (codePoint - 48 < 10) {
            return codePoint - 22;
          }
          if (codePoint - 65 < 26) {
            return codePoint - 65;
          }
          if (codePoint - 97 < 26) {
            return codePoint - 97;
          }
          return base2;
        }
        function digitToBasic(digit, flag) {
          return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
        }
        function adapt(delta, numPoints, firstTime) {
          var k = 0;
          delta = firstTime ? floor(delta / damp) : delta >> 1;
          delta += floor(delta / numPoints);
          for (; delta > baseMinusTMin * tMax >> 1; k += base2) {
            delta = floor(delta / baseMinusTMin);
          }
          return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
        }
        function decode(input) {
          var output = [], inputLength = input.length, out, i = 0, n = initialN, bias = initialBias, basic, j, index, oldi, w, k, digit, t, baseMinusT;
          basic = input.lastIndexOf(delimiter);
          if (basic < 0) {
            basic = 0;
          }
          for (j = 0; j < basic; ++j) {
            if (input.charCodeAt(j) >= 128) {
              error("not-basic");
            }
            output.push(input.charCodeAt(j));
          }
          for (index = basic > 0 ? basic + 1 : 0; index < inputLength; ) {
            for (oldi = i, w = 1, k = base2; ; k += base2) {
              if (index >= inputLength) {
                error("invalid-input");
              }
              digit = basicToDigit(input.charCodeAt(index++));
              if (digit >= base2 || digit > floor((maxInt - i) / w)) {
                error("overflow");
              }
              i += digit * w;
              t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
              if (digit < t) {
                break;
              }
              baseMinusT = base2 - t;
              if (w > floor(maxInt / baseMinusT)) {
                error("overflow");
              }
              w *= baseMinusT;
            }
            out = output.length + 1;
            bias = adapt(i - oldi, out, oldi == 0);
            if (floor(i / out) > maxInt - n) {
              error("overflow");
            }
            n += floor(i / out);
            i %= out;
            output.splice(i++, 0, n);
          }
          return ucs2encode(output);
        }
        function encode(input) {
          var n, delta, handledCPCount, basicLength, bias, j, m, q, k, t, currentValue, output = [], inputLength, handledCPCountPlusOne, baseMinusT, qMinusT;
          input = ucs2decode(input);
          inputLength = input.length;
          n = initialN;
          delta = 0;
          bias = initialBias;
          for (j = 0; j < inputLength; ++j) {
            currentValue = input[j];
            if (currentValue < 128) {
              output.push(stringFromCharCode(currentValue));
            }
          }
          handledCPCount = basicLength = output.length;
          if (basicLength) {
            output.push(delimiter);
          }
          while (handledCPCount < inputLength) {
            for (m = maxInt, j = 0; j < inputLength; ++j) {
              currentValue = input[j];
              if (currentValue >= n && currentValue < m) {
                m = currentValue;
              }
            }
            handledCPCountPlusOne = handledCPCount + 1;
            if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
              error("overflow");
            }
            delta += (m - n) * handledCPCountPlusOne;
            n = m;
            for (j = 0; j < inputLength; ++j) {
              currentValue = input[j];
              if (currentValue < n && ++delta > maxInt) {
                error("overflow");
              }
              if (currentValue == n) {
                for (q = delta, k = base2; ; k += base2) {
                  t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
                  if (q < t) {
                    break;
                  }
                  qMinusT = q - t;
                  baseMinusT = base2 - t;
                  output.push(
                    stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
                  );
                  q = floor(qMinusT / baseMinusT);
                }
                output.push(stringFromCharCode(digitToBasic(q, 0)));
                bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
                delta = 0;
                ++handledCPCount;
              }
            }
            ++delta;
            ++n;
          }
          return output.join("");
        }
        function toUnicode(input) {
          return mapDomain(input, function(string) {
            return regexPunycode.test(string) ? decode(string.slice(4).toLowerCase()) : string;
          });
        }
        function toASCII(input) {
          return mapDomain(input, function(string) {
            return regexNonASCII.test(string) ? "xn--" + encode(string) : string;
          });
        }
        punycode2 = {
          /**
           * A string representing the current Punycode.js version number.
           * @memberOf punycode
           * @type String
           */
          "version": "1.4.1",
          /**
           * An object of methods to convert from JavaScript's internal character
           * representation (UCS-2) to Unicode code points, and back.
           * @see <https://mathiasbynens.be/notes/javascript-encoding>
           * @memberOf punycode
           * @type Object
           */
          "ucs2": {
            "decode": ucs2decode,
            "encode": ucs2encode
          },
          "decode": decode,
          "encode": encode,
          "toASCII": toASCII,
          "toUnicode": toUnicode
        };
        if (typeof define == "function" && typeof define.amd == "object" && define.amd) {
          define("punycode", function() {
            return punycode2;
          });
        } else if (freeExports && freeModule) {
          if (module.exports == freeExports) {
            freeModule.exports = punycode2;
          } else {
            for (key in punycode2) {
              punycode2.hasOwnProperty(key) && (freeExports[key] = punycode2[key]);
            }
          }
        } else {
          root.punycode = punycode2;
        }
      })(exports);
    }
  });

  // node_modules/es-errors/type.js
  var require_type = __commonJS({
    "node_modules/es-errors/type.js"(exports, module) {
      "use strict";
      module.exports = TypeError;
    }
  });

  // (disabled):node_modules/object-inspect/util.inspect
  var require_util2 = __commonJS({
    "(disabled):node_modules/object-inspect/util.inspect"() {
    }
  });

  // node_modules/object-inspect/index.js
  var require_object_inspect = __commonJS({
    "node_modules/object-inspect/index.js"(exports, module) {
      var hasMap = typeof Map === "function" && Map.prototype;
      var mapSizeDescriptor = Object.getOwnPropertyDescriptor && hasMap ? Object.getOwnPropertyDescriptor(Map.prototype, "size") : null;
      var mapSize = hasMap && mapSizeDescriptor && typeof mapSizeDescriptor.get === "function" ? mapSizeDescriptor.get : null;
      var mapForEach = hasMap && Map.prototype.forEach;
      var hasSet = typeof Set === "function" && Set.prototype;
      var setSizeDescriptor = Object.getOwnPropertyDescriptor && hasSet ? Object.getOwnPropertyDescriptor(Set.prototype, "size") : null;
      var setSize = hasSet && setSizeDescriptor && typeof setSizeDescriptor.get === "function" ? setSizeDescriptor.get : null;
      var setForEach = hasSet && Set.prototype.forEach;
      var hasWeakMap = typeof WeakMap === "function" && WeakMap.prototype;
      var weakMapHas = hasWeakMap ? WeakMap.prototype.has : null;
      var hasWeakSet = typeof WeakSet === "function" && WeakSet.prototype;
      var weakSetHas = hasWeakSet ? WeakSet.prototype.has : null;
      var hasWeakRef = typeof WeakRef === "function" && WeakRef.prototype;
      var weakRefDeref = hasWeakRef ? WeakRef.prototype.deref : null;
      var booleanValueOf = Boolean.prototype.valueOf;
      var objectToString = Object.prototype.toString;
      var functionToString = Function.prototype.toString;
      var $match = String.prototype.match;
      var $slice = String.prototype.slice;
      var $replace = String.prototype.replace;
      var $toUpperCase = String.prototype.toUpperCase;
      var $toLowerCase = String.prototype.toLowerCase;
      var $test = RegExp.prototype.test;
      var $concat = Array.prototype.concat;
      var $join = Array.prototype.join;
      var $arrSlice = Array.prototype.slice;
      var $floor = Math.floor;
      var bigIntValueOf = typeof BigInt === "function" ? BigInt.prototype.valueOf : null;
      var gOPS = Object.getOwnPropertySymbols;
      var symToString = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? Symbol.prototype.toString : null;
      var hasShammedSymbols = typeof Symbol === "function" && typeof Symbol.iterator === "object";
      var toStringTag = typeof Symbol === "function" && Symbol.toStringTag && (typeof Symbol.toStringTag === hasShammedSymbols ? "object" : "symbol") ? Symbol.toStringTag : null;
      var isEnumerable = Object.prototype.propertyIsEnumerable;
      var gPO = (typeof Reflect === "function" ? Reflect.getPrototypeOf : Object.getPrototypeOf) || ([].__proto__ === Array.prototype ? function(O) {
        return O.__proto__;
      } : null);
      function addNumericSeparator(num, str) {
        if (num === Infinity || num === -Infinity || num !== num || num && num > -1e3 && num < 1e3 || $test.call(/e/, str)) {
          return str;
        }
        var sepRegex = /[0-9](?=(?:[0-9]{3})+(?![0-9]))/g;
        if (typeof num === "number") {
          var int = num < 0 ? -$floor(-num) : $floor(num);
          if (int !== num) {
            var intStr = String(int);
            var dec = $slice.call(str, intStr.length + 1);
            return $replace.call(intStr, sepRegex, "$&_") + "." + $replace.call($replace.call(dec, /([0-9]{3})/g, "$&_"), /_$/, "");
          }
        }
        return $replace.call(str, sepRegex, "$&_");
      }
      var utilInspect = require_util2();
      var inspectCustom = utilInspect.custom;
      var inspectSymbol = isSymbol(inspectCustom) ? inspectCustom : null;
      var quotes = {
        __proto__: null,
        "double": '"',
        single: "'"
      };
      var quoteREs = {
        __proto__: null,
        "double": /(["\\])/g,
        single: /(['\\])/g
      };
      module.exports = function inspect_(obj, options, depth, seen) {
        var opts = options || {};
        if (has(opts, "quoteStyle") && !has(quotes, opts.quoteStyle)) {
          throw new TypeError('option "quoteStyle" must be "single" or "double"');
        }
        if (has(opts, "maxStringLength") && (typeof opts.maxStringLength === "number" ? opts.maxStringLength < 0 && opts.maxStringLength !== Infinity : opts.maxStringLength !== null)) {
          throw new TypeError('option "maxStringLength", if provided, must be a positive integer, Infinity, or `null`');
        }
        var customInspect = has(opts, "customInspect") ? opts.customInspect : true;
        if (typeof customInspect !== "boolean" && customInspect !== "symbol") {
          throw new TypeError("option \"customInspect\", if provided, must be `true`, `false`, or `'symbol'`");
        }
        if (has(opts, "indent") && opts.indent !== null && opts.indent !== "	" && !(parseInt(opts.indent, 10) === opts.indent && opts.indent > 0)) {
          throw new TypeError('option "indent" must be "\\t", an integer > 0, or `null`');
        }
        if (has(opts, "numericSeparator") && typeof opts.numericSeparator !== "boolean") {
          throw new TypeError('option "numericSeparator", if provided, must be `true` or `false`');
        }
        var numericSeparator = opts.numericSeparator;
        if (typeof obj === "undefined") {
          return "undefined";
        }
        if (obj === null) {
          return "null";
        }
        if (typeof obj === "boolean") {
          return obj ? "true" : "false";
        }
        if (typeof obj === "string") {
          return inspectString(obj, opts);
        }
        if (typeof obj === "number") {
          if (obj === 0) {
            return Infinity / obj > 0 ? "0" : "-0";
          }
          var str = String(obj);
          return numericSeparator ? addNumericSeparator(obj, str) : str;
        }
        if (typeof obj === "bigint") {
          var bigIntStr = String(obj) + "n";
          return numericSeparator ? addNumericSeparator(obj, bigIntStr) : bigIntStr;
        }
        var maxDepth = typeof opts.depth === "undefined" ? 5 : opts.depth;
        if (typeof depth === "undefined") {
          depth = 0;
        }
        if (depth >= maxDepth && maxDepth > 0 && typeof obj === "object") {
          return isArray(obj) ? "[Array]" : "[Object]";
        }
        var indent = getIndent(opts, depth);
        if (typeof seen === "undefined") {
          seen = [];
        } else if (indexOf(seen, obj) >= 0) {
          return "[Circular]";
        }
        function inspect(value, from, noIndent) {
          if (from) {
            seen = $arrSlice.call(seen);
            seen.push(from);
          }
          if (noIndent) {
            var newOpts = {
              depth: opts.depth
            };
            if (has(opts, "quoteStyle")) {
              newOpts.quoteStyle = opts.quoteStyle;
            }
            return inspect_(value, newOpts, depth + 1, seen);
          }
          return inspect_(value, opts, depth + 1, seen);
        }
        if (typeof obj === "function" && !isRegExp(obj)) {
          var name = nameOf(obj);
          var keys = arrObjKeys(obj, inspect);
          return "[Function" + (name ? ": " + name : " (anonymous)") + "]" + (keys.length > 0 ? " { " + $join.call(keys, ", ") + " }" : "");
        }
        if (isSymbol(obj)) {
          var symString = hasShammedSymbols ? $replace.call(String(obj), /^(Symbol\(.*\))_[^)]*$/, "$1") : symToString.call(obj);
          return typeof obj === "object" && !hasShammedSymbols ? markBoxed(symString) : symString;
        }
        if (isElement(obj)) {
          var s = "<" + $toLowerCase.call(String(obj.nodeName));
          var attrs = obj.attributes || [];
          for (var i = 0; i < attrs.length; i++) {
            s += " " + attrs[i].name + "=" + wrapQuotes(quote(attrs[i].value), "double", opts);
          }
          s += ">";
          if (obj.childNodes && obj.childNodes.length) {
            s += "...";
          }
          s += "</" + $toLowerCase.call(String(obj.nodeName)) + ">";
          return s;
        }
        if (isArray(obj)) {
          if (obj.length === 0) {
            return "[]";
          }
          var xs = arrObjKeys(obj, inspect);
          if (indent && !singleLineValues(xs)) {
            return "[" + indentedJoin(xs, indent) + "]";
          }
          return "[ " + $join.call(xs, ", ") + " ]";
        }
        if (isError(obj)) {
          var parts = arrObjKeys(obj, inspect);
          if (!("cause" in Error.prototype) && "cause" in obj && !isEnumerable.call(obj, "cause")) {
            return "{ [" + String(obj) + "] " + $join.call($concat.call("[cause]: " + inspect(obj.cause), parts), ", ") + " }";
          }
          if (parts.length === 0) {
            return "[" + String(obj) + "]";
          }
          return "{ [" + String(obj) + "] " + $join.call(parts, ", ") + " }";
        }
        if (typeof obj === "object" && customInspect) {
          if (inspectSymbol && typeof obj[inspectSymbol] === "function" && utilInspect) {
            return utilInspect(obj, { depth: maxDepth - depth });
          } else if (customInspect !== "symbol" && typeof obj.inspect === "function") {
            return obj.inspect();
          }
        }
        if (isMap(obj)) {
          var mapParts = [];
          if (mapForEach) {
            mapForEach.call(obj, function(value, key) {
              mapParts.push(inspect(key, obj, true) + " => " + inspect(value, obj));
            });
          }
          return collectionOf("Map", mapSize.call(obj), mapParts, indent);
        }
        if (isSet(obj)) {
          var setParts = [];
          if (setForEach) {
            setForEach.call(obj, function(value) {
              setParts.push(inspect(value, obj));
            });
          }
          return collectionOf("Set", setSize.call(obj), setParts, indent);
        }
        if (isWeakMap(obj)) {
          return weakCollectionOf("WeakMap");
        }
        if (isWeakSet(obj)) {
          return weakCollectionOf("WeakSet");
        }
        if (isWeakRef(obj)) {
          return weakCollectionOf("WeakRef");
        }
        if (isNumber(obj)) {
          return markBoxed(inspect(Number(obj)));
        }
        if (isBigInt(obj)) {
          return markBoxed(inspect(bigIntValueOf.call(obj)));
        }
        if (isBoolean(obj)) {
          return markBoxed(booleanValueOf.call(obj));
        }
        if (isString(obj)) {
          return markBoxed(inspect(String(obj)));
        }
        if (typeof window !== "undefined" && obj === window) {
          return "{ [object Window] }";
        }
        if (typeof globalThis !== "undefined" && obj === globalThis || typeof global !== "undefined" && obj === global) {
          return "{ [object globalThis] }";
        }
        if (!isDate(obj) && !isRegExp(obj)) {
          var ys = arrObjKeys(obj, inspect);
          var isPlainObject = gPO ? gPO(obj) === Object.prototype : obj instanceof Object || obj.constructor === Object;
          var protoTag = obj instanceof Object ? "" : "null prototype";
          var stringTag = !isPlainObject && toStringTag && Object(obj) === obj && toStringTag in obj ? $slice.call(toStr(obj), 8, -1) : protoTag ? "Object" : "";
          var constructorTag = isPlainObject || typeof obj.constructor !== "function" ? "" : obj.constructor.name ? obj.constructor.name + " " : "";
          var tag = constructorTag + (stringTag || protoTag ? "[" + $join.call($concat.call([], stringTag || [], protoTag || []), ": ") + "] " : "");
          if (ys.length === 0) {
            return tag + "{}";
          }
          if (indent) {
            return tag + "{" + indentedJoin(ys, indent) + "}";
          }
          return tag + "{ " + $join.call(ys, ", ") + " }";
        }
        return String(obj);
      };
      function wrapQuotes(s, defaultStyle, opts) {
        var style = opts.quoteStyle || defaultStyle;
        var quoteChar = quotes[style];
        return quoteChar + s + quoteChar;
      }
      function quote(s) {
        return $replace.call(String(s), /"/g, "&quot;");
      }
      function canTrustToString(obj) {
        return !toStringTag || !(typeof obj === "object" && (toStringTag in obj || typeof obj[toStringTag] !== "undefined"));
      }
      function isArray(obj) {
        return toStr(obj) === "[object Array]" && canTrustToString(obj);
      }
      function isDate(obj) {
        return toStr(obj) === "[object Date]" && canTrustToString(obj);
      }
      function isRegExp(obj) {
        return toStr(obj) === "[object RegExp]" && canTrustToString(obj);
      }
      function isError(obj) {
        return toStr(obj) === "[object Error]" && canTrustToString(obj);
      }
      function isString(obj) {
        return toStr(obj) === "[object String]" && canTrustToString(obj);
      }
      function isNumber(obj) {
        return toStr(obj) === "[object Number]" && canTrustToString(obj);
      }
      function isBoolean(obj) {
        return toStr(obj) === "[object Boolean]" && canTrustToString(obj);
      }
      function isSymbol(obj) {
        if (hasShammedSymbols) {
          return obj && typeof obj === "object" && obj instanceof Symbol;
        }
        if (typeof obj === "symbol") {
          return true;
        }
        if (!obj || typeof obj !== "object" || !symToString) {
          return false;
        }
        try {
          symToString.call(obj);
          return true;
        } catch (e) {
        }
        return false;
      }
      function isBigInt(obj) {
        if (!obj || typeof obj !== "object" || !bigIntValueOf) {
          return false;
        }
        try {
          bigIntValueOf.call(obj);
          return true;
        } catch (e) {
        }
        return false;
      }
      var hasOwn = Object.prototype.hasOwnProperty || function(key) {
        return key in this;
      };
      function has(obj, key) {
        return hasOwn.call(obj, key);
      }
      function toStr(obj) {
        return objectToString.call(obj);
      }
      function nameOf(f) {
        if (f.name) {
          return f.name;
        }
        var m = $match.call(functionToString.call(f), /^function\s*([\w$]+)/);
        if (m) {
          return m[1];
        }
        return null;
      }
      function indexOf(xs, x) {
        if (xs.indexOf) {
          return xs.indexOf(x);
        }
        for (var i = 0, l = xs.length; i < l; i++) {
          if (xs[i] === x) {
            return i;
          }
        }
        return -1;
      }
      function isMap(x) {
        if (!mapSize || !x || typeof x !== "object") {
          return false;
        }
        try {
          mapSize.call(x);
          try {
            setSize.call(x);
          } catch (s) {
            return true;
          }
          return x instanceof Map;
        } catch (e) {
        }
        return false;
      }
      function isWeakMap(x) {
        if (!weakMapHas || !x || typeof x !== "object") {
          return false;
        }
        try {
          weakMapHas.call(x, weakMapHas);
          try {
            weakSetHas.call(x, weakSetHas);
          } catch (s) {
            return true;
          }
          return x instanceof WeakMap;
        } catch (e) {
        }
        return false;
      }
      function isWeakRef(x) {
        if (!weakRefDeref || !x || typeof x !== "object") {
          return false;
        }
        try {
          weakRefDeref.call(x);
          return true;
        } catch (e) {
        }
        return false;
      }
      function isSet(x) {
        if (!setSize || !x || typeof x !== "object") {
          return false;
        }
        try {
          setSize.call(x);
          try {
            mapSize.call(x);
          } catch (m) {
            return true;
          }
          return x instanceof Set;
        } catch (e) {
        }
        return false;
      }
      function isWeakSet(x) {
        if (!weakSetHas || !x || typeof x !== "object") {
          return false;
        }
        try {
          weakSetHas.call(x, weakSetHas);
          try {
            weakMapHas.call(x, weakMapHas);
          } catch (s) {
            return true;
          }
          return x instanceof WeakSet;
        } catch (e) {
        }
        return false;
      }
      function isElement(x) {
        if (!x || typeof x !== "object") {
          return false;
        }
        if (typeof HTMLElement !== "undefined" && x instanceof HTMLElement) {
          return true;
        }
        return typeof x.nodeName === "string" && typeof x.getAttribute === "function";
      }
      function inspectString(str, opts) {
        if (str.length > opts.maxStringLength) {
          var remaining = str.length - opts.maxStringLength;
          var trailer = "... " + remaining + " more character" + (remaining > 1 ? "s" : "");
          return inspectString($slice.call(str, 0, opts.maxStringLength), opts) + trailer;
        }
        var quoteRE = quoteREs[opts.quoteStyle || "single"];
        quoteRE.lastIndex = 0;
        var s = $replace.call($replace.call(str, quoteRE, "\\$1"), /[\x00-\x1f]/g, lowbyte);
        return wrapQuotes(s, "single", opts);
      }
      function lowbyte(c) {
        var n = c.charCodeAt(0);
        var x = {
          8: "b",
          9: "t",
          10: "n",
          12: "f",
          13: "r"
        }[n];
        if (x) {
          return "\\" + x;
        }
        return "\\x" + (n < 16 ? "0" : "") + $toUpperCase.call(n.toString(16));
      }
      function markBoxed(str) {
        return "Object(" + str + ")";
      }
      function weakCollectionOf(type) {
        return type + " { ? }";
      }
      function collectionOf(type, size, entries, indent) {
        var joinedEntries = indent ? indentedJoin(entries, indent) : $join.call(entries, ", ");
        return type + " (" + size + ") {" + joinedEntries + "}";
      }
      function singleLineValues(xs) {
        for (var i = 0; i < xs.length; i++) {
          if (indexOf(xs[i], "\n") >= 0) {
            return false;
          }
        }
        return true;
      }
      function getIndent(opts, depth) {
        var baseIndent;
        if (opts.indent === "	") {
          baseIndent = "	";
        } else if (typeof opts.indent === "number" && opts.indent > 0) {
          baseIndent = $join.call(Array(opts.indent + 1), " ");
        } else {
          return null;
        }
        return {
          base: baseIndent,
          prev: $join.call(Array(depth + 1), baseIndent)
        };
      }
      function indentedJoin(xs, indent) {
        if (xs.length === 0) {
          return "";
        }
        var lineJoiner = "\n" + indent.prev + indent.base;
        return lineJoiner + $join.call(xs, "," + lineJoiner) + "\n" + indent.prev;
      }
      function arrObjKeys(obj, inspect) {
        var isArr = isArray(obj);
        var xs = [];
        if (isArr) {
          xs.length = obj.length;
          for (var i = 0; i < obj.length; i++) {
            xs[i] = has(obj, i) ? inspect(obj[i], obj) : "";
          }
        }
        var syms = typeof gOPS === "function" ? gOPS(obj) : [];
        var symMap;
        if (hasShammedSymbols) {
          symMap = {};
          for (var k = 0; k < syms.length; k++) {
            symMap["$" + syms[k]] = syms[k];
          }
        }
        for (var key in obj) {
          if (!has(obj, key)) {
            continue;
          }
          if (isArr && String(Number(key)) === key && key < obj.length) {
            continue;
          }
          if (hasShammedSymbols && symMap["$" + key] instanceof Symbol) {
            continue;
          } else if ($test.call(/[^\w$]/, key)) {
            xs.push(inspect(key, obj) + ": " + inspect(obj[key], obj));
          } else {
            xs.push(key + ": " + inspect(obj[key], obj));
          }
        }
        if (typeof gOPS === "function") {
          for (var j = 0; j < syms.length; j++) {
            if (isEnumerable.call(obj, syms[j])) {
              xs.push("[" + inspect(syms[j]) + "]: " + inspect(obj[syms[j]], obj));
            }
          }
        }
        return xs;
      }
    }
  });

  // node_modules/side-channel-list/index.js
  var require_side_channel_list = __commonJS({
    "node_modules/side-channel-list/index.js"(exports, module) {
      "use strict";
      var inspect = require_object_inspect();
      var $TypeError = require_type();
      var listGetNode = function(list2, key, isDelete) {
        var prev = list2;
        var curr;
        for (; (curr = prev.next) != null; prev = curr) {
          if (curr.key === key) {
            prev.next = curr.next;
            if (!isDelete) {
              curr.next = /** @type {NonNullable<typeof list.next>} */
              list2.next;
              list2.next = curr;
            }
            return curr;
          }
        }
      };
      var listGet = function(objects, key) {
        if (!objects) {
          return void 0;
        }
        var node = listGetNode(objects, key);
        return node && node.value;
      };
      var listSet = function(objects, key, value) {
        var node = listGetNode(objects, key);
        if (node) {
          node.value = value;
        } else {
          objects.next = /** @type {import('./list.d.ts').ListNode<typeof value, typeof key>} */
          {
            // eslint-disable-line no-param-reassign, no-extra-parens
            key,
            next: objects.next,
            value
          };
        }
      };
      var listHas = function(objects, key) {
        if (!objects) {
          return false;
        }
        return !!listGetNode(objects, key);
      };
      var listDelete = function(objects, key) {
        if (objects) {
          return listGetNode(objects, key, true);
        }
      };
      module.exports = function getSideChannelList() {
        var $o;
        var channel = {
          assert: function(key) {
            if (!channel.has(key)) {
              throw new $TypeError("Side channel does not contain " + inspect(key));
            }
          },
          "delete": function(key) {
            var deletedNode = listDelete($o, key);
            if (deletedNode && $o && !$o.next) {
              $o = void 0;
            }
            return !!deletedNode;
          },
          get: function(key) {
            return listGet($o, key);
          },
          has: function(key) {
            return listHas($o, key);
          },
          set: function(key, value) {
            if (!$o) {
              $o = {
                next: void 0
              };
            }
            listSet(
              /** @type {NonNullable<typeof $o>} */
              $o,
              key,
              value
            );
          }
        };
        return channel;
      };
    }
  });

  // node_modules/es-object-atoms/index.js
  var require_es_object_atoms = __commonJS({
    "node_modules/es-object-atoms/index.js"(exports, module) {
      "use strict";
      module.exports = Object;
    }
  });

  // node_modules/es-errors/index.js
  var require_es_errors = __commonJS({
    "node_modules/es-errors/index.js"(exports, module) {
      "use strict";
      module.exports = Error;
    }
  });

  // node_modules/es-errors/eval.js
  var require_eval = __commonJS({
    "node_modules/es-errors/eval.js"(exports, module) {
      "use strict";
      module.exports = EvalError;
    }
  });

  // node_modules/es-errors/range.js
  var require_range = __commonJS({
    "node_modules/es-errors/range.js"(exports, module) {
      "use strict";
      module.exports = RangeError;
    }
  });

  // node_modules/es-errors/ref.js
  var require_ref = __commonJS({
    "node_modules/es-errors/ref.js"(exports, module) {
      "use strict";
      module.exports = ReferenceError;
    }
  });

  // node_modules/es-errors/syntax.js
  var require_syntax = __commonJS({
    "node_modules/es-errors/syntax.js"(exports, module) {
      "use strict";
      module.exports = SyntaxError;
    }
  });

  // node_modules/es-errors/uri.js
  var require_uri = __commonJS({
    "node_modules/es-errors/uri.js"(exports, module) {
      "use strict";
      module.exports = URIError;
    }
  });

  // node_modules/math-intrinsics/abs.js
  var require_abs = __commonJS({
    "node_modules/math-intrinsics/abs.js"(exports, module) {
      "use strict";
      module.exports = Math.abs;
    }
  });

  // node_modules/math-intrinsics/floor.js
  var require_floor = __commonJS({
    "node_modules/math-intrinsics/floor.js"(exports, module) {
      "use strict";
      module.exports = Math.floor;
    }
  });

  // node_modules/math-intrinsics/max.js
  var require_max = __commonJS({
    "node_modules/math-intrinsics/max.js"(exports, module) {
      "use strict";
      module.exports = Math.max;
    }
  });

  // node_modules/math-intrinsics/min.js
  var require_min = __commonJS({
    "node_modules/math-intrinsics/min.js"(exports, module) {
      "use strict";
      module.exports = Math.min;
    }
  });

  // node_modules/math-intrinsics/pow.js
  var require_pow = __commonJS({
    "node_modules/math-intrinsics/pow.js"(exports, module) {
      "use strict";
      module.exports = Math.pow;
    }
  });

  // node_modules/math-intrinsics/round.js
  var require_round = __commonJS({
    "node_modules/math-intrinsics/round.js"(exports, module) {
      "use strict";
      module.exports = Math.round;
    }
  });

  // node_modules/math-intrinsics/isNaN.js
  var require_isNaN = __commonJS({
    "node_modules/math-intrinsics/isNaN.js"(exports, module) {
      "use strict";
      module.exports = Number.isNaN || function isNaN2(a) {
        return a !== a;
      };
    }
  });

  // node_modules/math-intrinsics/sign.js
  var require_sign = __commonJS({
    "node_modules/math-intrinsics/sign.js"(exports, module) {
      "use strict";
      var $isNaN = require_isNaN();
      module.exports = function sign(number) {
        if ($isNaN(number) || number === 0) {
          return number;
        }
        return number < 0 ? -1 : 1;
      };
    }
  });

  // node_modules/gopd/gOPD.js
  var require_gOPD = __commonJS({
    "node_modules/gopd/gOPD.js"(exports, module) {
      "use strict";
      module.exports = Object.getOwnPropertyDescriptor;
    }
  });

  // node_modules/gopd/index.js
  var require_gopd = __commonJS({
    "node_modules/gopd/index.js"(exports, module) {
      "use strict";
      var $gOPD = require_gOPD();
      if ($gOPD) {
        try {
          $gOPD([], "length");
        } catch (e) {
          $gOPD = null;
        }
      }
      module.exports = $gOPD;
    }
  });

  // node_modules/es-define-property/index.js
  var require_es_define_property = __commonJS({
    "node_modules/es-define-property/index.js"(exports, module) {
      "use strict";
      var $defineProperty = Object.defineProperty || false;
      if ($defineProperty) {
        try {
          $defineProperty({}, "a", { value: 1 });
        } catch (e) {
          $defineProperty = false;
        }
      }
      module.exports = $defineProperty;
    }
  });

  // node_modules/has-symbols/shams.js
  var require_shams = __commonJS({
    "node_modules/has-symbols/shams.js"(exports, module) {
      "use strict";
      module.exports = function hasSymbols() {
        if (typeof Symbol !== "function" || typeof Object.getOwnPropertySymbols !== "function") {
          return false;
        }
        if (typeof Symbol.iterator === "symbol") {
          return true;
        }
        var obj = {};
        var sym = Symbol("test");
        var symObj = Object(sym);
        if (typeof sym === "string") {
          return false;
        }
        if (Object.prototype.toString.call(sym) !== "[object Symbol]") {
          return false;
        }
        if (Object.prototype.toString.call(symObj) !== "[object Symbol]") {
          return false;
        }
        var symVal = 42;
        obj[sym] = symVal;
        for (var _ in obj) {
          return false;
        }
        if (typeof Object.keys === "function" && Object.keys(obj).length !== 0) {
          return false;
        }
        if (typeof Object.getOwnPropertyNames === "function" && Object.getOwnPropertyNames(obj).length !== 0) {
          return false;
        }
        var syms = Object.getOwnPropertySymbols(obj);
        if (syms.length !== 1 || syms[0] !== sym) {
          return false;
        }
        if (!Object.prototype.propertyIsEnumerable.call(obj, sym)) {
          return false;
        }
        if (typeof Object.getOwnPropertyDescriptor === "function") {
          var descriptor = (
            /** @type {PropertyDescriptor} */
            Object.getOwnPropertyDescriptor(obj, sym)
          );
          if (descriptor.value !== symVal || descriptor.enumerable !== true) {
            return false;
          }
        }
        return true;
      };
    }
  });

  // node_modules/has-symbols/index.js
  var require_has_symbols = __commonJS({
    "node_modules/has-symbols/index.js"(exports, module) {
      "use strict";
      var origSymbol = typeof Symbol !== "undefined" && Symbol;
      var hasSymbolSham = require_shams();
      module.exports = function hasNativeSymbols() {
        if (typeof origSymbol !== "function") {
          return false;
        }
        if (typeof Symbol !== "function") {
          return false;
        }
        if (typeof origSymbol("foo") !== "symbol") {
          return false;
        }
        if (typeof Symbol("bar") !== "symbol") {
          return false;
        }
        return hasSymbolSham();
      };
    }
  });

  // node_modules/get-proto/Reflect.getPrototypeOf.js
  var require_Reflect_getPrototypeOf = __commonJS({
    "node_modules/get-proto/Reflect.getPrototypeOf.js"(exports, module) {
      "use strict";
      module.exports = typeof Reflect !== "undefined" && Reflect.getPrototypeOf || null;
    }
  });

  // node_modules/get-proto/Object.getPrototypeOf.js
  var require_Object_getPrototypeOf = __commonJS({
    "node_modules/get-proto/Object.getPrototypeOf.js"(exports, module) {
      "use strict";
      var $Object = require_es_object_atoms();
      module.exports = $Object.getPrototypeOf || null;
    }
  });

  // node_modules/function-bind/implementation.js
  var require_implementation = __commonJS({
    "node_modules/function-bind/implementation.js"(exports, module) {
      "use strict";
      var ERROR_MESSAGE = "Function.prototype.bind called on incompatible ";
      var toStr = Object.prototype.toString;
      var max = Math.max;
      var funcType = "[object Function]";
      var concatty = function concatty2(a, b) {
        var arr = [];
        for (var i = 0; i < a.length; i += 1) {
          arr[i] = a[i];
        }
        for (var j = 0; j < b.length; j += 1) {
          arr[j + a.length] = b[j];
        }
        return arr;
      };
      var slicy = function slicy2(arrLike, offset) {
        var arr = [];
        for (var i = offset || 0, j = 0; i < arrLike.length; i += 1, j += 1) {
          arr[j] = arrLike[i];
        }
        return arr;
      };
      var joiny = function(arr, joiner) {
        var str = "";
        for (var i = 0; i < arr.length; i += 1) {
          str += arr[i];
          if (i + 1 < arr.length) {
            str += joiner;
          }
        }
        return str;
      };
      module.exports = function bind(that) {
        var target = this;
        if (typeof target !== "function" || toStr.apply(target) !== funcType) {
          throw new TypeError(ERROR_MESSAGE + target);
        }
        var args = slicy(arguments, 1);
        var bound;
        var binder = function() {
          if (this instanceof bound) {
            var result = target.apply(
              this,
              concatty(args, arguments)
            );
            if (Object(result) === result) {
              return result;
            }
            return this;
          }
          return target.apply(
            that,
            concatty(args, arguments)
          );
        };
        var boundLength = max(0, target.length - args.length);
        var boundArgs = [];
        for (var i = 0; i < boundLength; i++) {
          boundArgs[i] = "$" + i;
        }
        bound = Function("binder", "return function (" + joiny(boundArgs, ",") + "){ return binder.apply(this,arguments); }")(binder);
        if (target.prototype) {
          var Empty = function Empty2() {
          };
          Empty.prototype = target.prototype;
          bound.prototype = new Empty();
          Empty.prototype = null;
        }
        return bound;
      };
    }
  });

  // node_modules/function-bind/index.js
  var require_function_bind = __commonJS({
    "node_modules/function-bind/index.js"(exports, module) {
      "use strict";
      var implementation = require_implementation();
      module.exports = Function.prototype.bind || implementation;
    }
  });

  // node_modules/call-bind-apply-helpers/functionCall.js
  var require_functionCall = __commonJS({
    "node_modules/call-bind-apply-helpers/functionCall.js"(exports, module) {
      "use strict";
      module.exports = Function.prototype.call;
    }
  });

  // node_modules/call-bind-apply-helpers/functionApply.js
  var require_functionApply = __commonJS({
    "node_modules/call-bind-apply-helpers/functionApply.js"(exports, module) {
      "use strict";
      module.exports = Function.prototype.apply;
    }
  });

  // node_modules/call-bind-apply-helpers/reflectApply.js
  var require_reflectApply = __commonJS({
    "node_modules/call-bind-apply-helpers/reflectApply.js"(exports, module) {
      "use strict";
      module.exports = typeof Reflect !== "undefined" && Reflect && Reflect.apply;
    }
  });

  // node_modules/call-bind-apply-helpers/actualApply.js
  var require_actualApply = __commonJS({
    "node_modules/call-bind-apply-helpers/actualApply.js"(exports, module) {
      "use strict";
      var bind = require_function_bind();
      var $apply = require_functionApply();
      var $call = require_functionCall();
      var $reflectApply = require_reflectApply();
      module.exports = $reflectApply || bind.call($call, $apply);
    }
  });

  // node_modules/call-bind-apply-helpers/index.js
  var require_call_bind_apply_helpers = __commonJS({
    "node_modules/call-bind-apply-helpers/index.js"(exports, module) {
      "use strict";
      var bind = require_function_bind();
      var $TypeError = require_type();
      var $call = require_functionCall();
      var $actualApply = require_actualApply();
      module.exports = function callBindBasic(args) {
        if (args.length < 1 || typeof args[0] !== "function") {
          throw new $TypeError("a function is required");
        }
        return $actualApply(bind, $call, args);
      };
    }
  });

  // node_modules/dunder-proto/get.js
  var require_get = __commonJS({
    "node_modules/dunder-proto/get.js"(exports, module) {
      "use strict";
      var callBind = require_call_bind_apply_helpers();
      var gOPD = require_gopd();
      var hasProtoAccessor;
      try {
        hasProtoAccessor = /** @type {{ __proto__?: typeof Array.prototype }} */
        [].__proto__ === Array.prototype;
      } catch (e) {
        if (!e || typeof e !== "object" || !("code" in e) || e.code !== "ERR_PROTO_ACCESS") {
          throw e;
        }
      }
      var desc = !!hasProtoAccessor && gOPD && gOPD(
        Object.prototype,
        /** @type {keyof typeof Object.prototype} */
        "__proto__"
      );
      var $Object = Object;
      var $getPrototypeOf = $Object.getPrototypeOf;
      module.exports = desc && typeof desc.get === "function" ? callBind([desc.get]) : typeof $getPrototypeOf === "function" ? (
        /** @type {import('./get')} */
        function getDunder(value) {
          return $getPrototypeOf(value == null ? value : $Object(value));
        }
      ) : false;
    }
  });

  // node_modules/get-proto/index.js
  var require_get_proto = __commonJS({
    "node_modules/get-proto/index.js"(exports, module) {
      "use strict";
      var reflectGetProto = require_Reflect_getPrototypeOf();
      var originalGetProto = require_Object_getPrototypeOf();
      var getDunderProto = require_get();
      module.exports = reflectGetProto ? function getProto(O) {
        return reflectGetProto(O);
      } : originalGetProto ? function getProto(O) {
        if (!O || typeof O !== "object" && typeof O !== "function") {
          throw new TypeError("getProto: not an object");
        }
        return originalGetProto(O);
      } : getDunderProto ? function getProto(O) {
        return getDunderProto(O);
      } : null;
    }
  });

  // node_modules/hasown/index.js
  var require_hasown = __commonJS({
    "node_modules/hasown/index.js"(exports, module) {
      "use strict";
      var call = Function.prototype.call;
      var $hasOwn = Object.prototype.hasOwnProperty;
      var bind = require_function_bind();
      module.exports = bind.call(call, $hasOwn);
    }
  });

  // node_modules/get-intrinsic/index.js
  var require_get_intrinsic = __commonJS({
    "node_modules/get-intrinsic/index.js"(exports, module) {
      "use strict";
      var undefined2;
      var $Object = require_es_object_atoms();
      var $Error = require_es_errors();
      var $EvalError = require_eval();
      var $RangeError = require_range();
      var $ReferenceError = require_ref();
      var $SyntaxError = require_syntax();
      var $TypeError = require_type();
      var $URIError = require_uri();
      var abs = require_abs();
      var floor = require_floor();
      var max = require_max();
      var min = require_min();
      var pow = require_pow();
      var round = require_round();
      var sign = require_sign();
      var $Function = Function;
      var getEvalledConstructor = function(expressionSyntax) {
        try {
          return $Function('"use strict"; return (' + expressionSyntax + ").constructor;")();
        } catch (e) {
        }
      };
      var $gOPD = require_gopd();
      var $defineProperty = require_es_define_property();
      var throwTypeError = function() {
        throw new $TypeError();
      };
      var ThrowTypeError = $gOPD ? (function() {
        try {
          arguments.callee;
          return throwTypeError;
        } catch (calleeThrows) {
          try {
            return $gOPD(arguments, "callee").get;
          } catch (gOPDthrows) {
            return throwTypeError;
          }
        }
      })() : throwTypeError;
      var hasSymbols = require_has_symbols()();
      var getProto = require_get_proto();
      var $ObjectGPO = require_Object_getPrototypeOf();
      var $ReflectGPO = require_Reflect_getPrototypeOf();
      var $apply = require_functionApply();
      var $call = require_functionCall();
      var needsEval = {};
      var TypedArray = typeof Uint8Array === "undefined" || !getProto ? undefined2 : getProto(Uint8Array);
      var INTRINSICS = {
        __proto__: null,
        "%AggregateError%": typeof AggregateError === "undefined" ? undefined2 : AggregateError,
        "%Array%": Array,
        "%ArrayBuffer%": typeof ArrayBuffer === "undefined" ? undefined2 : ArrayBuffer,
        "%ArrayIteratorPrototype%": hasSymbols && getProto ? getProto([][Symbol.iterator]()) : undefined2,
        "%AsyncFromSyncIteratorPrototype%": undefined2,
        "%AsyncFunction%": needsEval,
        "%AsyncGenerator%": needsEval,
        "%AsyncGeneratorFunction%": needsEval,
        "%AsyncIteratorPrototype%": needsEval,
        "%Atomics%": typeof Atomics === "undefined" ? undefined2 : Atomics,
        "%BigInt%": typeof BigInt === "undefined" ? undefined2 : BigInt,
        "%BigInt64Array%": typeof BigInt64Array === "undefined" ? undefined2 : BigInt64Array,
        "%BigUint64Array%": typeof BigUint64Array === "undefined" ? undefined2 : BigUint64Array,
        "%Boolean%": Boolean,
        "%DataView%": typeof DataView === "undefined" ? undefined2 : DataView,
        "%Date%": Date,
        "%decodeURI%": decodeURI,
        "%decodeURIComponent%": decodeURIComponent,
        "%encodeURI%": encodeURI,
        "%encodeURIComponent%": encodeURIComponent,
        "%Error%": $Error,
        "%eval%": eval,
        // eslint-disable-line no-eval
        "%EvalError%": $EvalError,
        "%Float16Array%": typeof Float16Array === "undefined" ? undefined2 : Float16Array,
        "%Float32Array%": typeof Float32Array === "undefined" ? undefined2 : Float32Array,
        "%Float64Array%": typeof Float64Array === "undefined" ? undefined2 : Float64Array,
        "%FinalizationRegistry%": typeof FinalizationRegistry === "undefined" ? undefined2 : FinalizationRegistry,
        "%Function%": $Function,
        "%GeneratorFunction%": needsEval,
        "%Int8Array%": typeof Int8Array === "undefined" ? undefined2 : Int8Array,
        "%Int16Array%": typeof Int16Array === "undefined" ? undefined2 : Int16Array,
        "%Int32Array%": typeof Int32Array === "undefined" ? undefined2 : Int32Array,
        "%isFinite%": isFinite,
        "%isNaN%": isNaN,
        "%IteratorPrototype%": hasSymbols && getProto ? getProto(getProto([][Symbol.iterator]())) : undefined2,
        "%JSON%": typeof JSON === "object" ? JSON : undefined2,
        "%Map%": typeof Map === "undefined" ? undefined2 : Map,
        "%MapIteratorPrototype%": typeof Map === "undefined" || !hasSymbols || !getProto ? undefined2 : getProto((/* @__PURE__ */ new Map())[Symbol.iterator]()),
        "%Math%": Math,
        "%Number%": Number,
        "%Object%": $Object,
        "%Object.getOwnPropertyDescriptor%": $gOPD,
        "%parseFloat%": parseFloat,
        "%parseInt%": parseInt,
        "%Promise%": typeof Promise === "undefined" ? undefined2 : Promise,
        "%Proxy%": typeof Proxy === "undefined" ? undefined2 : Proxy,
        "%RangeError%": $RangeError,
        "%ReferenceError%": $ReferenceError,
        "%Reflect%": typeof Reflect === "undefined" ? undefined2 : Reflect,
        "%RegExp%": RegExp,
        "%Set%": typeof Set === "undefined" ? undefined2 : Set,
        "%SetIteratorPrototype%": typeof Set === "undefined" || !hasSymbols || !getProto ? undefined2 : getProto((/* @__PURE__ */ new Set())[Symbol.iterator]()),
        "%SharedArrayBuffer%": typeof SharedArrayBuffer === "undefined" ? undefined2 : SharedArrayBuffer,
        "%String%": String,
        "%StringIteratorPrototype%": hasSymbols && getProto ? getProto(""[Symbol.iterator]()) : undefined2,
        "%Symbol%": hasSymbols ? Symbol : undefined2,
        "%SyntaxError%": $SyntaxError,
        "%ThrowTypeError%": ThrowTypeError,
        "%TypedArray%": TypedArray,
        "%TypeError%": $TypeError,
        "%Uint8Array%": typeof Uint8Array === "undefined" ? undefined2 : Uint8Array,
        "%Uint8ClampedArray%": typeof Uint8ClampedArray === "undefined" ? undefined2 : Uint8ClampedArray,
        "%Uint16Array%": typeof Uint16Array === "undefined" ? undefined2 : Uint16Array,
        "%Uint32Array%": typeof Uint32Array === "undefined" ? undefined2 : Uint32Array,
        "%URIError%": $URIError,
        "%WeakMap%": typeof WeakMap === "undefined" ? undefined2 : WeakMap,
        "%WeakRef%": typeof WeakRef === "undefined" ? undefined2 : WeakRef,
        "%WeakSet%": typeof WeakSet === "undefined" ? undefined2 : WeakSet,
        "%Function.prototype.call%": $call,
        "%Function.prototype.apply%": $apply,
        "%Object.defineProperty%": $defineProperty,
        "%Object.getPrototypeOf%": $ObjectGPO,
        "%Math.abs%": abs,
        "%Math.floor%": floor,
        "%Math.max%": max,
        "%Math.min%": min,
        "%Math.pow%": pow,
        "%Math.round%": round,
        "%Math.sign%": sign,
        "%Reflect.getPrototypeOf%": $ReflectGPO
      };
      if (getProto) {
        try {
          null.error;
        } catch (e) {
          errorProto = getProto(getProto(e));
          INTRINSICS["%Error.prototype%"] = errorProto;
        }
      }
      var errorProto;
      var doEval = function doEval2(name) {
        var value;
        if (name === "%AsyncFunction%") {
          value = getEvalledConstructor("async function () {}");
        } else if (name === "%GeneratorFunction%") {
          value = getEvalledConstructor("function* () {}");
        } else if (name === "%AsyncGeneratorFunction%") {
          value = getEvalledConstructor("async function* () {}");
        } else if (name === "%AsyncGenerator%") {
          var fn = doEval2("%AsyncGeneratorFunction%");
          if (fn) {
            value = fn.prototype;
          }
        } else if (name === "%AsyncIteratorPrototype%") {
          var gen = doEval2("%AsyncGenerator%");
          if (gen && getProto) {
            value = getProto(gen.prototype);
          }
        }
        INTRINSICS[name] = value;
        return value;
      };
      var LEGACY_ALIASES = {
        __proto__: null,
        "%ArrayBufferPrototype%": ["ArrayBuffer", "prototype"],
        "%ArrayPrototype%": ["Array", "prototype"],
        "%ArrayProto_entries%": ["Array", "prototype", "entries"],
        "%ArrayProto_forEach%": ["Array", "prototype", "forEach"],
        "%ArrayProto_keys%": ["Array", "prototype", "keys"],
        "%ArrayProto_values%": ["Array", "prototype", "values"],
        "%AsyncFunctionPrototype%": ["AsyncFunction", "prototype"],
        "%AsyncGenerator%": ["AsyncGeneratorFunction", "prototype"],
        "%AsyncGeneratorPrototype%": ["AsyncGeneratorFunction", "prototype", "prototype"],
        "%BooleanPrototype%": ["Boolean", "prototype"],
        "%DataViewPrototype%": ["DataView", "prototype"],
        "%DatePrototype%": ["Date", "prototype"],
        "%ErrorPrototype%": ["Error", "prototype"],
        "%EvalErrorPrototype%": ["EvalError", "prototype"],
        "%Float32ArrayPrototype%": ["Float32Array", "prototype"],
        "%Float64ArrayPrototype%": ["Float64Array", "prototype"],
        "%FunctionPrototype%": ["Function", "prototype"],
        "%Generator%": ["GeneratorFunction", "prototype"],
        "%GeneratorPrototype%": ["GeneratorFunction", "prototype", "prototype"],
        "%Int8ArrayPrototype%": ["Int8Array", "prototype"],
        "%Int16ArrayPrototype%": ["Int16Array", "prototype"],
        "%Int32ArrayPrototype%": ["Int32Array", "prototype"],
        "%JSONParse%": ["JSON", "parse"],
        "%JSONStringify%": ["JSON", "stringify"],
        "%MapPrototype%": ["Map", "prototype"],
        "%NumberPrototype%": ["Number", "prototype"],
        "%ObjectPrototype%": ["Object", "prototype"],
        "%ObjProto_toString%": ["Object", "prototype", "toString"],
        "%ObjProto_valueOf%": ["Object", "prototype", "valueOf"],
        "%PromisePrototype%": ["Promise", "prototype"],
        "%PromiseProto_then%": ["Promise", "prototype", "then"],
        "%Promise_all%": ["Promise", "all"],
        "%Promise_reject%": ["Promise", "reject"],
        "%Promise_resolve%": ["Promise", "resolve"],
        "%RangeErrorPrototype%": ["RangeError", "prototype"],
        "%ReferenceErrorPrototype%": ["ReferenceError", "prototype"],
        "%RegExpPrototype%": ["RegExp", "prototype"],
        "%SetPrototype%": ["Set", "prototype"],
        "%SharedArrayBufferPrototype%": ["SharedArrayBuffer", "prototype"],
        "%StringPrototype%": ["String", "prototype"],
        "%SymbolPrototype%": ["Symbol", "prototype"],
        "%SyntaxErrorPrototype%": ["SyntaxError", "prototype"],
        "%TypedArrayPrototype%": ["TypedArray", "prototype"],
        "%TypeErrorPrototype%": ["TypeError", "prototype"],
        "%Uint8ArrayPrototype%": ["Uint8Array", "prototype"],
        "%Uint8ClampedArrayPrototype%": ["Uint8ClampedArray", "prototype"],
        "%Uint16ArrayPrototype%": ["Uint16Array", "prototype"],
        "%Uint32ArrayPrototype%": ["Uint32Array", "prototype"],
        "%URIErrorPrototype%": ["URIError", "prototype"],
        "%WeakMapPrototype%": ["WeakMap", "prototype"],
        "%WeakSetPrototype%": ["WeakSet", "prototype"]
      };
      var bind = require_function_bind();
      var hasOwn = require_hasown();
      var $concat = bind.call($call, Array.prototype.concat);
      var $spliceApply = bind.call($apply, Array.prototype.splice);
      var $replace = bind.call($call, String.prototype.replace);
      var $strSlice = bind.call($call, String.prototype.slice);
      var $exec = bind.call($call, RegExp.prototype.exec);
      var rePropName = /[^%.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|%$))/g;
      var reEscapeChar = /\\(\\)?/g;
      var stringToPath = function stringToPath2(string) {
        var first = $strSlice(string, 0, 1);
        var last = $strSlice(string, -1);
        if (first === "%" && last !== "%") {
          throw new $SyntaxError("invalid intrinsic syntax, expected closing `%`");
        } else if (last === "%" && first !== "%") {
          throw new $SyntaxError("invalid intrinsic syntax, expected opening `%`");
        }
        var result = [];
        $replace(string, rePropName, function(match, number, quote, subString) {
          result[result.length] = quote ? $replace(subString, reEscapeChar, "$1") : number || match;
        });
        return result;
      };
      var getBaseIntrinsic = function getBaseIntrinsic2(name, allowMissing) {
        var intrinsicName = name;
        var alias;
        if (hasOwn(LEGACY_ALIASES, intrinsicName)) {
          alias = LEGACY_ALIASES[intrinsicName];
          intrinsicName = "%" + alias[0] + "%";
        }
        if (hasOwn(INTRINSICS, intrinsicName)) {
          var value = INTRINSICS[intrinsicName];
          if (value === needsEval) {
            value = doEval(intrinsicName);
          }
          if (typeof value === "undefined" && !allowMissing) {
            throw new $TypeError("intrinsic " + name + " exists, but is not available. Please file an issue!");
          }
          return {
            alias,
            name: intrinsicName,
            value
          };
        }
        throw new $SyntaxError("intrinsic " + name + " does not exist!");
      };
      module.exports = function GetIntrinsic(name, allowMissing) {
        if (typeof name !== "string" || name.length === 0) {
          throw new $TypeError("intrinsic name must be a non-empty string");
        }
        if (arguments.length > 1 && typeof allowMissing !== "boolean") {
          throw new $TypeError('"allowMissing" argument must be a boolean');
        }
        if ($exec(/^%?[^%]*%?$/, name) === null) {
          throw new $SyntaxError("`%` may not be present anywhere but at the beginning and end of the intrinsic name");
        }
        var parts = stringToPath(name);
        var intrinsicBaseName = parts.length > 0 ? parts[0] : "";
        var intrinsic = getBaseIntrinsic("%" + intrinsicBaseName + "%", allowMissing);
        var intrinsicRealName = intrinsic.name;
        var value = intrinsic.value;
        var skipFurtherCaching = false;
        var alias = intrinsic.alias;
        if (alias) {
          intrinsicBaseName = alias[0];
          $spliceApply(parts, $concat([0, 1], alias));
        }
        for (var i = 1, isOwn = true; i < parts.length; i += 1) {
          var part = parts[i];
          var first = $strSlice(part, 0, 1);
          var last = $strSlice(part, -1);
          if ((first === '"' || first === "'" || first === "`" || (last === '"' || last === "'" || last === "`")) && first !== last) {
            throw new $SyntaxError("property names with quotes must have matching quotes");
          }
          if (part === "constructor" || !isOwn) {
            skipFurtherCaching = true;
          }
          intrinsicBaseName += "." + part;
          intrinsicRealName = "%" + intrinsicBaseName + "%";
          if (hasOwn(INTRINSICS, intrinsicRealName)) {
            value = INTRINSICS[intrinsicRealName];
          } else if (value != null) {
            if (!(part in value)) {
              if (!allowMissing) {
                throw new $TypeError("base intrinsic for " + name + " exists, but the property is not available.");
              }
              return void undefined2;
            }
            if ($gOPD && i + 1 >= parts.length) {
              var desc = $gOPD(value, part);
              isOwn = !!desc;
              if (isOwn && "get" in desc && !("originalValue" in desc.get)) {
                value = desc.get;
              } else {
                value = value[part];
              }
            } else {
              isOwn = hasOwn(value, part);
              value = value[part];
            }
            if (isOwn && !skipFurtherCaching) {
              INTRINSICS[intrinsicRealName] = value;
            }
          }
        }
        return value;
      };
    }
  });

  // node_modules/call-bound/index.js
  var require_call_bound = __commonJS({
    "node_modules/call-bound/index.js"(exports, module) {
      "use strict";
      var GetIntrinsic = require_get_intrinsic();
      var callBindBasic = require_call_bind_apply_helpers();
      var $indexOf = callBindBasic([GetIntrinsic("%String.prototype.indexOf%")]);
      module.exports = function callBoundIntrinsic(name, allowMissing) {
        var intrinsic = (
          /** @type {(this: unknown, ...args: unknown[]) => unknown} */
          GetIntrinsic(name, !!allowMissing)
        );
        if (typeof intrinsic === "function" && $indexOf(name, ".prototype.") > -1) {
          return callBindBasic(
            /** @type {const} */
            [intrinsic]
          );
        }
        return intrinsic;
      };
    }
  });

  // node_modules/side-channel-map/index.js
  var require_side_channel_map = __commonJS({
    "node_modules/side-channel-map/index.js"(exports, module) {
      "use strict";
      var GetIntrinsic = require_get_intrinsic();
      var callBound = require_call_bound();
      var inspect = require_object_inspect();
      var $TypeError = require_type();
      var $Map = GetIntrinsic("%Map%", true);
      var $mapGet = callBound("Map.prototype.get", true);
      var $mapSet = callBound("Map.prototype.set", true);
      var $mapHas = callBound("Map.prototype.has", true);
      var $mapDelete = callBound("Map.prototype.delete", true);
      var $mapSize = callBound("Map.prototype.size", true);
      module.exports = !!$Map && /** @type {Exclude<import('.'), false>} */
      function getSideChannelMap() {
        var $m;
        var channel = {
          assert: function(key) {
            if (!channel.has(key)) {
              throw new $TypeError("Side channel does not contain " + inspect(key));
            }
          },
          "delete": function(key) {
            if ($m) {
              var result = $mapDelete($m, key);
              if ($mapSize($m) === 0) {
                $m = void 0;
              }
              return result;
            }
            return false;
          },
          get: function(key) {
            if ($m) {
              return $mapGet($m, key);
            }
          },
          has: function(key) {
            if ($m) {
              return $mapHas($m, key);
            }
            return false;
          },
          set: function(key, value) {
            if (!$m) {
              $m = new $Map();
            }
            $mapSet($m, key, value);
          }
        };
        return channel;
      };
    }
  });

  // node_modules/side-channel-weakmap/index.js
  var require_side_channel_weakmap = __commonJS({
    "node_modules/side-channel-weakmap/index.js"(exports, module) {
      "use strict";
      var GetIntrinsic = require_get_intrinsic();
      var callBound = require_call_bound();
      var inspect = require_object_inspect();
      var getSideChannelMap = require_side_channel_map();
      var $TypeError = require_type();
      var $WeakMap = GetIntrinsic("%WeakMap%", true);
      var $weakMapGet = callBound("WeakMap.prototype.get", true);
      var $weakMapSet = callBound("WeakMap.prototype.set", true);
      var $weakMapHas = callBound("WeakMap.prototype.has", true);
      var $weakMapDelete = callBound("WeakMap.prototype.delete", true);
      module.exports = $WeakMap ? (
        /** @type {Exclude<import('.'), false>} */
        function getSideChannelWeakMap() {
          var $wm;
          var $m;
          var channel = {
            assert: function(key) {
              if (!channel.has(key)) {
                throw new $TypeError("Side channel does not contain " + inspect(key));
              }
            },
            "delete": function(key) {
              if ($WeakMap && key && (typeof key === "object" || typeof key === "function")) {
                if ($wm) {
                  return $weakMapDelete($wm, key);
                }
              } else if (getSideChannelMap) {
                if ($m) {
                  return $m["delete"](key);
                }
              }
              return false;
            },
            get: function(key) {
              if ($WeakMap && key && (typeof key === "object" || typeof key === "function")) {
                if ($wm) {
                  return $weakMapGet($wm, key);
                }
              }
              return $m && $m.get(key);
            },
            has: function(key) {
              if ($WeakMap && key && (typeof key === "object" || typeof key === "function")) {
                if ($wm) {
                  return $weakMapHas($wm, key);
                }
              }
              return !!$m && $m.has(key);
            },
            set: function(key, value) {
              if ($WeakMap && key && (typeof key === "object" || typeof key === "function")) {
                if (!$wm) {
                  $wm = new $WeakMap();
                }
                $weakMapSet($wm, key, value);
              } else if (getSideChannelMap) {
                if (!$m) {
                  $m = getSideChannelMap();
                }
                $m.set(key, value);
              }
            }
          };
          return channel;
        }
      ) : getSideChannelMap;
    }
  });

  // node_modules/side-channel/index.js
  var require_side_channel = __commonJS({
    "node_modules/side-channel/index.js"(exports, module) {
      "use strict";
      var $TypeError = require_type();
      var inspect = require_object_inspect();
      var getSideChannelList = require_side_channel_list();
      var getSideChannelMap = require_side_channel_map();
      var getSideChannelWeakMap = require_side_channel_weakmap();
      var makeChannel = getSideChannelWeakMap || getSideChannelMap || getSideChannelList;
      module.exports = function getSideChannel() {
        var $channelData;
        var channel = {
          assert: function(key) {
            if (!channel.has(key)) {
              var keyDesc = key && Object(key) === key ? "the given object key" : inspect(key);
              throw new $TypeError("Side channel does not contain " + keyDesc);
            }
          },
          "delete": function(key) {
            return !!$channelData && $channelData["delete"](key);
          },
          get: function(key) {
            return $channelData && $channelData.get(key);
          },
          has: function(key) {
            return !!$channelData && $channelData.has(key);
          },
          set: function(key, value) {
            if (!$channelData) {
              $channelData = makeChannel();
            }
            $channelData.set(key, value);
          }
        };
        return channel;
      };
    }
  });

  // node_modules/qs/lib/formats.js
  var require_formats = __commonJS({
    "node_modules/qs/lib/formats.js"(exports, module) {
      "use strict";
      var replace = String.prototype.replace;
      var percentTwenties = /%20/g;
      var Format = {
        RFC1738: "RFC1738",
        RFC3986: "RFC3986"
      };
      module.exports = {
        "default": Format.RFC3986,
        formatters: {
          RFC1738: function(value) {
            return replace.call(value, percentTwenties, "+");
          },
          RFC3986: function(value) {
            return String(value);
          }
        },
        RFC1738: Format.RFC1738,
        RFC3986: Format.RFC3986
      };
    }
  });

  // node_modules/qs/lib/utils.js
  var require_utils = __commonJS({
    "node_modules/qs/lib/utils.js"(exports, module) {
      "use strict";
      var formats = require_formats();
      var getSideChannel = require_side_channel();
      var defineProperty = require_es_define_property();
      var has = Object.prototype.hasOwnProperty;
      var isArray = Array.isArray;
      var overflowChannel = getSideChannel();
      var markOverflow = function markOverflow2(obj, maxIndex) {
        overflowChannel.set(obj, maxIndex);
        return obj;
      };
      var isOverflow = function isOverflow2(obj) {
        return overflowChannel.has(obj);
      };
      var getMaxIndex = function getMaxIndex2(obj) {
        return overflowChannel.get(obj);
      };
      var setMaxIndex = function setMaxIndex2(obj, maxIndex) {
        overflowChannel.set(obj, maxIndex);
      };
      var hexTable = (function() {
        var array = [];
        for (var i = 0; i < 256; ++i) {
          array[array.length] = "%" + ((i < 16 ? "0" : "") + i.toString(16)).toUpperCase();
        }
        return array;
      })();
      var compactQueue = function compactQueue2(queue2) {
        while (queue2.length > 1) {
          var item = queue2.pop();
          var obj = item.obj[item.prop];
          if (isArray(obj)) {
            var compacted = [];
            for (var j = 0; j < obj.length; ++j) {
              if (typeof obj[j] !== "undefined") {
                compacted[compacted.length] = obj[j];
              }
            }
            item.obj[item.prop] = compacted;
          }
        }
      };
      var arrayToObject = function arrayToObject2(source, options) {
        var obj = options && options.plainObjects ? { __proto__: null } : {};
        for (var i = 0; i < source.length; ++i) {
          if (typeof source[i] !== "undefined") {
            obj[i] = source[i];
          }
        }
        return obj;
      };
      var setProperty = function setProperty2(obj, key, value) {
        if (key === "__proto__" && defineProperty) {
          defineProperty(obj, key, {
            configurable: true,
            enumerable: true,
            value,
            writable: true
          });
        } else {
          obj[key] = value;
        }
      };
      var merge = function merge2(target, source, options) {
        if (!source) {
          return target;
        }
        if (typeof source !== "object" && typeof source !== "function") {
          if (isArray(target)) {
            var nextIndex = target.length;
            if (options && typeof options.arrayLimit === "number" && nextIndex >= options.arrayLimit) {
              if (options.throwOnLimitExceeded) {
                throw new RangeError("Array limit exceeded. Only " + options.arrayLimit + " element" + (options.arrayLimit === 1 ? "" : "s") + " allowed in an array.");
              }
              return markOverflow(arrayToObject(target.concat(source), options), nextIndex);
            }
            target[nextIndex] = source;
          } else if (target && typeof target === "object") {
            if (isOverflow(target)) {
              var newIndex = getMaxIndex(target) + 1;
              target[newIndex] = source;
              setMaxIndex(target, newIndex);
            } else if (options && options.strictMerge) {
              return [target, source];
            } else if (options && (options.plainObjects || options.allowPrototypes) || !has.call(Object.prototype, source)) {
              target[source] = true;
            }
          } else {
            return [target, source];
          }
          return target;
        }
        if (!target || typeof target !== "object") {
          if (isOverflow(source)) {
            var sourceKeys = Object.keys(source);
            var result = options && options.plainObjects ? { __proto__: null, 0: target } : { 0: target };
            for (var m = 0; m < sourceKeys.length; m++) {
              var oldKey = parseInt(sourceKeys[m], 10);
              result[oldKey + 1] = source[sourceKeys[m]];
            }
            return markOverflow(result, getMaxIndex(source) + 1);
          }
          var combined = [target].concat(source);
          if (options && typeof options.arrayLimit === "number" && combined.length > options.arrayLimit) {
            if (options.throwOnLimitExceeded) {
              throw new RangeError("Array limit exceeded. Only " + options.arrayLimit + " element" + (options.arrayLimit === 1 ? "" : "s") + " allowed in an array.");
            }
            return markOverflow(arrayToObject(combined, options), combined.length - 1);
          }
          return combined;
        }
        var mergeTarget = target;
        if (isArray(target) && !isArray(source)) {
          mergeTarget = arrayToObject(target, options);
        }
        if (isArray(target) && isArray(source)) {
          source.forEach(function(item, i) {
            if (has.call(target, i)) {
              var targetItem = target[i];
              if (targetItem && typeof targetItem === "object" && item && typeof item === "object") {
                target[i] = merge2(targetItem, item, options);
              } else {
                target[target.length] = item;
              }
            } else {
              target[i] = item;
            }
          });
          if (options && typeof options.arrayLimit === "number" && target.length > options.arrayLimit) {
            if (options.throwOnLimitExceeded) {
              throw new RangeError("Array limit exceeded. Only " + options.arrayLimit + " element" + (options.arrayLimit === 1 ? "" : "s") + " allowed in an array.");
            }
            return markOverflow(arrayToObject(target, options), target.length - 1);
          }
          return target;
        }
        return Object.keys(source).reduce(function(acc, key) {
          var value = source[key];
          if (has.call(acc, key)) {
            setProperty(acc, key, merge2(acc[key], value, options));
          } else {
            setProperty(acc, key, value);
          }
          if (isOverflow(source) && !isOverflow(acc)) {
            markOverflow(acc, getMaxIndex(source));
          }
          if (isOverflow(acc)) {
            var keyNum = parseInt(key, 10);
            if (String(keyNum) === key && keyNum >= 0 && keyNum > getMaxIndex(acc)) {
              setMaxIndex(acc, keyNum);
            }
          }
          return acc;
        }, mergeTarget);
      };
      var assign = function assignSingleSource(target, source) {
        return Object.keys(source).reduce(function(acc, key) {
          setProperty(acc, key, source[key]);
          return acc;
        }, target);
      };
      var decode = function(str, defaultDecoder, charset) {
        var strWithoutPlus = str.replace(/\+/g, " ");
        if (charset === "iso-8859-1") {
          return strWithoutPlus.replace(/%[0-9a-f]{2}/gi, unescape);
        }
        try {
          return decodeURIComponent(strWithoutPlus);
        } catch (e) {
          return strWithoutPlus;
        }
      };
      var limit = 1024;
      var encode = function encode2(str, defaultEncoder, charset, kind, format2) {
        if (str.length === 0) {
          return str;
        }
        var string = str;
        if (typeof str === "symbol") {
          string = Symbol.prototype.toString.call(str);
        } else if (typeof str !== "string") {
          string = String(str);
        }
        if (charset === "iso-8859-1") {
          return escape(string).replace(/%u[0-9a-f]{4}/gi, function($0) {
            return "%26%23" + parseInt($0.slice(2), 16) + "%3B";
          });
        }
        var out = "";
        for (var j = 0; j < string.length; j += limit) {
          var segment = string.length >= limit ? string.slice(j, j + limit) : string;
          if (j + limit < string.length) {
            var last = segment.charCodeAt(segment.length - 1);
            if (last >= 55296 && last <= 56319) {
              segment = segment.slice(0, -1);
              j -= 1;
            }
          }
          var arr = [];
          for (var i = 0; i < segment.length; ++i) {
            var c = segment.charCodeAt(i);
            if (c === 45 || c === 46 || c === 95 || c === 126 || c >= 48 && c <= 57 || c >= 65 && c <= 90 || c >= 97 && c <= 122 || format2 === formats.RFC1738 && (c === 40 || c === 41)) {
              arr[arr.length] = segment.charAt(i);
              continue;
            }
            if (c < 128) {
              arr[arr.length] = hexTable[c];
              continue;
            }
            if (c < 2048) {
              arr[arr.length] = hexTable[192 | c >> 6] + hexTable[128 | c & 63];
              continue;
            }
            if (c < 55296 || c >= 57344) {
              arr[arr.length] = hexTable[224 | c >> 12] + hexTable[128 | c >> 6 & 63] + hexTable[128 | c & 63];
              continue;
            }
            i += 1;
            c = 65536 + ((c & 1023) << 10 | segment.charCodeAt(i) & 1023);
            arr[arr.length] = hexTable[240 | c >> 18] + hexTable[128 | c >> 12 & 63] + hexTable[128 | c >> 6 & 63] + hexTable[128 | c & 63];
          }
          out += arr.join("");
        }
        return out;
      };
      var compact = function compact2(value) {
        var queue2 = [{ obj: { o: value }, prop: "o" }];
        var refs = getSideChannel();
        for (var i = 0; i < queue2.length; ++i) {
          var item = queue2[i];
          var obj = item.obj[item.prop];
          var keys = Object.keys(obj);
          for (var j = 0; j < keys.length; ++j) {
            var key = keys[j];
            var val = obj[key];
            if (typeof val === "object" && val !== null && !refs.has(val)) {
              queue2[queue2.length] = { obj, prop: key };
              refs.set(val, true);
            }
          }
        }
        compactQueue(queue2);
        return value;
      };
      var isRegExp = function isRegExp2(obj) {
        return Object.prototype.toString.call(obj) === "[object RegExp]";
      };
      var isBuffer = function isBuffer2(obj) {
        if (!obj || typeof obj !== "object") {
          return false;
        }
        return !!(obj.constructor && typeof obj.constructor.isBuffer === "function" && obj.constructor.isBuffer(obj));
      };
      var combine = function combine2(a, b, arrayLimit, plainObjects, throwOnLimitExceeded) {
        if (isOverflow(a)) {
          if (throwOnLimitExceeded) {
            throw new RangeError("Array limit exceeded. Only " + arrayLimit + " element" + (arrayLimit === 1 ? "" : "s") + " allowed in an array.");
          }
          var bValues = isArray(b) ? b : [b];
          var newIndex = getMaxIndex(a);
          for (var i = 0; i < bValues.length; ++i) {
            newIndex += 1;
            a[newIndex] = bValues[i];
          }
          setMaxIndex(a, newIndex);
          return a;
        }
        var result = [].concat(a, b);
        if (result.length > arrayLimit) {
          if (throwOnLimitExceeded) {
            throw new RangeError("Array limit exceeded. Only " + arrayLimit + " element" + (arrayLimit === 1 ? "" : "s") + " allowed in an array.");
          }
          return markOverflow(arrayToObject(result, { plainObjects }), result.length - 1);
        }
        return result;
      };
      var maybeMap = function maybeMap2(val, fn) {
        if (isArray(val)) {
          var mapped = [];
          for (var i = 0; i < val.length; i += 1) {
            mapped[mapped.length] = fn(val[i]);
          }
          return mapped;
        }
        return fn(val);
      };
      module.exports = {
        arrayToObject,
        assign,
        combine,
        compact,
        decode,
        encode,
        isBuffer,
        isOverflow,
        isRegExp,
        markOverflow,
        maybeMap,
        merge
      };
    }
  });

  // node_modules/qs/lib/stringify.js
  var require_stringify = __commonJS({
    "node_modules/qs/lib/stringify.js"(exports, module) {
      "use strict";
      var getSideChannel = require_side_channel();
      var utils = require_utils();
      var formats = require_formats();
      var has = Object.prototype.hasOwnProperty;
      var arrayPrefixGenerators = {
        brackets: function brackets(prefix) {
          return prefix + "[]";
        },
        comma: "comma",
        indices: function indices(prefix, key) {
          return prefix + "[" + key + "]";
        },
        repeat: function repeat(prefix) {
          return prefix;
        }
      };
      var isArray = Array.isArray;
      var push = Array.prototype.push;
      var pushToArray = function(arr, valueOrArray) {
        push.apply(arr, isArray(valueOrArray) ? valueOrArray : [valueOrArray]);
      };
      var toISO = Date.prototype.toISOString;
      var defaultFormat = formats["default"];
      var defaults = {
        addQueryPrefix: false,
        allowDots: false,
        allowEmptyArrays: false,
        arrayFormat: "indices",
        charset: "utf-8",
        charsetSentinel: false,
        commaRoundTrip: false,
        delimiter: "&",
        depth: Infinity,
        encode: true,
        encodeDotInKeys: false,
        encoder: utils.encode,
        encodeValuesOnly: false,
        filter: void 0,
        format: defaultFormat,
        formatter: formats.formatters[defaultFormat],
        // deprecated
        indices: false,
        serializeDate: function serializeDate(date) {
          return toISO.call(date);
        },
        skipNulls: false,
        strictNullHandling: false
      };
      var isNonNullishPrimitive = function isNonNullishPrimitive2(v) {
        return typeof v === "string" || typeof v === "number" || typeof v === "boolean" || typeof v === "symbol" || typeof v === "bigint";
      };
      var sentinel = {};
      var stringify = function stringify2(object, prefix, generateArrayPrefix, commaRoundTrip, allowEmptyArrays, strictNullHandling, skipNulls, encodeDotInKeys, encoder, filter2, sort, allowDots, serializeDate, format2, formatter, encodeValuesOnly, charset, sideChannel, depth, currentDepth) {
        var obj = object;
        if (currentDepth > depth) {
          throw new RangeError("Input depth exceeded depth option of " + depth);
        }
        var tmpSc = sideChannel;
        var step = 0;
        var findFlag = false;
        while ((tmpSc = tmpSc.get(sentinel)) !== void 0 && !findFlag) {
          var pos = tmpSc.get(object);
          step += 1;
          if (typeof pos !== "undefined") {
            if (pos === step) {
              throw new RangeError("Cyclic object value");
            } else {
              findFlag = true;
            }
          }
          if (typeof tmpSc.get(sentinel) === "undefined") {
            step = 0;
          }
        }
        obj = typeof filter2 === "function" ? filter2(prefix, obj) : obj;
        if (obj instanceof Date) {
          obj = serializeDate(obj);
        } else if (generateArrayPrefix === "comma" && isArray(obj)) {
          obj = utils.maybeMap(obj, function(value2) {
            if (value2 instanceof Date) {
              return serializeDate(value2);
            }
            return value2;
          });
        }
        if (obj === null) {
          if (strictNullHandling) {
            return formatter(encoder && !encodeValuesOnly ? encoder(prefix, defaults.encoder, charset, "key", format2) : prefix);
          }
          obj = "";
        }
        if (isNonNullishPrimitive(obj) || utils.isBuffer(obj)) {
          if (encoder) {
            var keyValue = encodeValuesOnly ? prefix : encoder(prefix, defaults.encoder, charset, "key", format2);
            return [formatter(keyValue) + "=" + formatter(encoder(obj, defaults.encoder, charset, "value", format2))];
          }
          return [formatter(prefix) + "=" + formatter(String(obj))];
        }
        var values = [];
        if (typeof obj === "undefined") {
          return values;
        }
        var objKeys;
        if (generateArrayPrefix === "comma" && isArray(obj)) {
          if (encodeValuesOnly && encoder) {
            obj = utils.maybeMap(obj, function(v) {
              return v == null ? v : encoder(v);
            });
          }
          objKeys = [{ value: obj.length > 0 ? obj.join(",") || null : void 0 }];
        } else if (isArray(filter2)) {
          objKeys = filter2;
        } else {
          var keys = Object.keys(obj);
          objKeys = sort ? keys.sort(sort) : keys;
        }
        var encodedPrefix = encodeDotInKeys ? String(prefix).replace(/\./g, "%2E") : String(prefix);
        var adjustedPrefix = commaRoundTrip && isArray(obj) && obj.length === 1 ? encodedPrefix + "[]" : encodedPrefix;
        if (allowEmptyArrays && isArray(obj) && obj.length === 0 && Object.keys(obj).length === 0) {
          return adjustedPrefix + "[]";
        }
        for (var j = 0; j < objKeys.length; ++j) {
          var key = objKeys[j];
          var value = typeof key === "object" && key && typeof key.value !== "undefined" ? key.value : obj[key];
          if (skipNulls && value === null) {
            continue;
          }
          var encodedKey = allowDots && encodeDotInKeys ? String(key).replace(/\./g, "%2E") : String(key);
          var keyPrefix = isArray(obj) ? typeof generateArrayPrefix === "function" ? generateArrayPrefix(adjustedPrefix, encodedKey) : adjustedPrefix : adjustedPrefix + (allowDots ? "." + encodedKey : "[" + encodedKey + "]");
          sideChannel.set(object, step);
          var valueSideChannel = getSideChannel();
          valueSideChannel.set(sentinel, sideChannel);
          pushToArray(values, stringify2(
            value,
            keyPrefix,
            generateArrayPrefix,
            commaRoundTrip,
            allowEmptyArrays,
            strictNullHandling,
            skipNulls,
            encodeDotInKeys,
            generateArrayPrefix === "comma" && encodeValuesOnly && isArray(obj) ? null : encoder,
            filter2,
            sort,
            allowDots,
            serializeDate,
            format2,
            formatter,
            encodeValuesOnly,
            charset,
            valueSideChannel,
            depth,
            currentDepth + 1
          ));
        }
        return values;
      };
      var normalizeStringifyOptions = function normalizeStringifyOptions2(opts) {
        if (!opts) {
          return defaults;
        }
        if (typeof opts.allowEmptyArrays !== "undefined" && typeof opts.allowEmptyArrays !== "boolean") {
          throw new TypeError("`allowEmptyArrays` option can only be `true` or `false`, when provided");
        }
        if (typeof opts.encodeDotInKeys !== "undefined" && typeof opts.encodeDotInKeys !== "boolean") {
          throw new TypeError("`encodeDotInKeys` option can only be `true` or `false`, when provided");
        }
        if (opts.encoder !== null && typeof opts.encoder !== "undefined" && typeof opts.encoder !== "function") {
          throw new TypeError("Encoder has to be a function.");
        }
        var charset = opts.charset || defaults.charset;
        if (typeof opts.charset !== "undefined" && opts.charset !== "utf-8" && opts.charset !== "iso-8859-1") {
          throw new TypeError("The charset option must be either utf-8, iso-8859-1, or undefined");
        }
        var format2 = formats["default"];
        if (typeof opts.format !== "undefined") {
          if (!has.call(formats.formatters, opts.format)) {
            throw new TypeError("Unknown format option provided.");
          }
          format2 = opts.format;
        }
        var formatter = formats.formatters[format2];
        var filter2 = defaults.filter;
        if (typeof opts.filter === "function" || isArray(opts.filter)) {
          filter2 = opts.filter;
        }
        var arrayFormat;
        if (opts.arrayFormat in arrayPrefixGenerators) {
          arrayFormat = opts.arrayFormat;
        } else if ("indices" in opts) {
          arrayFormat = opts.indices ? "indices" : "repeat";
        } else {
          arrayFormat = defaults.arrayFormat;
        }
        if ("commaRoundTrip" in opts && typeof opts.commaRoundTrip !== "boolean") {
          throw new TypeError("`commaRoundTrip` must be a boolean, or absent");
        }
        var allowDots = typeof opts.allowDots === "undefined" ? opts.encodeDotInKeys === true ? true : defaults.allowDots : !!opts.allowDots;
        return {
          addQueryPrefix: typeof opts.addQueryPrefix === "boolean" ? opts.addQueryPrefix : defaults.addQueryPrefix,
          allowDots,
          allowEmptyArrays: typeof opts.allowEmptyArrays === "boolean" ? !!opts.allowEmptyArrays : defaults.allowEmptyArrays,
          arrayFormat,
          charset,
          charsetSentinel: typeof opts.charsetSentinel === "boolean" ? opts.charsetSentinel : defaults.charsetSentinel,
          commaRoundTrip: !!opts.commaRoundTrip,
          delimiter: typeof opts.delimiter === "undefined" ? defaults.delimiter : opts.delimiter,
          depth: typeof opts.depth === "number" ? opts.depth : defaults.depth,
          encode: typeof opts.encode === "boolean" ? opts.encode : defaults.encode,
          encodeDotInKeys: typeof opts.encodeDotInKeys === "boolean" ? opts.encodeDotInKeys : defaults.encodeDotInKeys,
          encoder: typeof opts.encoder === "function" ? opts.encoder : defaults.encoder,
          encodeValuesOnly: typeof opts.encodeValuesOnly === "boolean" ? opts.encodeValuesOnly : defaults.encodeValuesOnly,
          filter: filter2,
          format: format2,
          formatter,
          serializeDate: typeof opts.serializeDate === "function" ? opts.serializeDate : defaults.serializeDate,
          skipNulls: typeof opts.skipNulls === "boolean" ? opts.skipNulls : defaults.skipNulls,
          sort: typeof opts.sort === "function" ? opts.sort : null,
          strictNullHandling: typeof opts.strictNullHandling === "boolean" ? opts.strictNullHandling : defaults.strictNullHandling
        };
      };
      module.exports = function(object, opts) {
        var obj = object;
        var options = normalizeStringifyOptions(opts);
        var objKeys;
        var filter2;
        if (typeof options.filter === "function") {
          filter2 = options.filter;
          obj = filter2("", obj);
        } else if (isArray(options.filter)) {
          filter2 = options.filter;
          objKeys = filter2;
        }
        var keys = [];
        if (typeof obj !== "object" || obj === null) {
          return "";
        }
        var generateArrayPrefix = arrayPrefixGenerators[options.arrayFormat];
        var commaRoundTrip = generateArrayPrefix === "comma" && options.commaRoundTrip;
        if (!objKeys) {
          objKeys = Object.keys(obj);
        }
        if (options.sort) {
          objKeys.sort(options.sort);
        }
        var sideChannel = getSideChannel();
        for (var i = 0; i < objKeys.length; ++i) {
          var key = objKeys[i];
          if (typeof key === "undefined" || key === null) {
            continue;
          }
          var value = obj[key];
          if (options.skipNulls && value === null) {
            continue;
          }
          var encodedKey = options.encodeDotInKeys ? String(key).replace(/\./g, "%2E") : String(key);
          pushToArray(keys, stringify(
            value,
            encodedKey,
            generateArrayPrefix,
            commaRoundTrip,
            options.allowEmptyArrays,
            options.strictNullHandling,
            options.skipNulls,
            options.encodeDotInKeys,
            options.encode ? options.encoder : null,
            options.filter,
            options.sort,
            options.allowDots,
            options.serializeDate,
            options.format,
            options.formatter,
            options.encodeValuesOnly,
            options.charset,
            sideChannel,
            options.depth,
            0
          ));
        }
        var joined = keys.join(options.delimiter);
        var prefix = options.addQueryPrefix === true ? "?" : "";
        if (options.charsetSentinel) {
          if (options.charset === "iso-8859-1") {
            prefix += "utf8=%26%2310003%3B" + options.delimiter;
          } else {
            prefix += "utf8=%E2%9C%93" + options.delimiter;
          }
        }
        return joined.length > 0 ? prefix + joined : "";
      };
    }
  });

  // node_modules/qs/lib/parse.js
  var require_parse = __commonJS({
    "node_modules/qs/lib/parse.js"(exports, module) {
      "use strict";
      var utils = require_utils();
      var has = Object.prototype.hasOwnProperty;
      var isArray = Array.isArray;
      var defaults = {
        allowDots: false,
        allowEmptyArrays: false,
        allowPrototypes: false,
        allowSparse: false,
        arrayLimit: 20,
        charset: "utf-8",
        charsetSentinel: false,
        comma: false,
        decodeDotInKeys: false,
        decoder: utils.decode,
        delimiter: "&",
        depth: 5,
        duplicates: "combine",
        ignoreQueryPrefix: false,
        interpretNumericEntities: false,
        parameterLimit: 1e3,
        parseArrays: true,
        plainObjects: false,
        strictDepth: false,
        strictMerge: true,
        strictNullHandling: false,
        throwOnLimitExceeded: false
      };
      var interpretNumericEntities = function(str) {
        return str.replace(/&#(\d+);/g, function($0, numberStr) {
          return String.fromCharCode(parseInt(numberStr, 10));
        });
      };
      var parseArrayValue = function(val, options, currentArrayLength) {
        if (val && typeof val === "string" && options.comma && val.indexOf(",") > -1) {
          if (options.throwOnLimitExceeded) {
            var commaCount = 0;
            var commaIndex = val.indexOf(",");
            while (commaIndex > -1) {
              commaCount += 1;
              if (commaCount >= options.arrayLimit) {
                throw new RangeError("Array limit exceeded. Only " + options.arrayLimit + " element" + (options.arrayLimit === 1 ? "" : "s") + " allowed in an array.");
              }
              commaIndex = val.indexOf(",", commaIndex + 1);
            }
          }
          return val.split(",");
        }
        if (options.throwOnLimitExceeded && currentArrayLength >= options.arrayLimit) {
          throw new RangeError("Array limit exceeded. Only " + options.arrayLimit + " element" + (options.arrayLimit === 1 ? "" : "s") + " allowed in an array.");
        }
        return val;
      };
      var isoSentinel = "utf8=%26%2310003%3B";
      var charsetSentinel = "utf8=%E2%9C%93";
      var parseValues = function parseQueryStringValues(str, options) {
        var obj = { __proto__: null };
        var cleanStr = options.ignoreQueryPrefix ? str.replace(/^\?/, "") : str;
        cleanStr = cleanStr.replace(/%5B/gi, "[").replace(/%5D/gi, "]");
        var limit = options.parameterLimit === Infinity ? void 0 : options.parameterLimit;
        var parts = cleanStr.split(
          options.delimiter,
          options.throwOnLimitExceeded && typeof limit !== "undefined" ? limit + 1 : limit
        );
        if (options.throwOnLimitExceeded && typeof limit !== "undefined" && parts.length > limit) {
          throw new RangeError("Parameter limit exceeded. Only " + limit + " parameter" + (limit === 1 ? "" : "s") + " allowed.");
        }
        var skipIndex = -1;
        var i;
        var charset = options.charset;
        if (options.charsetSentinel) {
          for (i = 0; i < parts.length; ++i) {
            if (parts[i].indexOf("utf8=") === 0) {
              if (parts[i] === charsetSentinel) {
                charset = "utf-8";
              } else if (parts[i] === isoSentinel) {
                charset = "iso-8859-1";
              }
              skipIndex = i;
              i = parts.length;
            }
          }
        }
        for (i = 0; i < parts.length; ++i) {
          if (i === skipIndex) {
            continue;
          }
          var part = parts[i];
          var bracketEqualsPos = part.indexOf("]=");
          var pos = bracketEqualsPos === -1 ? part.indexOf("=") : bracketEqualsPos + 1;
          var key;
          var val;
          if (pos === -1) {
            key = options.decoder(part, defaults.decoder, charset, "key");
            val = options.strictNullHandling ? null : "";
          } else {
            key = options.decoder(part.slice(0, pos), defaults.decoder, charset, "key");
            if (key !== null) {
              val = utils.maybeMap(
                parseArrayValue(
                  part.slice(pos + 1),
                  options,
                  isArray(obj[key]) ? obj[key].length : 0
                ),
                function(encodedVal) {
                  return options.decoder(encodedVal, defaults.decoder, charset, "value");
                }
              );
            }
          }
          if (val && options.interpretNumericEntities && charset === "iso-8859-1") {
            val = interpretNumericEntities(String(val));
          }
          if (part.indexOf("[]=") > -1) {
            val = isArray(val) ? [val] : val;
          }
          if (options.comma && isArray(val) && val.length > options.arrayLimit) {
            val = utils.combine([], val, options.arrayLimit, options.plainObjects, options.throwOnLimitExceeded);
          }
          if (key !== null) {
            var existing = has.call(obj, key);
            if (existing && (options.duplicates === "combine" || part.indexOf("[]=") > -1)) {
              obj[key] = utils.combine(
                obj[key],
                val,
                options.arrayLimit,
                options.plainObjects,
                options.throwOnLimitExceeded
              );
            } else if (!existing || options.duplicates === "last") {
              obj[key] = val;
            }
          }
        }
        return obj;
      };
      var parseObject = function(chain, val, options, valuesParsed) {
        var currentArrayLength = 0;
        if (chain.length > 0 && chain[chain.length - 1] === "[]") {
          var parentKey = chain.slice(0, -1).join("");
          currentArrayLength = Array.isArray(val) && val[parentKey] ? val[parentKey].length : 0;
        }
        var leaf = valuesParsed ? val : parseArrayValue(val, options, currentArrayLength);
        for (var i = chain.length - 1; i >= 0; --i) {
          var obj;
          var root = chain[i];
          if (root === "[]" && options.parseArrays) {
            if (utils.isOverflow(leaf)) {
              obj = leaf;
            } else {
              obj = options.allowEmptyArrays && (leaf === "" || options.strictNullHandling && leaf === null) ? [] : utils.combine(
                [],
                leaf,
                options.arrayLimit,
                options.plainObjects,
                options.throwOnLimitExceeded
              );
            }
          } else {
            obj = options.plainObjects ? { __proto__: null } : {};
            var cleanRoot = root.charAt(0) === "[" && root.charAt(root.length - 1) === "]" ? root.slice(1, -1) : root;
            var decodedRoot = options.decodeDotInKeys ? cleanRoot.replace(/%2E/g, ".") : cleanRoot;
            var index = parseInt(decodedRoot, 10);
            var isValidArrayIndex = !isNaN(index) && root !== decodedRoot && String(index) === decodedRoot && index >= 0 && options.parseArrays;
            if (!options.parseArrays && decodedRoot === "") {
              obj = { 0: leaf };
            } else if (isValidArrayIndex && index < options.arrayLimit) {
              obj = [];
              obj[index] = leaf;
            } else if (isValidArrayIndex && options.throwOnLimitExceeded) {
              throw new RangeError("Array limit exceeded. Only " + options.arrayLimit + " element" + (options.arrayLimit === 1 ? "" : "s") + " allowed in an array.");
            } else if (isValidArrayIndex) {
              obj[index] = leaf;
              utils.markOverflow(obj, index);
            } else if (decodedRoot !== "__proto__") {
              obj[decodedRoot] = leaf;
            }
          }
          leaf = obj;
        }
        return leaf;
      };
      var splitKeyIntoSegments = function splitKeyIntoSegments2(originalKey, options) {
        var key = options.allowDots ? originalKey.replace(/\.([^.[]+)/g, "[$1]") : originalKey;
        if (options.depth <= 0) {
          if (!options.plainObjects && has.call(Object.prototype, key)) {
            if (!options.allowPrototypes) {
              return;
            }
          }
          return [key];
        }
        var segments = [];
        var first = key.indexOf("[");
        var parent = first >= 0 ? key.slice(0, first) : key;
        if (parent) {
          if (!options.plainObjects && has.call(Object.prototype, parent)) {
            if (!options.allowPrototypes) {
              return;
            }
          }
          segments[segments.length] = parent;
        }
        var n = key.length;
        var open = first;
        var collected = 0;
        while (open >= 0 && collected < options.depth) {
          var level = 1;
          var i = open + 1;
          var close = -1;
          while (i < n && close < 0) {
            var cu = key.charCodeAt(i);
            if (cu === 91) {
              level += 1;
            } else if (cu === 93) {
              level -= 1;
              if (level === 0) {
                close = i;
              }
            }
            i += 1;
          }
          if (close < 0) {
            segments[segments.length] = "[" + key.slice(open) + "]";
            return segments;
          }
          var seg = key.slice(open, close + 1);
          var content = seg.slice(1, -1);
          if (!options.plainObjects && has.call(Object.prototype, content) && !options.allowPrototypes) {
            return;
          }
          segments[segments.length] = seg;
          collected += 1;
          open = key.indexOf("[", close + 1);
        }
        if (open >= 0) {
          if (options.strictDepth === true) {
            throw new RangeError("Input depth exceeded depth option of " + options.depth + " and strictDepth is true");
          }
          segments[segments.length] = "[" + key.slice(open) + "]";
        }
        return segments;
      };
      var parseKeys = function parseQueryStringKeys(givenKey, val, options, valuesParsed) {
        if (!givenKey) {
          return;
        }
        var keys = splitKeyIntoSegments(givenKey, options);
        if (!keys) {
          return;
        }
        return parseObject(keys, val, options, valuesParsed);
      };
      var normalizeParseOptions = function normalizeParseOptions2(opts) {
        if (!opts) {
          return defaults;
        }
        if (typeof opts.allowEmptyArrays !== "undefined" && typeof opts.allowEmptyArrays !== "boolean") {
          throw new TypeError("`allowEmptyArrays` option can only be `true` or `false`, when provided");
        }
        if (typeof opts.decodeDotInKeys !== "undefined" && typeof opts.decodeDotInKeys !== "boolean") {
          throw new TypeError("`decodeDotInKeys` option can only be `true` or `false`, when provided");
        }
        if (opts.decoder !== null && typeof opts.decoder !== "undefined" && typeof opts.decoder !== "function") {
          throw new TypeError("Decoder has to be a function.");
        }
        if (typeof opts.charset !== "undefined" && opts.charset !== "utf-8" && opts.charset !== "iso-8859-1") {
          throw new TypeError("The charset option must be either utf-8, iso-8859-1, or undefined");
        }
        if (typeof opts.throwOnLimitExceeded !== "undefined" && typeof opts.throwOnLimitExceeded !== "boolean") {
          throw new TypeError("`throwOnLimitExceeded` option must be a boolean");
        }
        var charset = typeof opts.charset === "undefined" ? defaults.charset : opts.charset;
        var duplicates = typeof opts.duplicates === "undefined" ? defaults.duplicates : opts.duplicates;
        if (duplicates !== "combine" && duplicates !== "first" && duplicates !== "last") {
          throw new TypeError("The duplicates option must be either combine, first, or last");
        }
        var allowDots = typeof opts.allowDots === "undefined" ? opts.decodeDotInKeys === true ? true : defaults.allowDots : !!opts.allowDots;
        return {
          allowDots,
          allowEmptyArrays: typeof opts.allowEmptyArrays === "boolean" ? !!opts.allowEmptyArrays : defaults.allowEmptyArrays,
          allowPrototypes: typeof opts.allowPrototypes === "boolean" ? opts.allowPrototypes : defaults.allowPrototypes,
          allowSparse: typeof opts.allowSparse === "boolean" ? opts.allowSparse : defaults.allowSparse,
          arrayLimit: typeof opts.arrayLimit === "number" ? opts.arrayLimit : defaults.arrayLimit,
          charset,
          charsetSentinel: typeof opts.charsetSentinel === "boolean" ? opts.charsetSentinel : defaults.charsetSentinel,
          comma: typeof opts.comma === "boolean" ? opts.comma : defaults.comma,
          decodeDotInKeys: typeof opts.decodeDotInKeys === "boolean" ? opts.decodeDotInKeys : defaults.decodeDotInKeys,
          decoder: typeof opts.decoder === "function" ? opts.decoder : defaults.decoder,
          delimiter: typeof opts.delimiter === "string" || utils.isRegExp(opts.delimiter) ? opts.delimiter : defaults.delimiter,
          // eslint-disable-next-line no-implicit-coercion, no-extra-parens
          depth: typeof opts.depth === "number" || opts.depth === false ? +opts.depth : defaults.depth,
          duplicates,
          ignoreQueryPrefix: opts.ignoreQueryPrefix === true,
          interpretNumericEntities: typeof opts.interpretNumericEntities === "boolean" ? opts.interpretNumericEntities : defaults.interpretNumericEntities,
          parameterLimit: typeof opts.parameterLimit === "number" ? opts.parameterLimit : defaults.parameterLimit,
          parseArrays: opts.parseArrays !== false,
          plainObjects: typeof opts.plainObjects === "boolean" ? opts.plainObjects : defaults.plainObjects,
          strictDepth: typeof opts.strictDepth === "boolean" ? !!opts.strictDepth : defaults.strictDepth,
          strictMerge: typeof opts.strictMerge === "boolean" ? !!opts.strictMerge : defaults.strictMerge,
          strictNullHandling: typeof opts.strictNullHandling === "boolean" ? opts.strictNullHandling : defaults.strictNullHandling,
          throwOnLimitExceeded: typeof opts.throwOnLimitExceeded === "boolean" ? opts.throwOnLimitExceeded : false
        };
      };
      module.exports = function(str, opts) {
        var options = normalizeParseOptions(opts);
        if (str === "" || str === null || typeof str === "undefined") {
          return options.plainObjects ? { __proto__: null } : {};
        }
        var tempObj = typeof str === "string" ? parseValues(str, options) : str;
        var obj = options.plainObjects ? { __proto__: null } : {};
        var keys = Object.keys(tempObj);
        for (var i = 0; i < keys.length; ++i) {
          var key = keys[i];
          var newObj = parseKeys(key, tempObj[key], options, typeof str === "string");
          obj = utils.merge(obj, newObj, options);
        }
        if (options.allowSparse === true) {
          return obj;
        }
        return utils.compact(obj);
      };
    }
  });

  // node_modules/qs/lib/index.js
  var require_lib4 = __commonJS({
    "node_modules/qs/lib/index.js"(exports, module) {
      "use strict";
      var stringify = require_stringify();
      var parse2 = require_parse();
      var formats = require_formats();
      module.exports = {
        formats,
        parse: parse2,
        stringify
      };
    }
  });

  // node_modules/node-stdlib-browser/esm/proxy/url.js
  var url_exports = {};
  __export(url_exports, {
    URL: () => URL,
    URLSearchParams: () => URLSearchParams,
    Url: () => UrlImport,
    default: () => api2,
    domainToASCII: () => domainToASCII,
    domainToUnicode: () => domainToUnicode,
    fileURLToPath: () => fileURLToPath,
    format: () => formatImportWithOverloads,
    parse: () => parseImport,
    pathToFileURL: () => pathToFileURL,
    resolve: () => resolveImport,
    resolveObject: () => resolveObject
  });
  function Url() {
    this.protocol = null;
    this.slashes = null;
    this.auth = null;
    this.host = null;
    this.port = null;
    this.hostname = null;
    this.hash = null;
    this.search = null;
    this.query = null;
    this.pathname = null;
    this.path = null;
    this.href = null;
  }
  function urlParse(url, parseQueryString, slashesDenoteHost) {
    if (url && typeof url === "object" && url instanceof Url) {
      return url;
    }
    var u = new Url();
    u.parse(url, parseQueryString, slashesDenoteHost);
    return u;
  }
  function urlFormat(obj) {
    if (typeof obj === "string") {
      obj = urlParse(obj);
    }
    if (!(obj instanceof Url)) {
      return Url.prototype.format.call(obj);
    }
    return obj.format();
  }
  function urlResolve(source, relative) {
    return urlParse(source, false, true).resolve(relative);
  }
  function urlResolveObject(source, relative) {
    if (!source) {
      return relative;
    }
    return urlParse(source, false, true).resolveObject(relative);
  }
  function normalizeArray(parts, allowAboveRoot) {
    var up = 0;
    for (var i = parts.length - 1; i >= 0; i--) {
      var last = parts[i];
      if (last === ".") {
        parts.splice(i, 1);
      } else if (last === "..") {
        parts.splice(i, 1);
        up++;
      } else if (up) {
        parts.splice(i, 1);
        up--;
      }
    }
    if (allowAboveRoot) {
      for (; up--; up) {
        parts.unshift("..");
      }
    }
    return parts;
  }
  function resolve() {
    var resolvedPath = "", resolvedAbsolute = false;
    for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path2 = i >= 0 ? arguments[i] : "/";
      if (typeof path2 !== "string") {
        throw new TypeError("Arguments to path.resolve must be strings");
      } else if (!path2) {
        continue;
      }
      resolvedPath = path2 + "/" + resolvedPath;
      resolvedAbsolute = path2.charAt(0) === "/";
    }
    resolvedPath = normalizeArray(filter(resolvedPath.split("/"), function(p) {
      return !!p;
    }), !resolvedAbsolute).join("/");
    return (resolvedAbsolute ? "/" : "") + resolvedPath || ".";
  }
  function filter(xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
      if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
  }
  function isURLInstance(instance) {
    var resolved = (
      /** @type {URL|null} */
      instance != null ? instance : null
    );
    return Boolean(resolved !== null && (resolved == null ? void 0 : resolved.href) && (resolved == null ? void 0 : resolved.origin));
  }
  function getPathFromURLPosix(url) {
    if (url.hostname !== "") {
      throw new TypeError('File URL host must be "localhost" or empty on browser');
    }
    var pathname = url.pathname;
    for (var n = 0; n < pathname.length; n++) {
      if (pathname[n] === "%") {
        var third = pathname.codePointAt(n + 2) | 32;
        if (pathname[n + 1] === "2" && third === 102) {
          throw new TypeError("File URL path must not include encoded / characters");
        }
      }
    }
    return decodeURIComponent(pathname);
  }
  function encodePathChars(filepath) {
    if (filepath.includes("%")) {
      filepath = filepath.replace(percentRegEx, "%25");
    }
    if (filepath.includes("\\")) {
      filepath = filepath.replace(backslashRegEx, "%5C");
    }
    if (filepath.includes("\n")) {
      filepath = filepath.replace(newlineRegEx, "%0A");
    }
    if (filepath.includes("\r")) {
      filepath = filepath.replace(carriageReturnRegEx, "%0D");
    }
    if (filepath.includes("	")) {
      filepath = filepath.replace(tabRegEx, "%09");
    }
    return filepath;
  }
  var import_punycode, import_qs, punycode, protocolPattern, portPattern, simplePathPattern, delims, unwise, autoEscape, nonHostChars, hostEndingChars, hostnameMaxLen, hostnamePartPattern, hostnamePartStart, unsafeProtocol, hostlessProtocol, slashedProtocol, querystring, parse, resolve$1, resolveObject, format, Url_1, _globalThis, formatImport, parseImport, resolveImport, UrlImport, URL, URLSearchParams, percentRegEx, backslashRegEx, newlineRegEx, carriageReturnRegEx, tabRegEx, CHAR_FORWARD_SLASH, domainToASCII, domainToUnicode, pathToFileURL, fileURLToPath, formatImportWithOverloads, api2;
  var init_url = __esm({
    "node_modules/node-stdlib-browser/esm/proxy/url.js"() {
      import_punycode = __toESM(require_punycode());
      import_qs = __toESM(require_lib4());
      punycode = import_punycode.default;
      protocolPattern = /^([a-z0-9.+-]+:)/i;
      portPattern = /:[0-9]*$/;
      simplePathPattern = /^(\/\/?(?!\/)[^?\s]*)(\?[^\s]*)?$/;
      delims = [
        "<",
        ">",
        '"',
        "`",
        " ",
        "\r",
        "\n",
        "	"
      ];
      unwise = [
        "{",
        "}",
        "|",
        "\\",
        "^",
        "`"
      ].concat(delims);
      autoEscape = ["'"].concat(unwise);
      nonHostChars = [
        "%",
        "/",
        "?",
        ";",
        "#"
      ].concat(autoEscape);
      hostEndingChars = [
        "/",
        "?",
        "#"
      ];
      hostnameMaxLen = 255;
      hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/;
      hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/;
      unsafeProtocol = {
        javascript: true,
        "javascript:": true
      };
      hostlessProtocol = {
        javascript: true,
        "javascript:": true
      };
      slashedProtocol = {
        http: true,
        https: true,
        ftp: true,
        gopher: true,
        file: true,
        "http:": true,
        "https:": true,
        "ftp:": true,
        "gopher:": true,
        "file:": true
      };
      querystring = import_qs.default;
      Url.prototype.parse = function(url, parseQueryString, slashesDenoteHost) {
        if (typeof url !== "string") {
          throw new TypeError("Parameter 'url' must be a string, not " + typeof url);
        }
        var queryIndex = url.indexOf("?"), splitter = queryIndex !== -1 && queryIndex < url.indexOf("#") ? "?" : "#", uSplit = url.split(splitter), slashRegex = /\\/g;
        uSplit[0] = uSplit[0].replace(slashRegex, "/");
        url = uSplit.join(splitter);
        var rest = url;
        rest = rest.trim();
        if (!slashesDenoteHost && url.split("#").length === 1) {
          var simplePath = simplePathPattern.exec(rest);
          if (simplePath) {
            this.path = rest;
            this.href = rest;
            this.pathname = simplePath[1];
            if (simplePath[2]) {
              this.search = simplePath[2];
              if (parseQueryString) {
                this.query = querystring.parse(this.search.substr(1));
              } else {
                this.query = this.search.substr(1);
              }
            } else if (parseQueryString) {
              this.search = "";
              this.query = {};
            }
            return this;
          }
        }
        var proto = protocolPattern.exec(rest);
        if (proto) {
          proto = proto[0];
          var lowerProto = proto.toLowerCase();
          this.protocol = lowerProto;
          rest = rest.substr(proto.length);
        }
        if (slashesDenoteHost || proto || rest.match(/^\/\/[^@/]+@[^@/]+/)) {
          var slashes = rest.substr(0, 2) === "//";
          if (slashes && !(proto && hostlessProtocol[proto])) {
            rest = rest.substr(2);
            this.slashes = true;
          }
        }
        if (!hostlessProtocol[proto] && (slashes || proto && !slashedProtocol[proto])) {
          var hostEnd = -1;
          for (var i = 0; i < hostEndingChars.length; i++) {
            var hec = rest.indexOf(hostEndingChars[i]);
            if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) {
              hostEnd = hec;
            }
          }
          var auth, atSign;
          if (hostEnd === -1) {
            atSign = rest.lastIndexOf("@");
          } else {
            atSign = rest.lastIndexOf("@", hostEnd);
          }
          if (atSign !== -1) {
            auth = rest.slice(0, atSign);
            rest = rest.slice(atSign + 1);
            this.auth = decodeURIComponent(auth);
          }
          hostEnd = -1;
          for (var i = 0; i < nonHostChars.length; i++) {
            var hec = rest.indexOf(nonHostChars[i]);
            if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) {
              hostEnd = hec;
            }
          }
          if (hostEnd === -1) {
            hostEnd = rest.length;
          }
          this.host = rest.slice(0, hostEnd);
          rest = rest.slice(hostEnd);
          this.parseHost();
          this.hostname = this.hostname || "";
          var ipv6Hostname = this.hostname[0] === "[" && this.hostname[this.hostname.length - 1] === "]";
          if (!ipv6Hostname) {
            var hostparts = this.hostname.split(/\./);
            for (var i = 0, l = hostparts.length; i < l; i++) {
              var part = hostparts[i];
              if (!part) {
                continue;
              }
              if (!part.match(hostnamePartPattern)) {
                var newpart = "";
                for (var j = 0, k = part.length; j < k; j++) {
                  if (part.charCodeAt(j) > 127) {
                    newpart += "x";
                  } else {
                    newpart += part[j];
                  }
                }
                if (!newpart.match(hostnamePartPattern)) {
                  var validParts = hostparts.slice(0, i);
                  var notHost = hostparts.slice(i + 1);
                  var bit = part.match(hostnamePartStart);
                  if (bit) {
                    validParts.push(bit[1]);
                    notHost.unshift(bit[2]);
                  }
                  if (notHost.length) {
                    rest = "/" + notHost.join(".") + rest;
                  }
                  this.hostname = validParts.join(".");
                  break;
                }
              }
            }
          }
          if (this.hostname.length > hostnameMaxLen) {
            this.hostname = "";
          } else {
            this.hostname = this.hostname.toLowerCase();
          }
          if (!ipv6Hostname) {
            this.hostname = punycode.toASCII(this.hostname);
          }
          var p = this.port ? ":" + this.port : "";
          var h = this.hostname || "";
          this.host = h + p;
          this.href += this.host;
          if (ipv6Hostname) {
            this.hostname = this.hostname.substr(1, this.hostname.length - 2);
            if (rest[0] !== "/") {
              rest = "/" + rest;
            }
          }
        }
        if (!unsafeProtocol[lowerProto]) {
          for (var i = 0, l = autoEscape.length; i < l; i++) {
            var ae = autoEscape[i];
            if (rest.indexOf(ae) === -1) {
              continue;
            }
            var esc = encodeURIComponent(ae);
            if (esc === ae) {
              esc = escape(ae);
            }
            rest = rest.split(ae).join(esc);
          }
        }
        var hash = rest.indexOf("#");
        if (hash !== -1) {
          this.hash = rest.substr(hash);
          rest = rest.slice(0, hash);
        }
        var qm = rest.indexOf("?");
        if (qm !== -1) {
          this.search = rest.substr(qm);
          this.query = rest.substr(qm + 1);
          if (parseQueryString) {
            this.query = querystring.parse(this.query);
          }
          rest = rest.slice(0, qm);
        } else if (parseQueryString) {
          this.search = "";
          this.query = {};
        }
        if (rest) {
          this.pathname = rest;
        }
        if (slashedProtocol[lowerProto] && this.hostname && !this.pathname) {
          this.pathname = "/";
        }
        if (this.pathname || this.search) {
          var p = this.pathname || "";
          var s = this.search || "";
          this.path = p + s;
        }
        this.href = this.format();
        return this;
      };
      Url.prototype.format = function() {
        var auth = this.auth || "";
        if (auth) {
          auth = encodeURIComponent(auth);
          auth = auth.replace(/%3A/i, ":");
          auth += "@";
        }
        var protocol = this.protocol || "", pathname = this.pathname || "", hash = this.hash || "", host = false, query = "";
        if (this.host) {
          host = auth + this.host;
        } else if (this.hostname) {
          host = auth + (this.hostname.indexOf(":") === -1 ? this.hostname : "[" + this.hostname + "]");
          if (this.port) {
            host += ":" + this.port;
          }
        }
        if (this.query && typeof this.query === "object" && Object.keys(this.query).length) {
          query = querystring.stringify(this.query, {
            arrayFormat: "repeat",
            addQueryPrefix: false
          });
        }
        var search = this.search || query && "?" + query || "";
        if (protocol && protocol.substr(-1) !== ":") {
          protocol += ":";
        }
        if (this.slashes || (!protocol || slashedProtocol[protocol]) && host !== false) {
          host = "//" + (host || "");
          if (pathname && pathname.charAt(0) !== "/") {
            pathname = "/" + pathname;
          }
        } else if (!host) {
          host = "";
        }
        if (hash && hash.charAt(0) !== "#") {
          hash = "#" + hash;
        }
        if (search && search.charAt(0) !== "?") {
          search = "?" + search;
        }
        pathname = pathname.replace(/[?#]/g, function(match) {
          return encodeURIComponent(match);
        });
        search = search.replace("#", "%23");
        return protocol + host + pathname + search + hash;
      };
      Url.prototype.resolve = function(relative) {
        return this.resolveObject(urlParse(relative, false, true)).format();
      };
      Url.prototype.resolveObject = function(relative) {
        if (typeof relative === "string") {
          var rel = new Url();
          rel.parse(relative, false, true);
          relative = rel;
        }
        var result = new Url();
        var tkeys = Object.keys(this);
        for (var tk = 0; tk < tkeys.length; tk++) {
          var tkey = tkeys[tk];
          result[tkey] = this[tkey];
        }
        result.hash = relative.hash;
        if (relative.href === "") {
          result.href = result.format();
          return result;
        }
        if (relative.slashes && !relative.protocol) {
          var rkeys = Object.keys(relative);
          for (var rk = 0; rk < rkeys.length; rk++) {
            var rkey = rkeys[rk];
            if (rkey !== "protocol") {
              result[rkey] = relative[rkey];
            }
          }
          if (slashedProtocol[result.protocol] && result.hostname && !result.pathname) {
            result.pathname = "/";
            result.path = result.pathname;
          }
          result.href = result.format();
          return result;
        }
        if (relative.protocol && relative.protocol !== result.protocol) {
          if (!slashedProtocol[relative.protocol]) {
            var keys = Object.keys(relative);
            for (var v = 0; v < keys.length; v++) {
              var k = keys[v];
              result[k] = relative[k];
            }
            result.href = result.format();
            return result;
          }
          result.protocol = relative.protocol;
          if (!relative.host && !hostlessProtocol[relative.protocol]) {
            var relPath = (relative.pathname || "").split("/");
            while (relPath.length && !(relative.host = relPath.shift())) {
            }
            if (!relative.host) {
              relative.host = "";
            }
            if (!relative.hostname) {
              relative.hostname = "";
            }
            if (relPath[0] !== "") {
              relPath.unshift("");
            }
            if (relPath.length < 2) {
              relPath.unshift("");
            }
            result.pathname = relPath.join("/");
          } else {
            result.pathname = relative.pathname;
          }
          result.search = relative.search;
          result.query = relative.query;
          result.host = relative.host || "";
          result.auth = relative.auth;
          result.hostname = relative.hostname || relative.host;
          result.port = relative.port;
          if (result.pathname || result.search) {
            var p = result.pathname || "";
            var s = result.search || "";
            result.path = p + s;
          }
          result.slashes = result.slashes || relative.slashes;
          result.href = result.format();
          return result;
        }
        var isSourceAbs = result.pathname && result.pathname.charAt(0) === "/", isRelAbs = relative.host || relative.pathname && relative.pathname.charAt(0) === "/", mustEndAbs = isRelAbs || isSourceAbs || result.host && relative.pathname, removeAllDots = mustEndAbs, srcPath = result.pathname && result.pathname.split("/") || [], relPath = relative.pathname && relative.pathname.split("/") || [], psychotic = result.protocol && !slashedProtocol[result.protocol];
        if (psychotic) {
          result.hostname = "";
          result.port = null;
          if (result.host) {
            if (srcPath[0] === "") {
              srcPath[0] = result.host;
            } else {
              srcPath.unshift(result.host);
            }
          }
          result.host = "";
          if (relative.protocol) {
            relative.hostname = null;
            relative.port = null;
            if (relative.host) {
              if (relPath[0] === "") {
                relPath[0] = relative.host;
              } else {
                relPath.unshift(relative.host);
              }
            }
            relative.host = null;
          }
          mustEndAbs = mustEndAbs && (relPath[0] === "" || srcPath[0] === "");
        }
        if (isRelAbs) {
          result.host = relative.host || relative.host === "" ? relative.host : result.host;
          result.hostname = relative.hostname || relative.hostname === "" ? relative.hostname : result.hostname;
          result.search = relative.search;
          result.query = relative.query;
          srcPath = relPath;
        } else if (relPath.length) {
          if (!srcPath) {
            srcPath = [];
          }
          srcPath.pop();
          srcPath = srcPath.concat(relPath);
          result.search = relative.search;
          result.query = relative.query;
        } else if (relative.search != null) {
          if (psychotic) {
            result.host = srcPath.shift();
            result.hostname = result.host;
            var authInHost = result.host && result.host.indexOf("@") > 0 ? result.host.split("@") : false;
            if (authInHost) {
              result.auth = authInHost.shift();
              result.hostname = authInHost.shift();
              result.host = result.hostname;
            }
          }
          result.search = relative.search;
          result.query = relative.query;
          if (result.pathname !== null || result.search !== null) {
            result.path = (result.pathname ? result.pathname : "") + (result.search ? result.search : "");
          }
          result.href = result.format();
          return result;
        }
        if (!srcPath.length) {
          result.pathname = null;
          if (result.search) {
            result.path = "/" + result.search;
          } else {
            result.path = null;
          }
          result.href = result.format();
          return result;
        }
        var last = srcPath.slice(-1)[0];
        var hasTrailingSlash = (result.host || relative.host || srcPath.length > 1) && (last === "." || last === "..") || last === "";
        var up = 0;
        for (var i = srcPath.length; i >= 0; i--) {
          last = srcPath[i];
          if (last === ".") {
            srcPath.splice(i, 1);
          } else if (last === "..") {
            srcPath.splice(i, 1);
            up++;
          } else if (up) {
            srcPath.splice(i, 1);
            up--;
          }
        }
        if (!mustEndAbs && !removeAllDots) {
          for (; up--; up) {
            srcPath.unshift("..");
          }
        }
        if (mustEndAbs && srcPath[0] !== "" && (!srcPath[0] || srcPath[0].charAt(0) !== "/")) {
          srcPath.unshift("");
        }
        if (hasTrailingSlash && srcPath.join("/").substr(-1) !== "/") {
          srcPath.push("");
        }
        var isAbsolute = srcPath[0] === "" || srcPath[0] && srcPath[0].charAt(0) === "/";
        if (psychotic) {
          result.hostname = isAbsolute ? "" : srcPath.length ? srcPath.shift() : "";
          result.host = result.hostname;
          var authInHost = result.host && result.host.indexOf("@") > 0 ? result.host.split("@") : false;
          if (authInHost) {
            result.auth = authInHost.shift();
            result.hostname = authInHost.shift();
            result.host = result.hostname;
          }
        }
        mustEndAbs = mustEndAbs || result.host && srcPath.length;
        if (mustEndAbs && !isAbsolute) {
          srcPath.unshift("");
        }
        if (srcPath.length > 0) {
          result.pathname = srcPath.join("/");
        } else {
          result.pathname = null;
          result.path = null;
        }
        if (result.pathname !== null || result.search !== null) {
          result.path = (result.pathname ? result.pathname : "") + (result.search ? result.search : "");
        }
        result.auth = relative.auth || result.auth;
        result.slashes = result.slashes || relative.slashes;
        result.href = result.format();
        return result;
      };
      Url.prototype.parseHost = function() {
        var host = this.host;
        var port = portPattern.exec(host);
        if (port) {
          port = port[0];
          if (port !== ":") {
            this.port = port.substr(1);
          }
          host = host.substr(0, host.length - port.length);
        }
        if (host) {
          this.hostname = host;
        }
      };
      parse = urlParse;
      resolve$1 = urlResolve;
      resolveObject = urlResolveObject;
      format = urlFormat;
      Url_1 = Url;
      _globalThis = (function(Object2) {
        function get() {
          var _global2 = this || self;
          delete Object2.prototype.__magic__;
          return _global2;
        }
        if (typeof globalThis === "object") {
          return globalThis;
        }
        if (this) {
          return get();
        } else {
          Object2.defineProperty(Object2.prototype, "__magic__", {
            configurable: true,
            get
          });
          var _global = __magic__;
          return _global;
        }
      })(Object);
      formatImport = /** @type {formatImport}*/
      format;
      parseImport = /** @type {parseImport}*/
      parse;
      resolveImport = /** @type {resolveImport}*/
      resolve$1;
      UrlImport = /** @type {UrlImport}*/
      Url_1;
      URL = _globalThis.URL;
      URLSearchParams = _globalThis.URLSearchParams;
      percentRegEx = /%/g;
      backslashRegEx = /\\/g;
      newlineRegEx = /\n/g;
      carriageReturnRegEx = /\r/g;
      tabRegEx = /\t/g;
      CHAR_FORWARD_SLASH = 47;
      domainToASCII = /**
       * @type {domainToASCII}
       */
      function domainToASCII2(domain) {
        if (typeof domain === "undefined") {
          throw new TypeError('The "domain" argument must be specified');
        }
        return new URL("http://" + domain).hostname;
      };
      domainToUnicode = /**
       * @type {domainToUnicode}
       */
      function domainToUnicode2(domain) {
        if (typeof domain === "undefined") {
          throw new TypeError('The "domain" argument must be specified');
        }
        return new URL("http://" + domain).hostname;
      };
      pathToFileURL = /**
       * @type {(url: string) => URL}
       */
      function pathToFileURL2(filepath) {
        var outURL = new URL("file://");
        var resolved = resolve(filepath);
        var filePathLast = filepath.charCodeAt(filepath.length - 1);
        if (filePathLast === CHAR_FORWARD_SLASH && resolved[resolved.length - 1] !== "/") {
          resolved += "/";
        }
        outURL.pathname = encodePathChars(resolved);
        return outURL;
      };
      fileURLToPath = /**
       * @type {fileURLToPath & ((path: string | URL) => string)}
       */
      function fileURLToPath2(path2) {
        if (!isURLInstance(path2) && typeof path2 !== "string") {
          throw new TypeError('The "path" argument must be of type string or an instance of URL. Received type ' + typeof path2 + " (" + path2 + ")");
        }
        var resolved = new URL(path2);
        if (resolved.protocol !== "file:") {
          throw new TypeError("The URL must be of scheme file");
        }
        return getPathFromURLPosix(resolved);
      };
      formatImportWithOverloads = /**
       * @type {(
       *   ((urlObject: URL, options?: URLFormatOptions) => string) &
       *   ((urlObject: UrlObject | string, options?: never) => string)
       * )}
       */
      function formatImportWithOverloads2(urlObject, options) {
        var _options$auth, _options$fragment, _options$search, _options$unicode;
        if (options === void 0) {
          options = {};
        }
        if (!(urlObject instanceof URL)) {
          return formatImport(urlObject);
        }
        if (typeof options !== "object" || options === null) {
          throw new TypeError('The "options" argument must be of type object.');
        }
        var auth = (_options$auth = options.auth) != null ? _options$auth : true;
        var fragment = (_options$fragment = options.fragment) != null ? _options$fragment : true;
        var search = (_options$search = options.search) != null ? _options$search : true;
        (_options$unicode = options.unicode) != null ? _options$unicode : false;
        var parsed = new URL(urlObject.toString());
        if (!auth) {
          parsed.username = "";
          parsed.password = "";
        }
        if (!fragment) {
          parsed.hash = "";
        }
        if (!search) {
          parsed.search = "";
        }
        return parsed.toString();
      };
      api2 = {
        format: formatImportWithOverloads,
        parse: parseImport,
        resolve: resolveImport,
        resolveObject,
        Url: UrlImport,
        URL,
        URLSearchParams,
        domainToASCII,
        domainToUnicode,
        pathToFileURL,
        fileURLToPath
      };
    }
  });

  // node_modules/@jsonjoy.com/fs-node-builtins/lib/url.js
  var require_url = __commonJS({
    "node_modules/@jsonjoy.com/fs-node-builtins/lib/url.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.URL = void 0;
      var node_url_1 = (init_url(), __toCommonJS(url_exports));
      Object.defineProperty(exports, "URL", { enumerable: true, get: function() {
        return node_url_1.URL;
      } });
    }
  });

  // node_modules/@jsonjoy.com/fs-node/lib/readWriteArgs.js
  var require_readWriteArgs = __commonJS({
    "node_modules/@jsonjoy.com/fs-node/lib/readWriteArgs.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.getWriteSyncArgs = exports.getWriteArgs = exports.getVectorCallbackArgs = exports.getVectorArgs = exports.getHandleWriteArgs = exports.getHandleReadArgs = exports.getReadArgs = exports.getReadSyncArgs = void 0;
      var buffer_1 = require_buffer3();
      var fs_core_1 = require_lib3();
      var argErrors_1 = require_argErrors();
      var validators_1 = require_validators();
      var READ_BUFFER_SIZE = 16384;
      var validateOptions = (value, name) => (0, validators_1.validateObject)(
        value,
        name,
        1
        /* ValidateObject.AllowNullable */
      );
      var validatePosition = (position, name, length) => {
        if (typeof position === "number")
          (0, validators_1.validateInteger)(position, name, -1);
        else if (typeof position === "bigint") {
          const max = 2n ** 63n - 1n - BigInt(length);
          if (!(position >= -1n && position <= max))
            throw (0, argErrors_1.outOfRange)(name, ">= -1 && <= " + max, position);
        } else
          throw (0, argErrors_1.invalidArgType)(name, "of type bigint or integer", position);
      };
      var validateBufferArray = (buffers, name = "buffers") => {
        if (!Array.isArray(buffers))
          throw (0, argErrors_1.invalidArgType)(name, "an ArrayBufferView[]", buffers);
        const length = buffers.length;
        for (let i = 0; i < length; i++)
          if (!ArrayBuffer.isView(buffers[i]))
            throw (0, argErrors_1.invalidArgType)(name, "an ArrayBufferView[]", buffers);
      };
      var validateOffsetLengthRead = (offset, length, bufferLength) => {
        if (offset < 0)
          throw (0, argErrors_1.outOfRange)("offset", ">= 0", offset);
        if (length < 0)
          throw (0, argErrors_1.outOfRange)("length", ">= 0", length);
        if (offset + length > bufferLength)
          throw (0, argErrors_1.outOfRange)("length", "<= " + (bufferLength - offset), length);
      };
      var validateOffsetLengthWrite = (offset, length, byteLength2) => {
        if (offset > byteLength2)
          throw (0, argErrors_1.outOfRange)("offset", "<= " + byteLength2, offset);
        if (length > byteLength2 - offset)
          throw (0, argErrors_1.outOfRange)("length", "<= " + (byteLength2 - offset), length);
        if (length < 0)
          throw (0, argErrors_1.outOfRange)("length", ">= 0", length);
        (0, validators_1.validateInt32)(length, "length", 0);
      };
      var validateStringAfterArrayBufferView = (buffer, name) => {
        if (typeof buffer !== "string")
          throw (0, argErrors_1.invalidArgType)(name, "of type string or an instance of Buffer, TypedArray, or DataView", buffer);
      };
      var toEncoding = (encoding) => typeof encoding === "string" && buffer_1.Buffer.isEncoding(encoding) ? encoding : "utf8";
      var validateEncoding = (data, encoding) => {
        if (toEncoding(encoding) === "hex" && data.length % 2 !== 0)
          throw (0, argErrors_1.invalidArgValue)("encoding", encoding, "is invalid for data of length " + data.length);
      };
      var viewToBuffer = (view) => buffer_1.Buffer.isBuffer(view) ? view : buffer_1.Buffer.from(view.buffer, view.byteOffset, view.byteLength);
      var seekPosition = (position) => typeof position === "number" && position >= 0 && Number.isSafeInteger(position) ? position : null;
      var readPosition = (position) => {
        if (typeof position === "bigint")
          return position < 0n ? null : Number(position);
        return position < 0 ? null : position;
      };
      var getReadSyncArgs = (argc, buffer, a, b, c) => {
        (0, validators_1.validateBuffer)(buffer);
        const view = buffer;
        let offset = a;
        let length = b;
        let position = c;
        if (argc <= 3 || typeof a === "object") {
          if (a !== void 0)
            validateOptions(a, "options");
          const options = a ?? {};
          offset = options.offset !== void 0 ? options.offset : 0;
          length = options.length !== void 0 ? options.length : view.byteLength - offset;
          position = options.position !== void 0 ? options.position : null;
        }
        if (offset === void 0)
          offset = 0;
        else
          (0, validators_1.validateInteger)(offset, "offset", 0);
        length = length | 0;
        if (position === void 0 || position === null)
          position = -1;
        else
          validatePosition(position, "position", length);
        if (length !== 0) {
          if (view.byteLength === 0)
            throw (0, argErrors_1.invalidArgValue)("buffer", view, "is empty and cannot be written");
          validateOffsetLengthRead(offset, length, view.byteLength);
        }
        return { buffer: view, offset, length, position: readPosition(position) };
      };
      exports.getReadSyncArgs = getReadSyncArgs;
      var getReadArgs = (argc, buffer, a, b, c, d) => {
        let buf = buffer;
        let params = null;
        let offset = a;
        let length = b;
        let position = c;
        let callback = d;
        if (argc <= 4) {
          if (argc === 4) {
            validateOptions(a, "options");
            callback = b;
            params = a;
          } else if (argc === 3) {
            if (!ArrayBuffer.isView(buf)) {
              params = buf;
              const source2 = buf ?? {};
              buf = source2.buffer !== void 0 ? source2.buffer : buffer_1.Buffer.alloc(READ_BUFFER_SIZE);
            }
            callback = a;
          } else {
            callback = buf;
            buf = buffer_1.Buffer.alloc(READ_BUFFER_SIZE);
          }
          if (params !== void 0)
            validateOptions(params, "options");
          const source = params ?? {};
          offset = source.offset !== void 0 ? source.offset : 0;
          length = source.length !== void 0 ? source.length : buf?.byteLength - offset;
          position = source.position !== void 0 ? source.position : null;
        }
        (0, validators_1.validateBuffer)(buf);
        (0, validators_1.validateFunction)(callback, "cb");
        if (offset === void 0 || offset === null)
          offset = 0;
        else
          (0, validators_1.validateInteger)(offset, "offset", 0);
        length = length | 0;
        if (position === void 0 || position === null)
          position = -1;
        else
          validatePosition(position, "position", length);
        if (length !== 0) {
          if (buf.byteLength === 0)
            throw (0, argErrors_1.invalidArgValue)("buffer", buf, "is empty and cannot be written");
          validateOffsetLengthRead(offset, length, buf.byteLength);
        }
        return { buffer: buf, offset, length, position: readPosition(position), callback };
      };
      exports.getReadArgs = getReadArgs;
      var getHandleReadArgs = (bufferOrParams, a, b, c) => {
        let buf = bufferOrParams;
        let offset = a;
        let length = b;
        let position = c;
        if (!ArrayBuffer.isView(buf)) {
          if (bufferOrParams !== void 0)
            validateOptions(bufferOrParams, "options");
          const source = bufferOrParams ?? {};
          buf = source.buffer !== void 0 ? source.buffer : buffer_1.Buffer.alloc(READ_BUFFER_SIZE);
          offset = source.offset !== void 0 ? source.offset : 0;
          length = source.length !== void 0 ? source.length : buf.byteLength - offset;
          position = source.position !== void 0 ? source.position : null;
          (0, validators_1.validateBuffer)(buf);
        }
        if (offset !== null && typeof offset === "object") {
          const options = offset;
          offset = options.offset !== void 0 ? options.offset : 0;
          length = options.length !== void 0 ? options.length : buf.byteLength - offset;
          position = options.position !== void 0 ? options.position : null;
        }
        if (offset === void 0 || offset === null)
          offset = 0;
        else
          (0, validators_1.validateInteger)(offset, "offset", 0);
        if (length === void 0 || length === null)
          length = buf.byteLength - offset;
        if (position === void 0 || position === null)
          position = -1;
        else
          validatePosition(position, "position", length);
        if (length !== 0) {
          if (buf.byteLength === 0)
            throw (0, argErrors_1.invalidArgValue)("buffer", buf, "is empty and cannot be written");
          validateOffsetLengthRead(offset, length, buf.byteLength);
        }
        return { buffer: buf, offset, length, position: readPosition(position) };
      };
      exports.getHandleReadArgs = getHandleReadArgs;
      var getHandleWriteArgs = (data, a, b, c) => {
        if (data?.byteLength === 0)
          return null;
        let offset = a;
        let length = b;
        let position = c;
        if (ArrayBuffer.isView(data)) {
          const view = data;
          if (typeof offset === "object") {
            const options = offset ?? {};
            offset = options.offset !== void 0 ? options.offset : 0;
            length = options.length !== void 0 ? options.length : view.byteLength - offset;
            position = options.position !== void 0 ? options.position : null;
          }
          if (offset === void 0 || offset === null)
            offset = 0;
          else
            (0, validators_1.validateInteger)(offset, "offset", 0);
          if (typeof length !== "number")
            length = view.byteLength - offset;
          validateOffsetLengthWrite(offset, length, view.byteLength);
          return { buffer: viewToBuffer(view), offset, length, position: seekPosition(position) };
        }
        validateStringAfterArrayBufferView(data, "buffer");
        const str = data;
        validateEncoding(str, length);
        const buf = (0, buffer_1.bufferFrom)(str, toEncoding(length));
        return { buffer: buf, offset: 0, length: buf.length, position: seekPosition(offset) };
      };
      exports.getHandleWriteArgs = getHandleWriteArgs;
      var getVectorArgs = (buffers, position) => {
        validateBufferArray(buffers);
        return seekPosition(position);
      };
      exports.getVectorArgs = getVectorArgs;
      var getVectorCallbackArgs = (buffers, a, b) => {
        validateBufferArray(buffers);
        const callback = b || a;
        (0, validators_1.validateFunction)(callback, "cb");
        return [seekPosition(a), callback];
      };
      exports.getVectorCallbackArgs = getVectorCallbackArgs;
      var getWriteArgs = (fd, a, b, c, d, e) => {
        (0, validators_1.validateInt32)(fd, "fd", 0);
        let offset = b;
        let length = c;
        let position = d;
        let callback = e;
        if (ArrayBuffer.isView(a)) {
          const view = a;
          if (!callback)
            callback = position || length || offset;
          (0, validators_1.validateFunction)(callback, "cb");
          if (typeof offset === "object") {
            const options = offset ?? {};
            offset = options.offset !== void 0 ? options.offset : 0;
            length = options.length !== void 0 ? options.length : view.byteLength - offset;
            position = options.position !== void 0 ? options.position : null;
          }
          if (offset === void 0 || offset === null || typeof offset === "function")
            offset = 0;
          else
            (0, validators_1.validateInteger)(offset, "offset", 0);
          if (typeof length !== "number")
            length = view.byteLength - offset;
          validateOffsetLengthWrite(offset, length, view.byteLength);
          return [fd, false, viewToBuffer(view), offset, length, seekPosition(position), callback];
        }
        validateStringAfterArrayBufferView(a, "buffer");
        if (typeof position !== "function") {
          if (typeof offset === "function") {
            position = offset;
            offset = null;
          } else
            position = length;
          length = "utf8";
        }
        const str = a;
        validateEncoding(str, length);
        callback = position;
        (0, validators_1.validateFunction)(callback, "cb");
        const buf = (0, buffer_1.bufferFrom)(str, toEncoding(length));
        return [fd, true, buf, 0, buf.length, seekPosition(offset), callback];
      };
      exports.getWriteArgs = getWriteArgs;
      var getWriteSyncArgs = (fd, a, b, c, d) => {
        let offset = b;
        let length = c;
        let position = d;
        if (ArrayBuffer.isView(a)) {
          const view = a;
          if (typeof offset === "object") {
            const options = offset ?? {};
            offset = options.offset !== void 0 ? options.offset : 0;
            length = options.length !== void 0 ? options.length : view.byteLength - offset;
            position = options.position !== void 0 ? options.position : null;
          }
          if (offset === void 0 || offset === null)
            offset = 0;
          else
            (0, validators_1.validateInteger)(offset, "offset", 0);
          if (typeof length !== "number")
            length = view.byteLength - offset;
          validateOffsetLengthWrite(offset, length, view.byteLength);
          (0, fs_core_1.validateFd)(fd);
          return [fd, viewToBuffer(view), offset, length, seekPosition(position)];
        }
        validateStringAfterArrayBufferView(a, "buffer");
        const str = a;
        validateEncoding(str, length);
        (0, fs_core_1.validateFd)(fd);
        const buf = (0, buffer_1.bufferFrom)(str, toEncoding(length));
        return [fd, buf, 0, buf.length, seekPosition(offset)];
      };
      exports.getWriteSyncArgs = getWriteSyncArgs;
    }
  });

  // node_modules/@jsonjoy.com/fs-node/lib/util.js
  var require_util3 = __commonJS({
    "node_modules/@jsonjoy.com/fs-node/lib/util.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.getWriteSyncArgs = exports.getWriteArgs = exports.bufToUint8 = exports.createWatchError = exports.createStatError = exports.createError = exports.pathToFilename = exports.nullCheck = void 0;
      exports.promisify = promisify;
      exports.validateCallback = validateCallback;
      exports.modeToNumber = modeToNumber;
      exports.genRndStr6 = genRndStr6;
      exports.flagsToNumber = flagsToNumber;
      exports.streamToBuffer = streamToBuffer;
      exports.bufferToEncoding = bufferToEncoding;
      exports.isReadableStream = isReadableStream;
      var fs_node_utils_1 = require_lib2();
      var argErrors_1 = require_argErrors();
      var validators_1 = require_validators();
      var buffer_1 = require_buffer3();
      var fs_core_1 = require_lib3();
      Object.defineProperty(exports, "nullCheck", { enumerable: true, get: function() {
        return fs_core_1.nullCheck;
      } });
      Object.defineProperty(exports, "pathToFilename", { enumerable: true, get: function() {
        return fs_core_1.pathToFilename;
      } });
      Object.defineProperty(exports, "createError", { enumerable: true, get: function() {
        return fs_core_1.createError;
      } });
      Object.defineProperty(exports, "createStatError", { enumerable: true, get: function() {
        return fs_core_1.createStatError;
      } });
      Object.defineProperty(exports, "createWatchError", { enumerable: true, get: function() {
        return fs_core_1.createWatchError;
      } });
      function promisify(fs2, fn, getResult = (input) => input) {
        return (...args) => new Promise((resolve2, reject) => {
          fs2[fn].bind(fs2)(...args, (error, result) => {
            if (error)
              return reject(error);
            return resolve2(getResult(result));
          });
        });
      }
      function validateCallback(callback, name = "cb") {
        (0, validators_1.validateFunction)(callback, name);
        return callback;
      }
      var OCTAL_REG = /^[0-7]+$/;
      var MODE_DESC = "must be a 32-bit unsigned integer or an octal string";
      function modeToNumber(mode, def, name = "mode") {
        let value = mode ?? def;
        if (typeof value === "string") {
          if (!OCTAL_REG.test(value))
            throw (0, argErrors_1.invalidArgValue)(name, value, MODE_DESC);
          value = parseInt(value, 8);
        }
        (0, validators_1.validateUint32)(value, name);
        return value + 0;
      }
      function genRndStr6() {
        return Math.random().toString(36).slice(2, 8).padEnd(6, "0");
      }
      function flagsToNumber(flags) {
        if (typeof flags === "number") {
          (0, validators_1.validateInt32)(flags, "flags");
          return flags;
        }
        if (typeof flags === "string") {
          const flagsNum = fs_node_utils_1.FLAGS[flags];
          if (typeof flagsNum !== "undefined")
            return flagsNum;
        }
        throw (0, argErrors_1.invalidArgValue)("flags", flags);
      }
      function streamToBuffer(stream) {
        const chunks = [];
        return new Promise((resolve2, reject) => {
          stream.on("data", (chunk) => chunks.push(chunk));
          stream.on("end", () => resolve2(buffer_1.Buffer.concat(chunks)));
          stream.on("error", reject);
        });
      }
      var bufToUint8 = (buf) => new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      exports.bufToUint8 = bufToUint8;
      var readWriteArgs_1 = require_readWriteArgs();
      Object.defineProperty(exports, "getWriteArgs", { enumerable: true, get: function() {
        return readWriteArgs_1.getWriteArgs;
      } });
      Object.defineProperty(exports, "getWriteSyncArgs", { enumerable: true, get: function() {
        return readWriteArgs_1.getWriteSyncArgs;
      } });
      function bufferToEncoding(buffer, encoding) {
        if (!encoding || encoding === "buffer")
          return buffer;
        else
          return buffer.toString(encoding);
      }
      function isReadableStream(stream) {
        return stream !== null && typeof stream === "object" && typeof stream.pipe === "function" && typeof stream.on === "function" && stream.readable === true;
      }
    }
  });

  // node_modules/@jsonjoy.com/fs-node/lib/glob.js
  var require_glob = __commonJS({
    "node_modules/@jsonjoy.com/fs-node/lib/glob.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.globSync = exports.globWalk = void 0;
      exports.glob = glob;
      var path_1 = require_path();
      var url_1 = require_url();
      var argErrors_1 = require_argErrors();
      var validators_1 = require_validators();
      var glob_to_regex_js_1 = require_lib();
      var util_1 = require_util3();
      var Dirent_1 = require_Dirent();
      var { basename, dirname, isAbsolute, join, relative, resolve: resolve2 } = path_1.posix;
      var internalAssertionError = () => (0, argErrors_1.withCode)(new Error("This is caused by either a bug in Node.js or incorrect usage of Node.js internals.\nPlease open an issue with this stack trace at https://github.com/nodejs/node/issues\n"), "ERR_INTERNAL_ASSERTION");
      var validateStringArrayOrFunction = (value, name) => {
        if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++)
            if (typeof value[i] !== "string")
              throw (0, argErrors_1.invalidArgType)(name + "[" + i + "]", "of type string", value[i]);
          return;
        }
        if (typeof value !== "function")
          throw (0, argErrors_1.invalidArgType)(name, "of type function or string[]", value);
      };
      var toPathIfFileURL = (value) => {
        if (!(value instanceof url_1.URL))
          return value;
        if (value.protocol !== "file:")
          throw (0, argErrors_1.invalidUrlScheme)("file");
        return (0, util_1.pathToFilename)(value);
      };
      var GLOBSTAR = Symbol("globstar **");
      var MAGIC = /[*?[]|[!+@]\(/;
      var OPTS = { extglob: true, dot: false };
      var parsePart = (part) => {
        if (part === "**")
          return GLOBSTAR;
        if (!MAGIC.test(part))
          return part;
        return (0, glob_to_regex_js_1.toRegex)(part, OPTS);
      };
      var firstPhasePreProcess = (globParts) => {
        let didSomething = false;
        do {
          didSomething = false;
          for (let n = 0; n < globParts.length; n++) {
            const parts = globParts[n];
            let gs = -1;
            while (-1 !== (gs = parts.indexOf("**", gs + 1))) {
              let gss = gs;
              while (parts[gss + 1] === "**")
                gss++;
              if (gss > gs)
                parts.splice(gs + 1, gss - gs);
              const next = parts[gs + 1];
              const p = parts[gs + 2];
              const p2 = parts[gs + 3];
              if (next !== "..")
                continue;
              if (!p || p === "." || p === ".." || !p2 || p2 === "." || p2 === "..")
                continue;
              didSomething = true;
              parts.splice(gs, 1);
              const other = parts.slice(0);
              other[gs] = "**";
              globParts.push(other);
              gs--;
            }
            for (let i = 1; i < parts.length - 1; i++) {
              const p = parts[i];
              if (i === 1 && p === "" && parts[0] === "")
                continue;
              if (p === "." || p === "") {
                didSomething = true;
                parts.splice(i, 1);
                i--;
              }
            }
            if (parts[0] === "." && parts.length === 2 && (parts[1] === "." || parts[1] === "")) {
              didSomething = true;
              parts.pop();
            }
            let dd = 0;
            while (-1 !== (dd = parts.indexOf("..", dd + 1))) {
              const p = parts[dd - 1];
              if (p && p !== "." && p !== ".." && p !== "**") {
                didSomething = true;
                const needDot = dd === 1 && parts[dd + 1] === "**";
                parts.splice(dd - 1, 2, ...needDot ? ["."] : []);
                if (!parts.length)
                  parts.push("");
                dd -= 2;
              }
            }
          }
        } while (didSomething);
        return globParts;
      };
      var partsMatch = (a, b) => {
        let ai = 0;
        let bi = 0;
        const result = [];
        let which = "";
        while (ai < a.length && bi < b.length) {
          if (a[ai] === b[bi]) {
            result.push(which === "b" ? b[bi] : a[ai]);
            ai++;
            bi++;
          } else if (a[ai] === "**" && b[bi] === a[ai + 1]) {
            result.push(a[ai]);
            ai++;
          } else if (b[bi] === "**" && a[ai] === b[bi + 1]) {
            result.push(b[bi]);
            bi++;
          } else if (a[ai] === "*" && b[bi] && !b[bi].startsWith(".") && b[bi] !== "**") {
            if (which === "b")
              return false;
            which = "a";
            result.push(a[ai]);
            ai++;
            bi++;
          } else if (b[bi] === "*" && a[ai] && !a[ai].startsWith(".") && a[ai] !== "**") {
            if (which === "a")
              return false;
            which = "b";
            result.push(b[bi]);
            ai++;
            bi++;
          } else
            return false;
        }
        return a.length === b.length && result;
      };
      var secondPhasePreProcess = (globParts) => {
        for (let i = 0; i < globParts.length - 1; i++) {
          for (let j = i + 1; j < globParts.length; j++) {
            const matched = partsMatch(globParts[i], globParts[j]);
            if (matched) {
              globParts[i] = [];
              globParts[j] = matched;
              break;
            }
          }
        }
        return globParts.filter((parts) => parts.length);
      };
      var compile = (pattern) => {
        const source = pattern.replace(/\\/g, "/");
        if (!source)
          return [[], []];
        const globSet = [...new Set((0, glob_to_regex_js_1.expandBraces)(source))];
        const globParts = secondPhasePreProcess(firstPhasePreProcess(globSet.map((one) => one.split(/\/+/))));
        return [globParts.map((parts) => parts.map(parsePart)), globParts];
      };
      var createExcludeMatcher = (patterns, root) => {
        const regexes = [];
        for (let i = 0; i < patterns.length; i++)
          regexes.push((0, glob_to_regex_js_1.toRegex)(resolve2(root, patterns[i].replace(/\\/g, "/")), OPTS));
        return (value) => {
          for (let i = 0; i < regexes.length; i++)
            if (regexes[i].test(value))
              return true;
          return false;
        };
      };
      var Pattern = class _Pattern {
        constructor(parts, globStrings, indexes, symlinks, realpaths = /* @__PURE__ */ new Set()) {
          this.parts = parts;
          this.globStrings = globStrings;
          this.indexes = indexes;
          this.symlinks = symlinks;
          this.realpaths = realpaths;
          this.last = parts.length - 1;
        }
        isLast(isDirectory) {
          return this.indexes.has(this.last) || this.at(-1) === "" && isDirectory && this.indexes.has(this.last - 1) && this.at(-2) === GLOBSTAR;
        }
        isFirst() {
          return this.indexes.has(0);
        }
        get hasSeenSymlinks() {
          for (const index of this.indexes)
            if (!this.symlinks.has(index))
              return true;
          return false;
        }
        at(index) {
          const parts = this.parts;
          return parts[index < 0 ? parts.length + index : index];
        }
        child(indexes, symlinks = /* @__PURE__ */ new Set(), realpaths = this.realpaths) {
          return new _Pattern(this.parts, this.globStrings, indexes, symlinks, realpaths);
        }
        test(index, path2) {
          const part = this.parts[index];
          if (part === GLOBSTAR)
            return true;
          if (typeof part === "string")
            return part === path2;
          return part !== void 0 && part.test(path2);
        }
        cacheKey(index) {
          const globStrings = this.globStrings;
          const length = globStrings.length;
          let key = "";
          for (let i = index; i < length; i++) {
            key += globStrings[i];
            if (i !== length - 1)
              key += "/";
          }
          return key;
        }
      };
      var rethrowUnlessFsError = (error) => {
        if (!error?.code)
          throw error;
      };
      var direntOf = (name, parentPath, mode) => {
        const dirent = new Dirent_1.default();
        dirent.name = name;
        dirent.parentPath = parentPath;
        dirent.path = parentPath;
        dirent.mode = mode;
        return dirent;
      };
      var Cache = class {
        constructor(fs2) {
          this.fs = fs2;
          this.stats = /* @__PURE__ */ new Map();
          this.followStats = /* @__PURE__ */ new Map();
          this.realpaths = /* @__PURE__ */ new Map();
          this.readdirs = /* @__PURE__ */ new Map();
          this.seenKeys = /* @__PURE__ */ new Map();
        }
        statSync(path2) {
          const cached = this.stats.get(path2);
          if (cached !== void 0)
            return cached;
          let value = null;
          try {
            value = direntOf(basename(path2), dirname(path2), this.fs.lstatSync(path2).mode);
          } catch (error) {
            rethrowUnlessFsError(error);
          }
          this.stats.set(path2, value);
          return value;
        }
        followStatSync(path2) {
          const cached = this.followStats.get(path2);
          if (cached !== void 0)
            return cached;
          let value = null;
          try {
            value = direntOf(basename(path2), dirname(path2), this.fs.statSync(path2).mode);
          } catch (error) {
            rethrowUnlessFsError(error);
          }
          this.followStats.set(path2, value);
          return value;
        }
        realpathSync(path2) {
          const cached = this.realpaths.get(path2);
          if (cached !== void 0)
            return cached;
          let value = null;
          try {
            value = String(this.fs.realpathSync(path2));
          } catch (error) {
            rethrowUnlessFsError(error);
          }
          this.realpaths.set(path2, value);
          return value;
        }
        readdirSync(path2) {
          const cached = this.readdirs.get(path2);
          if (cached !== void 0)
            return cached;
          let value = [];
          try {
            value = this.fs.readdirSync(path2, { withFileTypes: true });
          } catch (error) {
            rethrowUnlessFsError(error);
          }
          this.readdirs.set(path2, value);
          return value;
        }
        addToStatCache(path2, value) {
          this.stats.set(path2, value);
        }
        add(path2, pattern) {
          let keys = this.seenKeys.get(path2);
          if (!keys) {
            keys = /* @__PURE__ */ new Set();
            this.seenKeys.set(path2, keys);
          }
          const originalSize = keys.size;
          for (const index of pattern.indexes)
            keys.add(pattern.cacheKey(index));
          return keys.size !== originalSize + pattern.indexes.size;
        }
        seen(path2, pattern, index) {
          return !!this.seenKeys.get(path2)?.has(pattern.cacheKey(index));
        }
      };
      var depthOf = (root, fullpath) => {
        const rel = relative(root, fullpath);
        if (!rel)
          return 0;
        const parts = rel.split("/");
        let depth = 0;
        for (let i = 0; i < parts.length; i++)
          depth += parts[i] === ".." ? -1 : 1;
        return depth;
      };
      var EMPTY_OPTIONS = {};
      var Glob = class {
        constructor(fs2, pattern, options = EMPTY_OPTIONS) {
          this.fs = fs2;
          this.followSymlinks = false;
          this.isExcluded = () => false;
          this.results = /* @__PURE__ */ new Set();
          this.queue = [];
          this.subpatterns = /* @__PURE__ */ new Map();
          (0, validators_1.validateObject)(options, "options");
          const { exclude, cwd: cwd2, followSymlinks, withFileTypes, maxdepth } = options;
          this.cache = new Cache(fs2);
          this.root = toPathIfFileURL(cwd2) ?? ".";
          if (followSymlinks != null) {
            (0, validators_1.validateBoolean)(followSymlinks, "options.followSymlinks");
            this.followSymlinks = followSymlinks;
          }
          this.withFileTypes = !!withFileTypes;
          this.maxdepth = maxdepth ?? Infinity;
          if (exclude != null) {
            validateStringArrayOrFunction(exclude, "options.exclude");
            if (Array.isArray(exclude)) {
              if (typeof this.root !== "string")
                throw internalAssertionError();
              this.isExcluded = createExcludeMatcher(exclude, this.root);
            } else
              this.exclude = exclude;
          }
          let patterns;
          if (typeof pattern === "object") {
            (0, validators_1.validateStringArray)(pattern, "patterns");
            patterns = pattern;
          } else {
            (0, validators_1.validateString)(pattern, "patterns");
            patterns = [pattern];
          }
          const compiled = [];
          for (let i = 0; i < patterns.length; i++) {
            const [set, globParts] = compile(patterns[i]);
            for (let j = 0; j < set.length; j++)
              compiled.push(new Pattern(set[j], globParts[j], /* @__PURE__ */ new Set([0]), /* @__PURE__ */ new Set()));
          }
          this.patterns = compiled;
        }
        *walk() {
          const queue2 = this.queue;
          queue2.push({ path: ".", patterns: this.patterns });
          while (queue2.length > 0) {
            const item = queue2.pop();
            for (let i = 0; i < item.patterns.length; i++)
              yield* this.walkPattern(item.path, item.patterns[i]);
            this.subpatterns.forEach((patterns, path2) => queue2.push({ path: path2, patterns }));
            this.subpatterns.clear();
          }
        }
        result(path2) {
          if (!this.withFileTypes)
            return path2;
          const full = isAbsolute(path2) ? path2 : join(this.root, path2);
          const stat = this.cache.statSync(full);
          return direntOf(basename(full), dirname(full), stat ? stat.mode : 0);
        }
        isDirectory(path2, stat, pattern) {
          if (stat?.isDirectory())
            return true;
          if (!stat?.isSymbolicLink())
            return false;
          if (this.followSymlinks)
            return !!this.cache.followStatSync(path2)?.isDirectory();
          return pattern.hasSeenSymlinks;
        }
        nextRealpaths(path2, isDirectory, pattern) {
          if (!this.followSymlinks || !isDirectory)
            return pattern.realpaths;
          const real = this.cache.realpathSync(path2);
          if (real === null)
            return pattern.realpaths;
          const realpaths = new Set(pattern.realpaths);
          realpaths.add(real);
          return realpaths;
        }
        isCyclic(path2, isDirectory, pattern) {
          if (!this.followSymlinks || !isDirectory)
            return false;
          const real = this.cache.realpathSync(path2);
          return real !== null && pattern.realpaths.has(real);
        }
        addSubpattern(path2, pattern) {
          if (this.isExcluded(path2))
            return;
          const fullpath = resolve2(this.root, path2);
          if (this.isExcluded(fullpath + "/") && this.cache.statSync(fullpath)?.isDirectory())
            return;
          const exclude = this.exclude;
          if (exclude) {
            if (this.withFileTypes) {
              const stat = this.cache.statSync(path2);
              if (stat !== null && exclude(stat))
                return;
            } else if (exclude(path2))
              return;
          }
          const existing = this.subpatterns.get(path2);
          if (existing)
            existing.push(pattern);
          else
            this.subpatterns.set(path2, [pattern]);
        }
        accept(path2) {
          if (this.results.has(path2))
            return false;
          if (this.isExcluded(resolve2(this.root, path2)))
            return false;
          this.results.add(path2);
          return true;
        }
        *walkPattern(path2, pattern) {
          if (this.cache.add(path2, pattern))
            return;
          const cache = this.cache;
          const fullpath = resolve2(this.root, path2);
          const stat = cache.statSync(fullpath);
          const last = pattern.last;
          const isDirectory = this.isDirectory(fullpath, stat, pattern);
          const isLast = pattern.isLast(isDirectory);
          const isFirst = pattern.isFirst();
          if (this.isExcluded(fullpath))
            return;
          if (isFirst && pattern.at(0) === "") {
            this.addSubpattern("/", pattern.child(/* @__PURE__ */ new Set([1])));
            return;
          }
          if (isFirst && pattern.at(0) === "..") {
            this.addSubpattern("../", pattern.child(/* @__PURE__ */ new Set([1])));
            return;
          }
          if (isFirst && pattern.at(0) === ".") {
            this.addSubpattern(".", pattern.child(/* @__PURE__ */ new Set([1])));
            return;
          }
          if (isLast && typeof pattern.at(-1) === "string") {
            const p = pattern.at(-1);
            const leaf = cache.statSync(join(fullpath, p));
            const match = join(path2, p);
            if (leaf && (p || isDirectory) && this.accept(match))
              yield this.result(match);
            if (pattern.indexes.size === 1 && pattern.indexes.has(last))
              return;
          } else if (isLast && pattern.at(-1) === GLOBSTAR && (path2 !== "." || pattern.at(0) === "." || !last && stat)) {
            if (this.accept(path2))
              yield this.result(path2);
          }
          if (!isDirectory || this.isCyclic(fullpath, isDirectory, pattern))
            return;
          if (this.maxdepth !== Infinity && depthOf(this.root, fullpath) > this.maxdepth)
            return;
          const nextRealpaths = this.nextRealpaths(fullpath, isDirectory, pattern);
          let children;
          const firstPattern = pattern.indexes.size === 1 && pattern.at(pattern.indexes.values().next().value);
          if (typeof firstPattern === "string") {
            const child = cache.statSync(join(fullpath, firstPattern));
            if (!child)
              return;
            child.name = firstPattern;
            children = [child];
          } else
            children = cache.readdirSync(fullpath);
          for (let i = 0; i < children.length; i++) {
            const entry = children[i];
            const name = entry.name;
            const entryPath = join(path2, name);
            const entryFullpath = join(fullpath, name);
            cache.addToStatCache(entryFullpath, entry);
            const entryIsDirectory = entry.isDirectory() || this.followSymlinks && entry.isSymbolicLink() && !!cache.followStatSync(entryFullpath)?.isDirectory();
            const subPatterns = /* @__PURE__ */ new Set();
            const nSymlinks = /* @__PURE__ */ new Set();
            for (const index of pattern.indexes) {
              if (cache.seen(entryPath, pattern, index) || cache.seen(entryPath, pattern, index + 1))
                return;
              const current = pattern.at(index);
              const nextIndex = index + 1;
              const next = pattern.at(nextIndex);
              const fromSymlink = !this.followSymlinks && pattern.symlinks.has(index);
              if (current === GLOBSTAR) {
                const isDot = name.charCodeAt(0) === 46;
                const nextMatches = pattern.test(nextIndex, name);
                let nextNonGlobIndex = nextIndex;
                while (pattern.at(nextNonGlobIndex) === GLOBSTAR)
                  nextNonGlobIndex++;
                const matchesDot = isDot && pattern.test(nextNonGlobIndex, name);
                if (isDot && !matchesDot || this.exclude && this.exclude(this.withFileTypes ? entry : name))
                  continue;
                if (!fromSymlink && entryIsDirectory)
                  subPatterns.add(index);
                else if (!fromSymlink && index === last && this.accept(entryPath))
                  yield this.result(entryPath);
                if (nextMatches && nextIndex === last && !isLast) {
                  if (this.accept(entryPath))
                    yield this.result(entryPath);
                } else if (nextMatches && entryIsDirectory)
                  subPatterns.add(index + 2);
                if ((nextMatches || pattern.at(0) === ".") && (entryIsDirectory || entry.isSymbolicLink()) && !fromSymlink)
                  subPatterns.add(nextIndex);
                if (!this.followSymlinks && entry.isSymbolicLink())
                  nSymlinks.add(index);
                if (next === ".." && entryIsDirectory) {
                  const parent = join(path2, "..");
                  if (nextIndex < last) {
                    if (!this.subpatterns.has(path2) && !cache.seen(path2, pattern, nextIndex + 1))
                      this.subpatterns.set(path2, [pattern.child(/* @__PURE__ */ new Set([nextIndex + 1]))]);
                    if (!this.subpatterns.has(parent) && !cache.seen(parent, pattern, nextIndex + 1))
                      this.subpatterns.set(parent, [pattern.child(/* @__PURE__ */ new Set([nextIndex + 1]))]);
                  } else {
                    if (!cache.seen(path2, pattern, nextIndex)) {
                      cache.add(path2, pattern.child(/* @__PURE__ */ new Set([nextIndex])));
                      if (this.accept(path2))
                        yield this.result(path2);
                    }
                    if (!cache.seen(path2, pattern, nextIndex) || !cache.seen(parent, pattern, nextIndex)) {
                      cache.add(parent, pattern.child(/* @__PURE__ */ new Set([nextIndex])));
                      if (this.accept(parent))
                        yield this.result(parent);
                    }
                  }
                }
              }
              if (typeof current === "string") {
                if (pattern.test(index, name) && index !== last)
                  subPatterns.add(nextIndex);
                else if (current === "." && pattern.test(nextIndex, name)) {
                  if (nextIndex === last) {
                    if (this.accept(entryPath))
                      yield this.result(entryPath);
                  } else
                    subPatterns.add(nextIndex + 1);
                }
              }
              if (typeof current === "object" && pattern.test(index, name)) {
                if (index === last) {
                  if (this.accept(entryPath))
                    yield this.result(entryPath);
                } else if (entryIsDirectory)
                  subPatterns.add(nextIndex);
              }
            }
            if (subPatterns.size > 0)
              this.addSubpattern(entryPath, pattern.child(subPatterns, nSymlinks, nextRealpaths));
          }
        }
      };
      var globWalk = (fs2, pattern, options) => new Glob(fs2, pattern, options).walk();
      exports.globWalk = globWalk;
      var globSync = (fs2, pattern, options) => {
        const results = [];
        for (const match of (0, exports.globWalk)(fs2, pattern, options))
          results.push(match);
        return results;
      };
      exports.globSync = globSync;
      async function* glob(fs2, pattern, options) {
        yield* (0, exports.globWalk)(fs2, pattern, options);
      }
    }
  });

  // node_modules/@jsonjoy.com/fs-node-utils/lib/setTimeoutUnref.js
  var require_setTimeoutUnref = __commonJS({
    "node_modules/@jsonjoy.com/fs-node-utils/lib/setTimeoutUnref.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      function setTimeoutUnref(callback, time, args) {
        const ref = setTimeout.apply(typeof globalThis !== "undefined" ? globalThis : global, arguments);
        if (ref && typeof ref === "object" && typeof ref.unref === "function")
          ref.unref();
        return ref;
      }
      exports.default = setTimeoutUnref;
    }
  });

  // node_modules/events/events.js
  var require_events = __commonJS({
    "node_modules/events/events.js"(exports, module) {
      "use strict";
      var R = typeof Reflect === "object" ? Reflect : null;
      var ReflectApply = R && typeof R.apply === "function" ? R.apply : function ReflectApply2(target, receiver, args) {
        return Function.prototype.apply.call(target, receiver, args);
      };
      var ReflectOwnKeys;
      if (R && typeof R.ownKeys === "function") {
        ReflectOwnKeys = R.ownKeys;
      } else if (Object.getOwnPropertySymbols) {
        ReflectOwnKeys = function ReflectOwnKeys2(target) {
          return Object.getOwnPropertyNames(target).concat(Object.getOwnPropertySymbols(target));
        };
      } else {
        ReflectOwnKeys = function ReflectOwnKeys2(target) {
          return Object.getOwnPropertyNames(target);
        };
      }
      function ProcessEmitWarning(warning) {
        if (console && console.warn) console.warn(warning);
      }
      var NumberIsNaN = Number.isNaN || function NumberIsNaN2(value) {
        return value !== value;
      };
      function EventEmitter() {
        EventEmitter.init.call(this);
      }
      module.exports = EventEmitter;
      module.exports.once = once2;
      EventEmitter.EventEmitter = EventEmitter;
      EventEmitter.prototype._events = void 0;
      EventEmitter.prototype._eventsCount = 0;
      EventEmitter.prototype._maxListeners = void 0;
      var defaultMaxListeners = 10;
      function checkListener(listener) {
        if (typeof listener !== "function") {
          throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof listener);
        }
      }
      Object.defineProperty(EventEmitter, "defaultMaxListeners", {
        enumerable: true,
        get: function() {
          return defaultMaxListeners;
        },
        set: function(arg) {
          if (typeof arg !== "number" || arg < 0 || NumberIsNaN(arg)) {
            throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + arg + ".");
          }
          defaultMaxListeners = arg;
        }
      });
      EventEmitter.init = function() {
        if (this._events === void 0 || this._events === Object.getPrototypeOf(this)._events) {
          this._events = /* @__PURE__ */ Object.create(null);
          this._eventsCount = 0;
        }
        this._maxListeners = this._maxListeners || void 0;
      };
      EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
        if (typeof n !== "number" || n < 0 || NumberIsNaN(n)) {
          throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + n + ".");
        }
        this._maxListeners = n;
        return this;
      };
      function _getMaxListeners(that) {
        if (that._maxListeners === void 0)
          return EventEmitter.defaultMaxListeners;
        return that._maxListeners;
      }
      EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
        return _getMaxListeners(this);
      };
      EventEmitter.prototype.emit = function emit2(type) {
        var args = [];
        for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
        var doError = type === "error";
        var events = this._events;
        if (events !== void 0)
          doError = doError && events.error === void 0;
        else if (!doError)
          return false;
        if (doError) {
          var er;
          if (args.length > 0)
            er = args[0];
          if (er instanceof Error) {
            throw er;
          }
          var err = new Error("Unhandled error." + (er ? " (" + er.message + ")" : ""));
          err.context = er;
          throw err;
        }
        var handler = events[type];
        if (handler === void 0)
          return false;
        if (typeof handler === "function") {
          ReflectApply(handler, this, args);
        } else {
          var len = handler.length;
          var listeners2 = arrayClone(handler, len);
          for (var i = 0; i < len; ++i)
            ReflectApply(listeners2[i], this, args);
        }
        return true;
      };
      function _addListener(target, type, listener, prepend) {
        var m;
        var events;
        var existing;
        checkListener(listener);
        events = target._events;
        if (events === void 0) {
          events = target._events = /* @__PURE__ */ Object.create(null);
          target._eventsCount = 0;
        } else {
          if (events.newListener !== void 0) {
            target.emit(
              "newListener",
              type,
              listener.listener ? listener.listener : listener
            );
            events = target._events;
          }
          existing = events[type];
        }
        if (existing === void 0) {
          existing = events[type] = listener;
          ++target._eventsCount;
        } else {
          if (typeof existing === "function") {
            existing = events[type] = prepend ? [listener, existing] : [existing, listener];
          } else if (prepend) {
            existing.unshift(listener);
          } else {
            existing.push(listener);
          }
          m = _getMaxListeners(target);
          if (m > 0 && existing.length > m && !existing.warned) {
            existing.warned = true;
            var w = new Error("Possible EventEmitter memory leak detected. " + existing.length + " " + String(type) + " listeners added. Use emitter.setMaxListeners() to increase limit");
            w.name = "MaxListenersExceededWarning";
            w.emitter = target;
            w.type = type;
            w.count = existing.length;
            ProcessEmitWarning(w);
          }
        }
        return target;
      }
      EventEmitter.prototype.addListener = function addListener2(type, listener) {
        return _addListener(this, type, listener, false);
      };
      EventEmitter.prototype.on = EventEmitter.prototype.addListener;
      EventEmitter.prototype.prependListener = function prependListener2(type, listener) {
        return _addListener(this, type, listener, true);
      };
      function onceWrapper() {
        if (!this.fired) {
          this.target.removeListener(this.type, this.wrapFn);
          this.fired = true;
          if (arguments.length === 0)
            return this.listener.call(this.target);
          return this.listener.apply(this.target, arguments);
        }
      }
      function _onceWrap(target, type, listener) {
        var state = { fired: false, wrapFn: void 0, target, type, listener };
        var wrapped = onceWrapper.bind(state);
        wrapped.listener = listener;
        state.wrapFn = wrapped;
        return wrapped;
      }
      EventEmitter.prototype.once = function once3(type, listener) {
        checkListener(listener);
        this.on(type, _onceWrap(this, type, listener));
        return this;
      };
      EventEmitter.prototype.prependOnceListener = function prependOnceListener2(type, listener) {
        checkListener(listener);
        this.prependListener(type, _onceWrap(this, type, listener));
        return this;
      };
      EventEmitter.prototype.removeListener = function removeListener2(type, listener) {
        var list2, events, position, i, originalListener;
        checkListener(listener);
        events = this._events;
        if (events === void 0)
          return this;
        list2 = events[type];
        if (list2 === void 0)
          return this;
        if (list2 === listener || list2.listener === listener) {
          if (--this._eventsCount === 0)
            this._events = /* @__PURE__ */ Object.create(null);
          else {
            delete events[type];
            if (events.removeListener)
              this.emit("removeListener", type, list2.listener || listener);
          }
        } else if (typeof list2 !== "function") {
          position = -1;
          for (i = list2.length - 1; i >= 0; i--) {
            if (list2[i] === listener || list2[i].listener === listener) {
              originalListener = list2[i].listener;
              position = i;
              break;
            }
          }
          if (position < 0)
            return this;
          if (position === 0)
            list2.shift();
          else {
            spliceOne(list2, position);
          }
          if (list2.length === 1)
            events[type] = list2[0];
          if (events.removeListener !== void 0)
            this.emit("removeListener", type, originalListener || listener);
        }
        return this;
      };
      EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
      EventEmitter.prototype.removeAllListeners = function removeAllListeners2(type) {
        var listeners2, events, i;
        events = this._events;
        if (events === void 0)
          return this;
        if (events.removeListener === void 0) {
          if (arguments.length === 0) {
            this._events = /* @__PURE__ */ Object.create(null);
            this._eventsCount = 0;
          } else if (events[type] !== void 0) {
            if (--this._eventsCount === 0)
              this._events = /* @__PURE__ */ Object.create(null);
            else
              delete events[type];
          }
          return this;
        }
        if (arguments.length === 0) {
          var keys = Object.keys(events);
          var key;
          for (i = 0; i < keys.length; ++i) {
            key = keys[i];
            if (key === "removeListener") continue;
            this.removeAllListeners(key);
          }
          this.removeAllListeners("removeListener");
          this._events = /* @__PURE__ */ Object.create(null);
          this._eventsCount = 0;
          return this;
        }
        listeners2 = events[type];
        if (typeof listeners2 === "function") {
          this.removeListener(type, listeners2);
        } else if (listeners2 !== void 0) {
          for (i = listeners2.length - 1; i >= 0; i--) {
            this.removeListener(type, listeners2[i]);
          }
        }
        return this;
      };
      function _listeners(target, type, unwrap) {
        var events = target._events;
        if (events === void 0)
          return [];
        var evlistener = events[type];
        if (evlistener === void 0)
          return [];
        if (typeof evlistener === "function")
          return unwrap ? [evlistener.listener || evlistener] : [evlistener];
        return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
      }
      EventEmitter.prototype.listeners = function listeners2(type) {
        return _listeners(this, type, true);
      };
      EventEmitter.prototype.rawListeners = function rawListeners(type) {
        return _listeners(this, type, false);
      };
      EventEmitter.listenerCount = function(emitter, type) {
        if (typeof emitter.listenerCount === "function") {
          return emitter.listenerCount(type);
        } else {
          return listenerCount.call(emitter, type);
        }
      };
      EventEmitter.prototype.listenerCount = listenerCount;
      function listenerCount(type) {
        var events = this._events;
        if (events !== void 0) {
          var evlistener = events[type];
          if (typeof evlistener === "function") {
            return 1;
          } else if (evlistener !== void 0) {
            return evlistener.length;
          }
        }
        return 0;
      }
      EventEmitter.prototype.eventNames = function eventNames() {
        return this._eventsCount > 0 ? ReflectOwnKeys(this._events) : [];
      };
      function arrayClone(arr, n) {
        var copy = new Array(n);
        for (var i = 0; i < n; ++i)
          copy[i] = arr[i];
        return copy;
      }
      function spliceOne(list2, index) {
        for (; index + 1 < list2.length; index++)
          list2[index] = list2[index + 1];
        list2.pop();
      }
      function unwrapListeners(arr) {
        var ret = new Array(arr.length);
        for (var i = 0; i < ret.length; ++i) {
          ret[i] = arr[i].listener || arr[i];
        }
        return ret;
      }
      function once2(emitter, name) {
        return new Promise(function(resolve2, reject) {
          function errorListener(err) {
            emitter.removeListener(name, resolver);
            reject(err);
          }
          function resolver() {
            if (typeof emitter.removeListener === "function") {
              emitter.removeListener("error", errorListener);
            }
            resolve2([].slice.call(arguments));
          }
          ;
          eventTargetAgnosticAddListener(emitter, name, resolver, { once: true });
          if (name !== "error") {
            addErrorHandlerIfEventEmitter(emitter, errorListener, { once: true });
          }
        });
      }
      function addErrorHandlerIfEventEmitter(emitter, handler, flags) {
        if (typeof emitter.on === "function") {
          eventTargetAgnosticAddListener(emitter, "error", handler, flags);
        }
      }
      function eventTargetAgnosticAddListener(emitter, name, listener, flags) {
        if (typeof emitter.on === "function") {
          if (flags.once) {
            emitter.once(name, listener);
          } else {
            emitter.on(name, listener);
          }
        } else if (typeof emitter.addEventListener === "function") {
          emitter.addEventListener(name, function wrapListener(arg) {
            if (flags.once) {
              emitter.removeEventListener(name, wrapListener);
            }
            listener(arg);
          });
        } else {
          throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof emitter);
        }
      }
    }
  });

  // node_modules/inherits/inherits_browser.js
  var require_inherits_browser = __commonJS({
    "node_modules/inherits/inherits_browser.js"(exports, module) {
      if (typeof Object.create === "function") {
        module.exports = function inherits(ctor, superCtor) {
          if (superCtor) {
            ctor.super_ = superCtor;
            ctor.prototype = Object.create(superCtor.prototype, {
              constructor: {
                value: ctor,
                enumerable: false,
                writable: true,
                configurable: true
              }
            });
          }
        };
      } else {
        module.exports = function inherits(ctor, superCtor) {
          if (superCtor) {
            ctor.super_ = superCtor;
            var TempCtor = function() {
            };
            TempCtor.prototype = superCtor.prototype;
            ctor.prototype = new TempCtor();
            ctor.prototype.constructor = ctor;
          }
        };
      }
    }
  });

  // node_modules/readable-stream/lib/internal/streams/stream-browser.js
  var require_stream_browser = __commonJS({
    "node_modules/readable-stream/lib/internal/streams/stream-browser.js"(exports, module) {
      module.exports = require_events().EventEmitter;
    }
  });

  // node_modules/has-tostringtag/shams.js
  var require_shams2 = __commonJS({
    "node_modules/has-tostringtag/shams.js"(exports, module) {
      "use strict";
      var hasSymbols = require_shams();
      module.exports = function hasToStringTagShams() {
        return hasSymbols() && !!Symbol.toStringTag;
      };
    }
  });

  // node_modules/is-arguments/index.js
  var require_is_arguments = __commonJS({
    "node_modules/is-arguments/index.js"(exports, module) {
      "use strict";
      var hasToStringTag = require_shams2()();
      var callBound = require_call_bound();
      var $toString = callBound("Object.prototype.toString");
      var isStandardArguments = function isArguments(value) {
        if (hasToStringTag && value && typeof value === "object" && Symbol.toStringTag in value) {
          return false;
        }
        return $toString(value) === "[object Arguments]";
      };
      var isLegacyArguments = function isArguments(value) {
        if (isStandardArguments(value)) {
          return true;
        }
        return value !== null && typeof value === "object" && "length" in value && typeof value.length === "number" && value.length >= 0 && $toString(value) !== "[object Array]" && "callee" in value && $toString(value.callee) === "[object Function]";
      };
      var supportsStandardArguments = (function() {
        return isStandardArguments(arguments);
      })();
      isStandardArguments.isLegacyArguments = isLegacyArguments;
      module.exports = supportsStandardArguments ? isStandardArguments : isLegacyArguments;
    }
  });

  // node_modules/is-regex/index.js
  var require_is_regex = __commonJS({
    "node_modules/is-regex/index.js"(exports, module) {
      "use strict";
      var callBound = require_call_bound();
      var hasToStringTag = require_shams2()();
      var hasOwn = require_hasown();
      var gOPD = require_gopd();
      var fn;
      if (hasToStringTag) {
        $exec = callBound("RegExp.prototype.exec");
        isRegexMarker = {};
        throwRegexMarker = function() {
          throw isRegexMarker;
        };
        badStringifier = {
          toString: throwRegexMarker,
          valueOf: throwRegexMarker
        };
        if (typeof Symbol.toPrimitive === "symbol") {
          badStringifier[Symbol.toPrimitive] = throwRegexMarker;
        }
        fn = function isRegex(value) {
          if (!value || typeof value !== "object") {
            return false;
          }
          var descriptor = (
            /** @type {NonNullable<typeof gOPD>} */
            gOPD(
              /** @type {{ lastIndex?: unknown }} */
              value,
              "lastIndex"
            )
          );
          var hasLastIndexDataProperty = descriptor && hasOwn(descriptor, "value");
          if (!hasLastIndexDataProperty) {
            return false;
          }
          try {
            $exec(
              value,
              /** @type {string} */
              /** @type {unknown} */
              badStringifier
            );
          } catch (e) {
            return e === isRegexMarker;
          }
        };
      } else {
        $toString = callBound("Object.prototype.toString");
        regexClass = "[object RegExp]";
        fn = function isRegex(value) {
          if (!value || typeof value !== "object" && typeof value !== "function") {
            return false;
          }
          return $toString(value) === regexClass;
        };
      }
      var $exec;
      var isRegexMarker;
      var throwRegexMarker;
      var badStringifier;
      var $toString;
      var regexClass;
      module.exports = fn;
    }
  });

  // node_modules/safe-regex-test/index.js
  var require_safe_regex_test = __commonJS({
    "node_modules/safe-regex-test/index.js"(exports, module) {
      "use strict";
      var callBound = require_call_bound();
      var isRegex = require_is_regex();
      var $exec = callBound("RegExp.prototype.exec");
      var $TypeError = require_type();
      module.exports = function regexTester(regex) {
        if (!isRegex(regex)) {
          throw new $TypeError("`regex` must be a RegExp");
        }
        return function test(s) {
          return $exec(regex, s) !== null;
        };
      };
    }
  });

  // node_modules/generator-function/index.js
  var require_generator_function = __commonJS({
    "node_modules/generator-function/index.js"(exports, module) {
      "use strict";
      var cached = (
        /** @type {GeneratorFunctionConstructor} */
        function* () {
        }.constructor
      );
      module.exports = () => cached;
    }
  });

  // node_modules/is-generator-function/index.js
  var require_is_generator_function = __commonJS({
    "node_modules/is-generator-function/index.js"(exports, module) {
      "use strict";
      var callBound = require_call_bound();
      var safeRegexTest = require_safe_regex_test();
      var isFnRegex = safeRegexTest(/^\s*(?:function)?\*/);
      var hasToStringTag = require_shams2()();
      var getProto = require_get_proto();
      var toStr = callBound("Object.prototype.toString");
      var fnToStr = callBound("Function.prototype.toString");
      var getGeneratorFunction = require_generator_function();
      module.exports = function isGeneratorFunction(fn) {
        if (typeof fn !== "function") {
          return false;
        }
        if (isFnRegex(fnToStr(fn))) {
          return true;
        }
        if (!hasToStringTag) {
          var str = toStr(fn);
          return str === "[object GeneratorFunction]";
        }
        if (!getProto) {
          return false;
        }
        var GeneratorFunction = getGeneratorFunction();
        return GeneratorFunction && getProto(fn) === GeneratorFunction.prototype;
      };
    }
  });

  // node_modules/is-callable/index.js
  var require_is_callable = __commonJS({
    "node_modules/is-callable/index.js"(exports, module) {
      "use strict";
      var fnToStr = Function.prototype.toString;
      var reflectApply = typeof Reflect === "object" && Reflect !== null && Reflect.apply;
      var badArrayLike;
      var isCallableMarker;
      if (typeof reflectApply === "function" && typeof Object.defineProperty === "function") {
        try {
          badArrayLike = Object.defineProperty({}, "length", {
            get: function() {
              throw isCallableMarker;
            }
          });
          isCallableMarker = {};
          reflectApply(function() {
            throw 42;
          }, null, badArrayLike);
        } catch (_) {
          if (_ !== isCallableMarker) {
            reflectApply = null;
          }
        }
      } else {
        reflectApply = null;
      }
      var constructorRegex = /^\s*class\b/;
      var isES6ClassFn = function isES6ClassFunction(value) {
        try {
          var fnStr = fnToStr.call(value);
          return constructorRegex.test(fnStr);
        } catch (e) {
          return false;
        }
      };
      var tryFunctionObject = function tryFunctionToStr(value) {
        try {
          if (isES6ClassFn(value)) {
            return false;
          }
          fnToStr.call(value);
          return true;
        } catch (e) {
          return false;
        }
      };
      var toStr = Object.prototype.toString;
      var objectClass = "[object Object]";
      var fnClass = "[object Function]";
      var genClass = "[object GeneratorFunction]";
      var ddaClass = "[object HTMLAllCollection]";
      var ddaClass2 = "[object HTML document.all class]";
      var ddaClass3 = "[object HTMLCollection]";
      var hasToStringTag = typeof Symbol === "function" && !!Symbol.toStringTag;
      var isIE68 = !(0 in [,]);
      var isDDA = function isDocumentDotAll() {
        return false;
      };
      if (typeof document === "object") {
        all = document.all;
        if (toStr.call(all) === toStr.call(document.all)) {
          isDDA = function isDocumentDotAll(value) {
            if ((isIE68 || !value) && (typeof value === "undefined" || typeof value === "object")) {
              try {
                var str = toStr.call(value);
                return (str === ddaClass || str === ddaClass2 || str === ddaClass3 || str === objectClass) && value("") == null;
              } catch (e) {
              }
            }
            return false;
          };
        }
      }
      var all;
      module.exports = reflectApply ? function isCallable(value) {
        if (isDDA(value)) {
          return true;
        }
        if (!value) {
          return false;
        }
        if (typeof value !== "function" && typeof value !== "object") {
          return false;
        }
        try {
          reflectApply(value, null, badArrayLike);
        } catch (e) {
          if (e !== isCallableMarker) {
            return false;
          }
        }
        return !isES6ClassFn(value) && tryFunctionObject(value);
      } : function isCallable(value) {
        if (isDDA(value)) {
          return true;
        }
        if (!value) {
          return false;
        }
        if (typeof value !== "function" && typeof value !== "object") {
          return false;
        }
        if (hasToStringTag) {
          return tryFunctionObject(value);
        }
        if (isES6ClassFn(value)) {
          return false;
        }
        var strClass = toStr.call(value);
        if (strClass !== fnClass && strClass !== genClass && !/^\[object HTML/.test(strClass)) {
          return false;
        }
        return tryFunctionObject(value);
      };
    }
  });

  // node_modules/for-each/index.js
  var require_for_each = __commonJS({
    "node_modules/for-each/index.js"(exports, module) {
      "use strict";
      var isCallable = require_is_callable();
      var toStr = Object.prototype.toString;
      var hasOwnProperty = Object.prototype.hasOwnProperty;
      var forEachArray = function forEachArray2(array, iterator, receiver) {
        for (var i = 0, len = array.length; i < len; i++) {
          if (hasOwnProperty.call(array, i)) {
            if (receiver == null) {
              iterator(array[i], i, array);
            } else {
              iterator.call(receiver, array[i], i, array);
            }
          }
        }
      };
      var forEachString = function forEachString2(string, iterator, receiver) {
        for (var i = 0, len = string.length; i < len; i++) {
          if (receiver == null) {
            iterator(string.charAt(i), i, string);
          } else {
            iterator.call(receiver, string.charAt(i), i, string);
          }
        }
      };
      var forEachObject = function forEachObject2(object, iterator, receiver) {
        for (var k in object) {
          if (hasOwnProperty.call(object, k)) {
            if (receiver == null) {
              iterator(object[k], k, object);
            } else {
              iterator.call(receiver, object[k], k, object);
            }
          }
        }
      };
      function isArray(x) {
        return toStr.call(x) === "[object Array]";
      }
      module.exports = function forEach(list2, iterator, thisArg) {
        if (!isCallable(iterator)) {
          throw new TypeError("iterator must be a function");
        }
        var receiver;
        if (arguments.length >= 3) {
          receiver = thisArg;
        }
        if (isArray(list2)) {
          forEachArray(list2, iterator, receiver);
        } else if (typeof list2 === "string") {
          forEachString(list2, iterator, receiver);
        } else {
          forEachObject(list2, iterator, receiver);
        }
      };
    }
  });

  // node_modules/possible-typed-array-names/index.js
  var require_possible_typed_array_names = __commonJS({
    "node_modules/possible-typed-array-names/index.js"(exports, module) {
      "use strict";
      module.exports = [
        "Float16Array",
        "Float32Array",
        "Float64Array",
        "Int8Array",
        "Int16Array",
        "Int32Array",
        "Uint8Array",
        "Uint8ClampedArray",
        "Uint16Array",
        "Uint32Array",
        "BigInt64Array",
        "BigUint64Array"
      ];
    }
  });

  // node_modules/available-typed-arrays/index.js
  var require_available_typed_arrays = __commonJS({
    "node_modules/available-typed-arrays/index.js"(exports, module) {
      "use strict";
      var possibleNames = require_possible_typed_array_names();
      var g = typeof globalThis === "undefined" ? global : globalThis;
      module.exports = function availableTypedArrays() {
        var out = [];
        for (var i = 0; i < possibleNames.length; i++) {
          if (typeof g[possibleNames[i]] === "function") {
            out[out.length] = possibleNames[i];
          }
        }
        return out;
      };
    }
  });

  // node_modules/define-data-property/index.js
  var require_define_data_property = __commonJS({
    "node_modules/define-data-property/index.js"(exports, module) {
      "use strict";
      var $defineProperty = require_es_define_property();
      var $SyntaxError = require_syntax();
      var $TypeError = require_type();
      var gopd = require_gopd();
      module.exports = function defineDataProperty(obj, property, value) {
        if (!obj || typeof obj !== "object" && typeof obj !== "function") {
          throw new $TypeError("`obj` must be an object or a function`");
        }
        if (typeof property !== "string" && typeof property !== "symbol") {
          throw new $TypeError("`property` must be a string or a symbol`");
        }
        if (arguments.length > 3 && typeof arguments[3] !== "boolean" && arguments[3] !== null) {
          throw new $TypeError("`nonEnumerable`, if provided, must be a boolean or null");
        }
        if (arguments.length > 4 && typeof arguments[4] !== "boolean" && arguments[4] !== null) {
          throw new $TypeError("`nonWritable`, if provided, must be a boolean or null");
        }
        if (arguments.length > 5 && typeof arguments[5] !== "boolean" && arguments[5] !== null) {
          throw new $TypeError("`nonConfigurable`, if provided, must be a boolean or null");
        }
        if (arguments.length > 6 && typeof arguments[6] !== "boolean") {
          throw new $TypeError("`loose`, if provided, must be a boolean");
        }
        var nonEnumerable = arguments.length > 3 ? arguments[3] : null;
        var nonWritable = arguments.length > 4 ? arguments[4] : null;
        var nonConfigurable = arguments.length > 5 ? arguments[5] : null;
        var loose = arguments.length > 6 ? arguments[6] : false;
        var desc = !!gopd && gopd(obj, property);
        if ($defineProperty) {
          $defineProperty(obj, property, {
            configurable: nonConfigurable === null && desc ? desc.configurable : !nonConfigurable,
            enumerable: nonEnumerable === null && desc ? desc.enumerable : !nonEnumerable,
            value,
            writable: nonWritable === null && desc ? desc.writable : !nonWritable
          });
        } else if (loose || !nonEnumerable && !nonWritable && !nonConfigurable) {
          obj[property] = value;
        } else {
          throw new $SyntaxError("This environment does not support defining a property as non-configurable, non-writable, or non-enumerable.");
        }
      };
    }
  });

  // node_modules/has-property-descriptors/index.js
  var require_has_property_descriptors = __commonJS({
    "node_modules/has-property-descriptors/index.js"(exports, module) {
      "use strict";
      var $defineProperty = require_es_define_property();
      var hasPropertyDescriptors = function hasPropertyDescriptors2() {
        return !!$defineProperty;
      };
      hasPropertyDescriptors.hasArrayLengthDefineBug = function hasArrayLengthDefineBug() {
        if (!$defineProperty) {
          return null;
        }
        try {
          return $defineProperty([], "length", { value: 1 }).length !== 1;
        } catch (e) {
          return true;
        }
      };
      module.exports = hasPropertyDescriptors;
    }
  });

  // node_modules/set-function-length/index.js
  var require_set_function_length = __commonJS({
    "node_modules/set-function-length/index.js"(exports, module) {
      "use strict";
      var GetIntrinsic = require_get_intrinsic();
      var define2 = require_define_data_property();
      var hasDescriptors = require_has_property_descriptors()();
      var gOPD = require_gopd();
      var $TypeError = require_type();
      var $floor = GetIntrinsic("%Math.floor%");
      module.exports = function setFunctionLength(fn, length) {
        if (typeof fn !== "function") {
          throw new $TypeError("`fn` is not a function");
        }
        if (typeof length !== "number" || length < 0 || length > 4294967295 || $floor(length) !== length) {
          throw new $TypeError("`length` must be a positive 32-bit integer");
        }
        var loose = arguments.length > 2 && !!arguments[2];
        var functionLengthIsConfigurable = true;
        var functionLengthIsWritable = true;
        if ("length" in fn && gOPD) {
          var desc = gOPD(fn, "length");
          if (desc && !desc.configurable) {
            functionLengthIsConfigurable = false;
          }
          if (desc && !desc.writable) {
            functionLengthIsWritable = false;
          }
        }
        if (functionLengthIsConfigurable || functionLengthIsWritable || !loose) {
          if (hasDescriptors) {
            define2(
              /** @type {Parameters<define>[0]} */
              fn,
              "length",
              length,
              true,
              true
            );
          } else {
            define2(
              /** @type {Parameters<define>[0]} */
              fn,
              "length",
              length
            );
          }
        }
        return fn;
      };
    }
  });

  // node_modules/call-bind-apply-helpers/applyBind.js
  var require_applyBind = __commonJS({
    "node_modules/call-bind-apply-helpers/applyBind.js"(exports, module) {
      "use strict";
      var bind = require_function_bind();
      var $apply = require_functionApply();
      var actualApply = require_actualApply();
      module.exports = function applyBind() {
        return actualApply(bind, $apply, arguments);
      };
    }
  });

  // node_modules/call-bind/index.js
  var require_call_bind = __commonJS({
    "node_modules/call-bind/index.js"(exports, module) {
      "use strict";
      var setFunctionLength = require_set_function_length();
      var $defineProperty = require_es_define_property();
      var callBindBasic = require_call_bind_apply_helpers();
      var applyBind = require_applyBind();
      module.exports = function callBind(originalFunction) {
        var func = callBindBasic(arguments);
        var adjustedLength = 1 + originalFunction.length - (arguments.length - 1);
        return setFunctionLength(
          func,
          adjustedLength > 0 ? adjustedLength : 0,
          true
        );
      };
      if ($defineProperty) {
        $defineProperty(module.exports, "apply", { value: applyBind });
      } else {
        module.exports.apply = applyBind;
      }
    }
  });

  // node_modules/which-typed-array/index.js
  var require_which_typed_array = __commonJS({
    "node_modules/which-typed-array/index.js"(exports, module) {
      "use strict";
      var forEach = require_for_each();
      var availableTypedArrays = require_available_typed_arrays();
      var callBind = require_call_bind();
      var callBound = require_call_bound();
      var gOPD = require_gopd();
      var getProto = require_get_proto();
      var $toString = callBound("Object.prototype.toString");
      var hasToStringTag = require_shams2()();
      var g = typeof globalThis === "undefined" ? global : globalThis;
      var typedArrays = availableTypedArrays();
      var $slice = callBound("String.prototype.slice");
      var $indexOf = callBound("Array.prototype.indexOf", true) || function indexOf(array, value) {
        for (var i = 0; i < array.length; i += 1) {
          if (array[i] === value) {
            return i;
          }
        }
        return -1;
      };
      var cache = { __proto__: null };
      if (hasToStringTag && gOPD && getProto) {
        forEach(typedArrays, function(typedArray) {
          var arr = new g[typedArray]();
          if (Symbol.toStringTag in arr && getProto) {
            var proto = getProto(arr);
            var descriptor = gOPD(proto, Symbol.toStringTag);
            if (!descriptor && proto) {
              var superProto = getProto(proto);
              descriptor = gOPD(superProto, Symbol.toStringTag);
            }
            if (descriptor && descriptor.get) {
              var bound = callBind(descriptor.get);
              cache[
                /** @type {`$${TypedArrayName}`} */
                "$" + typedArray
              ] = bound;
            }
          }
        });
      } else {
        forEach(typedArrays, function(typedArray) {
          var arr = new g[typedArray]();
          var fn = arr.slice || arr.set;
          if (fn) {
            var bound = (
              /** @type {BoundSlice | BoundSet} */
              // @ts-expect-error TODO FIXME
              callBind(fn)
            );
            cache[
              /** @type {`$${TypedArrayName}`} */
              "$" + typedArray
            ] = bound;
          }
        });
      }
      function tryTypedArrays(value) {
        var found = false;
        forEach(
          /** @type {Record<`$${TypedArrayName}`, Getter>} */
          cache,
          /** @param {Getter} getter @param {`$${TypedArrayName}`} typedArray */
          function(getter, typedArray) {
            if (!found) {
              try {
                if ("$" + getter(value) === typedArray) {
                  found = /** @type {TypedArrayName} */
                  $slice(typedArray, 1);
                }
              } catch (e) {
              }
            }
          }
        );
        return found;
      }
      function trySlices(value) {
        var found = false;
        forEach(
          /** @type {Record<`$${TypedArrayName}`, Getter>} */
          cache,
          /** @param {Getter} getter @param {`$${TypedArrayName}`} name */
          function(getter, name) {
            if (!found) {
              try {
                getter(value);
                found = /** @type {TypedArrayName} */
                $slice(name, 1);
              } catch (e) {
              }
            }
          }
        );
        return found;
      }
      function isTATag(tag) {
        return $indexOf(typedArrays, tag) > -1;
      }
      module.exports = function whichTypedArray(value) {
        if (!value || typeof value !== "object") {
          return false;
        }
        if (!hasToStringTag) {
          var tag = $slice($toString(value), 8, -1);
          if (isTATag(tag)) {
            return tag;
          }
          if (tag !== "Object") {
            return false;
          }
          return trySlices(value);
        }
        if (!gOPD) {
          return null;
        }
        return tryTypedArrays(value);
      };
    }
  });

  // node_modules/is-typed-array/index.js
  var require_is_typed_array = __commonJS({
    "node_modules/is-typed-array/index.js"(exports, module) {
      "use strict";
      var whichTypedArray = require_which_typed_array();
      module.exports = function isTypedArray(value) {
        return !!whichTypedArray(value);
      };
    }
  });

  // node_modules/util/support/types.js
  var require_types3 = __commonJS({
    "node_modules/util/support/types.js"(exports) {
      "use strict";
      var isArgumentsObject = require_is_arguments();
      var isGeneratorFunction = require_is_generator_function();
      var whichTypedArray = require_which_typed_array();
      var isTypedArray = require_is_typed_array();
      function uncurryThis(f) {
        return f.call.bind(f);
      }
      var BigIntSupported = typeof BigInt !== "undefined";
      var SymbolSupported = typeof Symbol !== "undefined";
      var ObjectToString = uncurryThis(Object.prototype.toString);
      var numberValue = uncurryThis(Number.prototype.valueOf);
      var stringValue = uncurryThis(String.prototype.valueOf);
      var booleanValue = uncurryThis(Boolean.prototype.valueOf);
      if (BigIntSupported) {
        bigIntValue = uncurryThis(BigInt.prototype.valueOf);
      }
      var bigIntValue;
      if (SymbolSupported) {
        symbolValue = uncurryThis(Symbol.prototype.valueOf);
      }
      var symbolValue;
      function checkBoxedPrimitive(value, prototypeValueOf) {
        if (typeof value !== "object") {
          return false;
        }
        try {
          prototypeValueOf(value);
          return true;
        } catch (e) {
          return false;
        }
      }
      exports.isArgumentsObject = isArgumentsObject;
      exports.isGeneratorFunction = isGeneratorFunction;
      exports.isTypedArray = isTypedArray;
      function isPromise(input) {
        return typeof Promise !== "undefined" && input instanceof Promise || input !== null && typeof input === "object" && typeof input.then === "function" && typeof input.catch === "function";
      }
      exports.isPromise = isPromise;
      function isArrayBufferView(value) {
        if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView) {
          return ArrayBuffer.isView(value);
        }
        return isTypedArray(value) || isDataView(value);
      }
      exports.isArrayBufferView = isArrayBufferView;
      function isUint8Array(value) {
        return whichTypedArray(value) === "Uint8Array";
      }
      exports.isUint8Array = isUint8Array;
      function isUint8ClampedArray(value) {
        return whichTypedArray(value) === "Uint8ClampedArray";
      }
      exports.isUint8ClampedArray = isUint8ClampedArray;
      function isUint16Array(value) {
        return whichTypedArray(value) === "Uint16Array";
      }
      exports.isUint16Array = isUint16Array;
      function isUint32Array(value) {
        return whichTypedArray(value) === "Uint32Array";
      }
      exports.isUint32Array = isUint32Array;
      function isInt8Array(value) {
        return whichTypedArray(value) === "Int8Array";
      }
      exports.isInt8Array = isInt8Array;
      function isInt16Array(value) {
        return whichTypedArray(value) === "Int16Array";
      }
      exports.isInt16Array = isInt16Array;
      function isInt32Array(value) {
        return whichTypedArray(value) === "Int32Array";
      }
      exports.isInt32Array = isInt32Array;
      function isFloat32Array(value) {
        return whichTypedArray(value) === "Float32Array";
      }
      exports.isFloat32Array = isFloat32Array;
      function isFloat64Array(value) {
        return whichTypedArray(value) === "Float64Array";
      }
      exports.isFloat64Array = isFloat64Array;
      function isBigInt64Array(value) {
        return whichTypedArray(value) === "BigInt64Array";
      }
      exports.isBigInt64Array = isBigInt64Array;
      function isBigUint64Array(value) {
        return whichTypedArray(value) === "BigUint64Array";
      }
      exports.isBigUint64Array = isBigUint64Array;
      function isMapToString(value) {
        return ObjectToString(value) === "[object Map]";
      }
      isMapToString.working = typeof Map !== "undefined" && isMapToString(/* @__PURE__ */ new Map());
      function isMap(value) {
        if (typeof Map === "undefined") {
          return false;
        }
        return isMapToString.working ? isMapToString(value) : value instanceof Map;
      }
      exports.isMap = isMap;
      function isSetToString(value) {
        return ObjectToString(value) === "[object Set]";
      }
      isSetToString.working = typeof Set !== "undefined" && isSetToString(/* @__PURE__ */ new Set());
      function isSet(value) {
        if (typeof Set === "undefined") {
          return false;
        }
        return isSetToString.working ? isSetToString(value) : value instanceof Set;
      }
      exports.isSet = isSet;
      function isWeakMapToString(value) {
        return ObjectToString(value) === "[object WeakMap]";
      }
      isWeakMapToString.working = typeof WeakMap !== "undefined" && isWeakMapToString(/* @__PURE__ */ new WeakMap());
      function isWeakMap(value) {
        if (typeof WeakMap === "undefined") {
          return false;
        }
        return isWeakMapToString.working ? isWeakMapToString(value) : value instanceof WeakMap;
      }
      exports.isWeakMap = isWeakMap;
      function isWeakSetToString(value) {
        return ObjectToString(value) === "[object WeakSet]";
      }
      isWeakSetToString.working = typeof WeakSet !== "undefined" && isWeakSetToString(/* @__PURE__ */ new WeakSet());
      function isWeakSet(value) {
        return isWeakSetToString(value);
      }
      exports.isWeakSet = isWeakSet;
      function isArrayBufferToString(value) {
        return ObjectToString(value) === "[object ArrayBuffer]";
      }
      isArrayBufferToString.working = typeof ArrayBuffer !== "undefined" && isArrayBufferToString(new ArrayBuffer());
      function isArrayBuffer(value) {
        if (typeof ArrayBuffer === "undefined") {
          return false;
        }
        return isArrayBufferToString.working ? isArrayBufferToString(value) : value instanceof ArrayBuffer;
      }
      exports.isArrayBuffer = isArrayBuffer;
      function isDataViewToString(value) {
        return ObjectToString(value) === "[object DataView]";
      }
      isDataViewToString.working = typeof ArrayBuffer !== "undefined" && typeof DataView !== "undefined" && isDataViewToString(new DataView(new ArrayBuffer(1), 0, 1));
      function isDataView(value) {
        if (typeof DataView === "undefined") {
          return false;
        }
        return isDataViewToString.working ? isDataViewToString(value) : value instanceof DataView;
      }
      exports.isDataView = isDataView;
      var SharedArrayBufferCopy = typeof SharedArrayBuffer !== "undefined" ? SharedArrayBuffer : void 0;
      function isSharedArrayBufferToString(value) {
        return ObjectToString(value) === "[object SharedArrayBuffer]";
      }
      function isSharedArrayBuffer(value) {
        if (typeof SharedArrayBufferCopy === "undefined") {
          return false;
        }
        if (typeof isSharedArrayBufferToString.working === "undefined") {
          isSharedArrayBufferToString.working = isSharedArrayBufferToString(new SharedArrayBufferCopy());
        }
        return isSharedArrayBufferToString.working ? isSharedArrayBufferToString(value) : value instanceof SharedArrayBufferCopy;
      }
      exports.isSharedArrayBuffer = isSharedArrayBuffer;
      function isAsyncFunction(value) {
        return ObjectToString(value) === "[object AsyncFunction]";
      }
      exports.isAsyncFunction = isAsyncFunction;
      function isMapIterator(value) {
        return ObjectToString(value) === "[object Map Iterator]";
      }
      exports.isMapIterator = isMapIterator;
      function isSetIterator(value) {
        return ObjectToString(value) === "[object Set Iterator]";
      }
      exports.isSetIterator = isSetIterator;
      function isGeneratorObject(value) {
        return ObjectToString(value) === "[object Generator]";
      }
      exports.isGeneratorObject = isGeneratorObject;
      function isWebAssemblyCompiledModule(value) {
        return ObjectToString(value) === "[object WebAssembly.Module]";
      }
      exports.isWebAssemblyCompiledModule = isWebAssemblyCompiledModule;
      function isNumberObject(value) {
        return checkBoxedPrimitive(value, numberValue);
      }
      exports.isNumberObject = isNumberObject;
      function isStringObject(value) {
        return checkBoxedPrimitive(value, stringValue);
      }
      exports.isStringObject = isStringObject;
      function isBooleanObject(value) {
        return checkBoxedPrimitive(value, booleanValue);
      }
      exports.isBooleanObject = isBooleanObject;
      function isBigIntObject(value) {
        return BigIntSupported && checkBoxedPrimitive(value, bigIntValue);
      }
      exports.isBigIntObject = isBigIntObject;
      function isSymbolObject(value) {
        return SymbolSupported && checkBoxedPrimitive(value, symbolValue);
      }
      exports.isSymbolObject = isSymbolObject;
      function isBoxedPrimitive(value) {
        return isNumberObject(value) || isStringObject(value) || isBooleanObject(value) || isBigIntObject(value) || isSymbolObject(value);
      }
      exports.isBoxedPrimitive = isBoxedPrimitive;
      function isAnyArrayBuffer(value) {
        return typeof Uint8Array !== "undefined" && (isArrayBuffer(value) || isSharedArrayBuffer(value));
      }
      exports.isAnyArrayBuffer = isAnyArrayBuffer;
      ["isProxy", "isExternal", "isModuleNamespaceObject"].forEach(function(method) {
        Object.defineProperty(exports, method, {
          enumerable: false,
          value: function() {
            throw new Error(method + " is not supported in userland");
          }
        });
      });
    }
  });

  // node_modules/util/support/isBufferBrowser.js
  var require_isBufferBrowser = __commonJS({
    "node_modules/util/support/isBufferBrowser.js"(exports, module) {
      module.exports = function isBuffer(arg) {
        return arg && typeof arg === "object" && typeof arg.copy === "function" && typeof arg.fill === "function" && typeof arg.readUInt8 === "function";
      };
    }
  });

  // node_modules/util/util.js
  var require_util4 = __commonJS({
    "node_modules/util/util.js"(exports) {
      var getOwnPropertyDescriptors = Object.getOwnPropertyDescriptors || function getOwnPropertyDescriptors2(obj) {
        var keys = Object.keys(obj);
        var descriptors = {};
        for (var i = 0; i < keys.length; i++) {
          descriptors[keys[i]] = Object.getOwnPropertyDescriptor(obj, keys[i]);
        }
        return descriptors;
      };
      var formatRegExp = /%[sdj%]/g;
      exports.format = function(f) {
        if (!isString(f)) {
          var objects = [];
          for (var i = 0; i < arguments.length; i++) {
            objects.push(inspect(arguments[i]));
          }
          return objects.join(" ");
        }
        var i = 1;
        var args = arguments;
        var len = args.length;
        var str = String(f).replace(formatRegExp, function(x2) {
          if (x2 === "%%") return "%";
          if (i >= len) return x2;
          switch (x2) {
            case "%s":
              return String(args[i++]);
            case "%d":
              return Number(args[i++]);
            case "%j":
              try {
                return JSON.stringify(args[i++]);
              } catch (_) {
                return "[Circular]";
              }
            default:
              return x2;
          }
        });
        for (var x = args[i]; i < len; x = args[++i]) {
          if (isNull(x) || !isObject(x)) {
            str += " " + x;
          } else {
            str += " " + inspect(x);
          }
        }
        return str;
      };
      exports.deprecate = function(fn, msg) {
        if (typeof process !== "undefined" && process.noDeprecation === true) {
          return fn;
        }
        if (typeof process === "undefined") {
          return function() {
            return exports.deprecate(fn, msg).apply(this, arguments);
          };
        }
        var warned = false;
        function deprecated() {
          if (!warned) {
            if (process.throwDeprecation) {
              throw new Error(msg);
            } else if (process.traceDeprecation) {
              console.trace(msg);
            } else {
              console.error(msg);
            }
            warned = true;
          }
          return fn.apply(this, arguments);
        }
        return deprecated;
      };
      var debugs = {};
      var debugEnvRegex = /^$/;
      if (process.env.NODE_DEBUG) {
        debugEnv = process.env.NODE_DEBUG;
        debugEnv = debugEnv.replace(/[|\\{}()[\]^$+?.]/g, "\\$&").replace(/\*/g, ".*").replace(/,/g, "$|^").toUpperCase();
        debugEnvRegex = new RegExp("^" + debugEnv + "$", "i");
      }
      var debugEnv;
      exports.debuglog = function(set) {
        set = set.toUpperCase();
        if (!debugs[set]) {
          if (debugEnvRegex.test(set)) {
            var pid2 = process.pid;
            debugs[set] = function() {
              var msg = exports.format.apply(exports, arguments);
              console.error("%s %d: %s", set, pid2, msg);
            };
          } else {
            debugs[set] = function() {
            };
          }
        }
        return debugs[set];
      };
      function inspect(obj, opts) {
        var ctx = {
          seen: [],
          stylize: stylizeNoColor
        };
        if (arguments.length >= 3) ctx.depth = arguments[2];
        if (arguments.length >= 4) ctx.colors = arguments[3];
        if (isBoolean(opts)) {
          ctx.showHidden = opts;
        } else if (opts) {
          exports._extend(ctx, opts);
        }
        if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
        if (isUndefined(ctx.depth)) ctx.depth = 2;
        if (isUndefined(ctx.colors)) ctx.colors = false;
        if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
        if (ctx.colors) ctx.stylize = stylizeWithColor;
        return formatValue(ctx, obj, ctx.depth);
      }
      exports.inspect = inspect;
      inspect.colors = {
        "bold": [1, 22],
        "italic": [3, 23],
        "underline": [4, 24],
        "inverse": [7, 27],
        "white": [37, 39],
        "grey": [90, 39],
        "black": [30, 39],
        "blue": [34, 39],
        "cyan": [36, 39],
        "green": [32, 39],
        "magenta": [35, 39],
        "red": [31, 39],
        "yellow": [33, 39]
      };
      inspect.styles = {
        "special": "cyan",
        "number": "yellow",
        "boolean": "yellow",
        "undefined": "grey",
        "null": "bold",
        "string": "green",
        "date": "magenta",
        // "name": intentionally not styling
        "regexp": "red"
      };
      function stylizeWithColor(str, styleType) {
        var style = inspect.styles[styleType];
        if (style) {
          return "\x1B[" + inspect.colors[style][0] + "m" + str + "\x1B[" + inspect.colors[style][1] + "m";
        } else {
          return str;
        }
      }
      function stylizeNoColor(str, styleType) {
        return str;
      }
      function arrayToHash(array) {
        var hash = {};
        array.forEach(function(val, idx) {
          hash[val] = true;
        });
        return hash;
      }
      function formatValue(ctx, value, recurseTimes) {
        if (ctx.customInspect && value && isFunction(value.inspect) && // Filter out the util module, it's inspect function is special
        value.inspect !== exports.inspect && // Also filter out any prototype objects using the circular check.
        !(value.constructor && value.constructor.prototype === value)) {
          var ret = value.inspect(recurseTimes, ctx);
          if (!isString(ret)) {
            ret = formatValue(ctx, ret, recurseTimes);
          }
          return ret;
        }
        var primitive = formatPrimitive(ctx, value);
        if (primitive) {
          return primitive;
        }
        var keys = Object.keys(value);
        var visibleKeys = arrayToHash(keys);
        if (ctx.showHidden) {
          keys = Object.getOwnPropertyNames(value);
        }
        if (isError(value) && (keys.indexOf("message") >= 0 || keys.indexOf("description") >= 0)) {
          return formatError(value);
        }
        if (keys.length === 0) {
          if (isFunction(value)) {
            var name = value.name ? ": " + value.name : "";
            return ctx.stylize("[Function" + name + "]", "special");
          }
          if (isRegExp(value)) {
            return ctx.stylize(RegExp.prototype.toString.call(value), "regexp");
          }
          if (isDate(value)) {
            return ctx.stylize(Date.prototype.toString.call(value), "date");
          }
          if (isError(value)) {
            return formatError(value);
          }
        }
        var base2 = "", array = false, braces = ["{", "}"];
        if (isArray(value)) {
          array = true;
          braces = ["[", "]"];
        }
        if (isFunction(value)) {
          var n = value.name ? ": " + value.name : "";
          base2 = " [Function" + n + "]";
        }
        if (isRegExp(value)) {
          base2 = " " + RegExp.prototype.toString.call(value);
        }
        if (isDate(value)) {
          base2 = " " + Date.prototype.toUTCString.call(value);
        }
        if (isError(value)) {
          base2 = " " + formatError(value);
        }
        if (keys.length === 0 && (!array || value.length == 0)) {
          return braces[0] + base2 + braces[1];
        }
        if (recurseTimes < 0) {
          if (isRegExp(value)) {
            return ctx.stylize(RegExp.prototype.toString.call(value), "regexp");
          } else {
            return ctx.stylize("[Object]", "special");
          }
        }
        ctx.seen.push(value);
        var output;
        if (array) {
          output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
        } else {
          output = keys.map(function(key) {
            return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
          });
        }
        ctx.seen.pop();
        return reduceToSingleString(output, base2, braces);
      }
      function formatPrimitive(ctx, value) {
        if (isUndefined(value))
          return ctx.stylize("undefined", "undefined");
        if (isString(value)) {
          var simple = "'" + JSON.stringify(value).replace(/^"|"$/g, "").replace(/'/g, "\\'").replace(/\\"/g, '"') + "'";
          return ctx.stylize(simple, "string");
        }
        if (isNumber(value))
          return ctx.stylize("" + value, "number");
        if (isBoolean(value))
          return ctx.stylize("" + value, "boolean");
        if (isNull(value))
          return ctx.stylize("null", "null");
      }
      function formatError(value) {
        return "[" + Error.prototype.toString.call(value) + "]";
      }
      function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
        var output = [];
        for (var i = 0, l = value.length; i < l; ++i) {
          if (hasOwnProperty(value, String(i))) {
            output.push(formatProperty(
              ctx,
              value,
              recurseTimes,
              visibleKeys,
              String(i),
              true
            ));
          } else {
            output.push("");
          }
        }
        keys.forEach(function(key) {
          if (!key.match(/^\d+$/)) {
            output.push(formatProperty(
              ctx,
              value,
              recurseTimes,
              visibleKeys,
              key,
              true
            ));
          }
        });
        return output;
      }
      function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
        var name, str, desc;
        desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
        if (desc.get) {
          if (desc.set) {
            str = ctx.stylize("[Getter/Setter]", "special");
          } else {
            str = ctx.stylize("[Getter]", "special");
          }
        } else {
          if (desc.set) {
            str = ctx.stylize("[Setter]", "special");
          }
        }
        if (!hasOwnProperty(visibleKeys, key)) {
          name = "[" + key + "]";
        }
        if (!str) {
          if (ctx.seen.indexOf(desc.value) < 0) {
            if (isNull(recurseTimes)) {
              str = formatValue(ctx, desc.value, null);
            } else {
              str = formatValue(ctx, desc.value, recurseTimes - 1);
            }
            if (str.indexOf("\n") > -1) {
              if (array) {
                str = str.split("\n").map(function(line) {
                  return "  " + line;
                }).join("\n").slice(2);
              } else {
                str = "\n" + str.split("\n").map(function(line) {
                  return "   " + line;
                }).join("\n");
              }
            }
          } else {
            str = ctx.stylize("[Circular]", "special");
          }
        }
        if (isUndefined(name)) {
          if (array && key.match(/^\d+$/)) {
            return str;
          }
          name = JSON.stringify("" + key);
          if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
            name = name.slice(1, -1);
            name = ctx.stylize(name, "name");
          } else {
            name = name.replace(/'/g, "\\'").replace(/\\"/g, '"').replace(/(^"|"$)/g, "'");
            name = ctx.stylize(name, "string");
          }
        }
        return name + ": " + str;
      }
      function reduceToSingleString(output, base2, braces) {
        var numLinesEst = 0;
        var length = output.reduce(function(prev, cur) {
          numLinesEst++;
          if (cur.indexOf("\n") >= 0) numLinesEst++;
          return prev + cur.replace(/\u001b\[\d\d?m/g, "").length + 1;
        }, 0);
        if (length > 60) {
          return braces[0] + (base2 === "" ? "" : base2 + "\n ") + " " + output.join(",\n  ") + " " + braces[1];
        }
        return braces[0] + base2 + " " + output.join(", ") + " " + braces[1];
      }
      exports.types = require_types3();
      function isArray(ar) {
        return Array.isArray(ar);
      }
      exports.isArray = isArray;
      function isBoolean(arg) {
        return typeof arg === "boolean";
      }
      exports.isBoolean = isBoolean;
      function isNull(arg) {
        return arg === null;
      }
      exports.isNull = isNull;
      function isNullOrUndefined(arg) {
        return arg == null;
      }
      exports.isNullOrUndefined = isNullOrUndefined;
      function isNumber(arg) {
        return typeof arg === "number";
      }
      exports.isNumber = isNumber;
      function isString(arg) {
        return typeof arg === "string";
      }
      exports.isString = isString;
      function isSymbol(arg) {
        return typeof arg === "symbol";
      }
      exports.isSymbol = isSymbol;
      function isUndefined(arg) {
        return arg === void 0;
      }
      exports.isUndefined = isUndefined;
      function isRegExp(re) {
        return isObject(re) && objectToString(re) === "[object RegExp]";
      }
      exports.isRegExp = isRegExp;
      exports.types.isRegExp = isRegExp;
      function isObject(arg) {
        return typeof arg === "object" && arg !== null;
      }
      exports.isObject = isObject;
      function isDate(d) {
        return isObject(d) && objectToString(d) === "[object Date]";
      }
      exports.isDate = isDate;
      exports.types.isDate = isDate;
      function isError(e) {
        return isObject(e) && (objectToString(e) === "[object Error]" || e instanceof Error);
      }
      exports.isError = isError;
      exports.types.isNativeError = isError;
      function isFunction(arg) {
        return typeof arg === "function";
      }
      exports.isFunction = isFunction;
      function isPrimitive(arg) {
        return arg === null || typeof arg === "boolean" || typeof arg === "number" || typeof arg === "string" || typeof arg === "symbol" || // ES6 symbol
        typeof arg === "undefined";
      }
      exports.isPrimitive = isPrimitive;
      exports.isBuffer = require_isBufferBrowser();
      function objectToString(o) {
        return Object.prototype.toString.call(o);
      }
      function pad(n) {
        return n < 10 ? "0" + n.toString(10) : n.toString(10);
      }
      var months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec"
      ];
      function timestamp() {
        var d = /* @__PURE__ */ new Date();
        var time = [
          pad(d.getHours()),
          pad(d.getMinutes()),
          pad(d.getSeconds())
        ].join(":");
        return [d.getDate(), months[d.getMonth()], time].join(" ");
      }
      exports.log = function() {
        console.log("%s - %s", timestamp(), exports.format.apply(exports, arguments));
      };
      exports.inherits = require_inherits_browser();
      exports._extend = function(origin, add) {
        if (!add || !isObject(add)) return origin;
        var keys = Object.keys(add);
        var i = keys.length;
        while (i--) {
          origin[keys[i]] = add[keys[i]];
        }
        return origin;
      };
      function hasOwnProperty(obj, prop) {
        return Object.prototype.hasOwnProperty.call(obj, prop);
      }
      var kCustomPromisifiedSymbol = typeof Symbol !== "undefined" ? Symbol("util.promisify.custom") : void 0;
      exports.promisify = function promisify(original) {
        if (typeof original !== "function")
          throw new TypeError('The "original" argument must be of type Function');
        if (kCustomPromisifiedSymbol && original[kCustomPromisifiedSymbol]) {
          var fn = original[kCustomPromisifiedSymbol];
          if (typeof fn !== "function") {
            throw new TypeError('The "util.promisify.custom" argument must be of type Function');
          }
          Object.defineProperty(fn, kCustomPromisifiedSymbol, {
            value: fn,
            enumerable: false,
            writable: false,
            configurable: true
          });
          return fn;
        }
        function fn() {
          var promiseResolve, promiseReject;
          var promise = new Promise(function(resolve2, reject) {
            promiseResolve = resolve2;
            promiseReject = reject;
          });
          var args = [];
          for (var i = 0; i < arguments.length; i++) {
            args.push(arguments[i]);
          }
          args.push(function(err, value) {
            if (err) {
              promiseReject(err);
            } else {
              promiseResolve(value);
            }
          });
          try {
            original.apply(this, args);
          } catch (err) {
            promiseReject(err);
          }
          return promise;
        }
        Object.setPrototypeOf(fn, Object.getPrototypeOf(original));
        if (kCustomPromisifiedSymbol) Object.defineProperty(fn, kCustomPromisifiedSymbol, {
          value: fn,
          enumerable: false,
          writable: false,
          configurable: true
        });
        return Object.defineProperties(
          fn,
          getOwnPropertyDescriptors(original)
        );
      };
      exports.promisify.custom = kCustomPromisifiedSymbol;
      function callbackifyOnRejected(reason, cb) {
        if (!reason) {
          var newReason = new Error("Promise was rejected with a falsy value");
          newReason.reason = reason;
          reason = newReason;
        }
        return cb(reason);
      }
      function callbackify(original) {
        if (typeof original !== "function") {
          throw new TypeError('The "original" argument must be of type Function');
        }
        function callbackified() {
          var args = [];
          for (var i = 0; i < arguments.length; i++) {
            args.push(arguments[i]);
          }
          var maybeCb = args.pop();
          if (typeof maybeCb !== "function") {
            throw new TypeError("The last argument must be of type Function");
          }
          var self2 = this;
          var cb = function() {
            return maybeCb.apply(self2, arguments);
          };
          original.apply(this, args).then(
            function(ret) {
              process.nextTick(cb.bind(null, null, ret));
            },
            function(rej) {
              process.nextTick(callbackifyOnRejected.bind(null, rej, cb));
            }
          );
        }
        Object.setPrototypeOf(callbackified, Object.getPrototypeOf(original));
        Object.defineProperties(
          callbackified,
          getOwnPropertyDescriptors(original)
        );
        return callbackified;
      }
      exports.callbackify = callbackify;
    }
  });

  // node_modules/readable-stream/lib/internal/streams/buffer_list.js
  var require_buffer_list = __commonJS({
    "node_modules/readable-stream/lib/internal/streams/buffer_list.js"(exports, module) {
      "use strict";
      function ownKeys2(object, enumerableOnly) {
        var keys = Object.keys(object);
        if (Object.getOwnPropertySymbols) {
          var symbols = Object.getOwnPropertySymbols(object);
          enumerableOnly && (symbols = symbols.filter(function(sym) {
            return Object.getOwnPropertyDescriptor(object, sym).enumerable;
          })), keys.push.apply(keys, symbols);
        }
        return keys;
      }
      function _objectSpread(target) {
        for (var i = 1; i < arguments.length; i++) {
          var source = null != arguments[i] ? arguments[i] : {};
          i % 2 ? ownKeys2(Object(source), true).forEach(function(key) {
            _defineProperty(target, key, source[key]);
          }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys2(Object(source)).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
          });
        }
        return target;
      }
      function _defineProperty(obj, key, value) {
        key = _toPropertyKey(key);
        if (key in obj) {
          Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: true });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
          throw new TypeError("Cannot call a class as a function");
        }
      }
      function _defineProperties(target, props) {
        for (var i = 0; i < props.length; i++) {
          var descriptor = props[i];
          descriptor.enumerable = descriptor.enumerable || false;
          descriptor.configurable = true;
          if ("value" in descriptor) descriptor.writable = true;
          Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor);
        }
      }
      function _createClass(Constructor, protoProps, staticProps) {
        if (protoProps) _defineProperties(Constructor.prototype, protoProps);
        if (staticProps) _defineProperties(Constructor, staticProps);
        Object.defineProperty(Constructor, "prototype", { writable: false });
        return Constructor;
      }
      function _toPropertyKey(arg) {
        var key = _toPrimitive(arg, "string");
        return typeof key === "symbol" ? key : String(key);
      }
      function _toPrimitive(input, hint) {
        if (typeof input !== "object" || input === null) return input;
        var prim = input[Symbol.toPrimitive];
        if (prim !== void 0) {
          var res = prim.call(input, hint || "default");
          if (typeof res !== "object") return res;
          throw new TypeError("@@toPrimitive must return a primitive value.");
        }
        return (hint === "string" ? String : Number)(input);
      }
      var _require = require_buffer();
      var Buffer3 = _require.Buffer;
      var _require2 = require_util4();
      var inspect = _require2.inspect;
      var custom = inspect && inspect.custom || "inspect";
      function copyBuffer(src, target, offset) {
        Buffer3.prototype.copy.call(src, target, offset);
      }
      module.exports = /* @__PURE__ */ (function() {
        function BufferList() {
          _classCallCheck(this, BufferList);
          this.head = null;
          this.tail = null;
          this.length = 0;
        }
        _createClass(BufferList, [{
          key: "push",
          value: function push(v) {
            var entry = {
              data: v,
              next: null
            };
            if (this.length > 0) this.tail.next = entry;
            else this.head = entry;
            this.tail = entry;
            ++this.length;
          }
        }, {
          key: "unshift",
          value: function unshift(v) {
            var entry = {
              data: v,
              next: this.head
            };
            if (this.length === 0) this.tail = entry;
            this.head = entry;
            ++this.length;
          }
        }, {
          key: "shift",
          value: function shift() {
            if (this.length === 0) return;
            var ret = this.head.data;
            if (this.length === 1) this.head = this.tail = null;
            else this.head = this.head.next;
            --this.length;
            return ret;
          }
        }, {
          key: "clear",
          value: function clear() {
            this.head = this.tail = null;
            this.length = 0;
          }
        }, {
          key: "join",
          value: function join(s) {
            if (this.length === 0) return "";
            var p = this.head;
            var ret = "" + p.data;
            while (p = p.next) ret += s + p.data;
            return ret;
          }
        }, {
          key: "concat",
          value: function concat(n) {
            if (this.length === 0) return Buffer3.alloc(0);
            var ret = Buffer3.allocUnsafe(n >>> 0);
            var p = this.head;
            var i = 0;
            while (p) {
              copyBuffer(p.data, ret, i);
              i += p.data.length;
              p = p.next;
            }
            return ret;
          }
          // Consumes a specified amount of bytes or characters from the buffered data.
        }, {
          key: "consume",
          value: function consume(n, hasStrings) {
            var ret;
            if (n < this.head.data.length) {
              ret = this.head.data.slice(0, n);
              this.head.data = this.head.data.slice(n);
            } else if (n === this.head.data.length) {
              ret = this.shift();
            } else {
              ret = hasStrings ? this._getString(n) : this._getBuffer(n);
            }
            return ret;
          }
        }, {
          key: "first",
          value: function first() {
            return this.head.data;
          }
          // Consumes a specified amount of characters from the buffered data.
        }, {
          key: "_getString",
          value: function _getString(n) {
            var p = this.head;
            var c = 1;
            var ret = p.data;
            n -= ret.length;
            while (p = p.next) {
              var str = p.data;
              var nb = n > str.length ? str.length : n;
              if (nb === str.length) ret += str;
              else ret += str.slice(0, n);
              n -= nb;
              if (n === 0) {
                if (nb === str.length) {
                  ++c;
                  if (p.next) this.head = p.next;
                  else this.head = this.tail = null;
                } else {
                  this.head = p;
                  p.data = str.slice(nb);
                }
                break;
              }
              ++c;
            }
            this.length -= c;
            return ret;
          }
          // Consumes a specified amount of bytes from the buffered data.
        }, {
          key: "_getBuffer",
          value: function _getBuffer(n) {
            var ret = Buffer3.allocUnsafe(n);
            var p = this.head;
            var c = 1;
            p.data.copy(ret);
            n -= p.data.length;
            while (p = p.next) {
              var buf = p.data;
              var nb = n > buf.length ? buf.length : n;
              buf.copy(ret, ret.length - n, 0, nb);
              n -= nb;
              if (n === 0) {
                if (nb === buf.length) {
                  ++c;
                  if (p.next) this.head = p.next;
                  else this.head = this.tail = null;
                } else {
                  this.head = p;
                  p.data = buf.slice(nb);
                }
                break;
              }
              ++c;
            }
            this.length -= c;
            return ret;
          }
          // Make sure the linked list only shows the minimal necessary information.
        }, {
          key: custom,
          value: function value(_, options) {
            return inspect(this, _objectSpread(_objectSpread({}, options), {}, {
              // Only inspect one level.
              depth: 0,
              // It should not recurse.
              customInspect: false
            }));
          }
        }]);
        return BufferList;
      })();
    }
  });

  // node_modules/readable-stream/lib/internal/streams/destroy.js
  var require_destroy = __commonJS({
    "node_modules/readable-stream/lib/internal/streams/destroy.js"(exports, module) {
      "use strict";
      function destroy(err, cb) {
        var _this = this;
        var readableDestroyed = this._readableState && this._readableState.destroyed;
        var writableDestroyed = this._writableState && this._writableState.destroyed;
        if (readableDestroyed || writableDestroyed) {
          if (cb) {
            cb(err);
          } else if (err) {
            if (!this._writableState) {
              process.nextTick(emitErrorNT, this, err);
            } else if (!this._writableState.errorEmitted) {
              this._writableState.errorEmitted = true;
              process.nextTick(emitErrorNT, this, err);
            }
          }
          return this;
        }
        if (this._readableState) {
          this._readableState.destroyed = true;
        }
        if (this._writableState) {
          this._writableState.destroyed = true;
        }
        this._destroy(err || null, function(err2) {
          if (!cb && err2) {
            if (!_this._writableState) {
              process.nextTick(emitErrorAndCloseNT, _this, err2);
            } else if (!_this._writableState.errorEmitted) {
              _this._writableState.errorEmitted = true;
              process.nextTick(emitErrorAndCloseNT, _this, err2);
            } else {
              process.nextTick(emitCloseNT, _this);
            }
          } else if (cb) {
            process.nextTick(emitCloseNT, _this);
            cb(err2);
          } else {
            process.nextTick(emitCloseNT, _this);
          }
        });
        return this;
      }
      function emitErrorAndCloseNT(self2, err) {
        emitErrorNT(self2, err);
        emitCloseNT(self2);
      }
      function emitCloseNT(self2) {
        if (self2._writableState && !self2._writableState.emitClose) return;
        if (self2._readableState && !self2._readableState.emitClose) return;
        self2.emit("close");
      }
      function undestroy() {
        if (this._readableState) {
          this._readableState.destroyed = false;
          this._readableState.reading = false;
          this._readableState.ended = false;
          this._readableState.endEmitted = false;
        }
        if (this._writableState) {
          this._writableState.destroyed = false;
          this._writableState.ended = false;
          this._writableState.ending = false;
          this._writableState.finalCalled = false;
          this._writableState.prefinished = false;
          this._writableState.finished = false;
          this._writableState.errorEmitted = false;
        }
      }
      function emitErrorNT(self2, err) {
        self2.emit("error", err);
      }
      function errorOrDestroy(stream, err) {
        var rState = stream._readableState;
        var wState = stream._writableState;
        if (rState && rState.autoDestroy || wState && wState.autoDestroy) stream.destroy(err);
        else stream.emit("error", err);
      }
      module.exports = {
        destroy,
        undestroy,
        errorOrDestroy
      };
    }
  });

  // node_modules/readable-stream/errors-browser.js
  var require_errors_browser = __commonJS({
    "node_modules/readable-stream/errors-browser.js"(exports, module) {
      "use strict";
      function _inheritsLoose(subClass, superClass) {
        subClass.prototype = Object.create(superClass.prototype);
        subClass.prototype.constructor = subClass;
        subClass.__proto__ = superClass;
      }
      var codes = {};
      function createErrorType(code, message, Base) {
        if (!Base) {
          Base = Error;
        }
        function getMessage(arg1, arg2, arg3) {
          if (typeof message === "string") {
            return message;
          } else {
            return message(arg1, arg2, arg3);
          }
        }
        var NodeError = /* @__PURE__ */ (function(_Base) {
          _inheritsLoose(NodeError2, _Base);
          function NodeError2(arg1, arg2, arg3) {
            return _Base.call(this, getMessage(arg1, arg2, arg3)) || this;
          }
          return NodeError2;
        })(Base);
        NodeError.prototype.name = Base.name;
        NodeError.prototype.code = code;
        codes[code] = NodeError;
      }
      function oneOf(expected, thing) {
        if (Array.isArray(expected)) {
          var len = expected.length;
          expected = expected.map(function(i) {
            return String(i);
          });
          if (len > 2) {
            return "one of ".concat(thing, " ").concat(expected.slice(0, len - 1).join(", "), ", or ") + expected[len - 1];
          } else if (len === 2) {
            return "one of ".concat(thing, " ").concat(expected[0], " or ").concat(expected[1]);
          } else {
            return "of ".concat(thing, " ").concat(expected[0]);
          }
        } else {
          return "of ".concat(thing, " ").concat(String(expected));
        }
      }
      function startsWith(str, search, pos) {
        return str.substr(!pos || pos < 0 ? 0 : +pos, search.length) === search;
      }
      function endsWith(str, search, this_len) {
        if (this_len === void 0 || this_len > str.length) {
          this_len = str.length;
        }
        return str.substring(this_len - search.length, this_len) === search;
      }
      function includes(str, search, start) {
        if (typeof start !== "number") {
          start = 0;
        }
        if (start + search.length > str.length) {
          return false;
        } else {
          return str.indexOf(search, start) !== -1;
        }
      }
      createErrorType("ERR_INVALID_OPT_VALUE", function(name, value) {
        return 'The value "' + value + '" is invalid for option "' + name + '"';
      }, TypeError);
      createErrorType("ERR_INVALID_ARG_TYPE", function(name, expected, actual) {
        var determiner;
        if (typeof expected === "string" && startsWith(expected, "not ")) {
          determiner = "must not be";
          expected = expected.replace(/^not /, "");
        } else {
          determiner = "must be";
        }
        var msg;
        if (endsWith(name, " argument")) {
          msg = "The ".concat(name, " ").concat(determiner, " ").concat(oneOf(expected, "type"));
        } else {
          var type = includes(name, ".") ? "property" : "argument";
          msg = 'The "'.concat(name, '" ').concat(type, " ").concat(determiner, " ").concat(oneOf(expected, "type"));
        }
        msg += ". Received type ".concat(typeof actual);
        return msg;
      }, TypeError);
      createErrorType("ERR_STREAM_PUSH_AFTER_EOF", "stream.push() after EOF");
      createErrorType("ERR_METHOD_NOT_IMPLEMENTED", function(name) {
        return "The " + name + " method is not implemented";
      });
      createErrorType("ERR_STREAM_PREMATURE_CLOSE", "Premature close");
      createErrorType("ERR_STREAM_DESTROYED", function(name) {
        return "Cannot call " + name + " after a stream was destroyed";
      });
      createErrorType("ERR_MULTIPLE_CALLBACK", "Callback called multiple times");
      createErrorType("ERR_STREAM_CANNOT_PIPE", "Cannot pipe, not readable");
      createErrorType("ERR_STREAM_WRITE_AFTER_END", "write after end");
      createErrorType("ERR_STREAM_NULL_VALUES", "May not write null values to stream", TypeError);
      createErrorType("ERR_UNKNOWN_ENCODING", function(arg) {
        return "Unknown encoding: " + arg;
      }, TypeError);
      createErrorType("ERR_STREAM_UNSHIFT_AFTER_END_EVENT", "stream.unshift() after end event");
      module.exports.codes = codes;
    }
  });

  // node_modules/readable-stream/lib/internal/streams/state.js
  var require_state = __commonJS({
    "node_modules/readable-stream/lib/internal/streams/state.js"(exports, module) {
      "use strict";
      var ERR_INVALID_OPT_VALUE = require_errors_browser().codes.ERR_INVALID_OPT_VALUE;
      function highWaterMarkFrom(options, isDuplex, duplexKey) {
        return options.highWaterMark != null ? options.highWaterMark : isDuplex ? options[duplexKey] : null;
      }
      function getHighWaterMark(state, options, duplexKey, isDuplex) {
        var hwm = highWaterMarkFrom(options, isDuplex, duplexKey);
        if (hwm != null) {
          if (!(isFinite(hwm) && Math.floor(hwm) === hwm) || hwm < 0) {
            var name = isDuplex ? duplexKey : "highWaterMark";
            throw new ERR_INVALID_OPT_VALUE(name, hwm);
          }
          return Math.floor(hwm);
        }
        return state.objectMode ? 16 : 16 * 1024;
      }
      module.exports = {
        getHighWaterMark
      };
    }
  });

  // node_modules/util-deprecate/browser.js
  var require_browser = __commonJS({
    "node_modules/util-deprecate/browser.js"(exports, module) {
      module.exports = deprecate;
      function deprecate(fn, msg) {
        if (config("noDeprecation")) {
          return fn;
        }
        var warned = false;
        function deprecated() {
          if (!warned) {
            if (config("throwDeprecation")) {
              throw new Error(msg);
            } else if (config("traceDeprecation")) {
              console.trace(msg);
            } else {
              console.warn(msg);
            }
            warned = true;
          }
          return fn.apply(this, arguments);
        }
        return deprecated;
      }
      function config(name) {
        try {
          if (!global.localStorage) return false;
        } catch (_) {
          return false;
        }
        var val = global.localStorage[name];
        if (null == val) return false;
        return String(val).toLowerCase() === "true";
      }
    }
  });

  // node_modules/readable-stream/lib/_stream_writable.js
  var require_stream_writable = __commonJS({
    "node_modules/readable-stream/lib/_stream_writable.js"(exports, module) {
      "use strict";
      module.exports = Writable;
      function CorkedRequest(state) {
        var _this = this;
        this.next = null;
        this.entry = null;
        this.finish = function() {
          onCorkedFinish(_this, state);
        };
      }
      var Duplex;
      Writable.WritableState = WritableState;
      var internalUtil = {
        deprecate: require_browser()
      };
      var Stream = require_stream_browser();
      var Buffer3 = require_buffer().Buffer;
      var OurUint8Array = (typeof global !== "undefined" ? global : typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : {}).Uint8Array || function() {
      };
      function _uint8ArrayToBuffer(chunk) {
        return Buffer3.from(chunk);
      }
      function _isUint8Array(obj) {
        return Buffer3.isBuffer(obj) || obj instanceof OurUint8Array;
      }
      var destroyImpl = require_destroy();
      var _require = require_state();
      var getHighWaterMark = _require.getHighWaterMark;
      var _require$codes = require_errors_browser().codes;
      var ERR_INVALID_ARG_TYPE = _require$codes.ERR_INVALID_ARG_TYPE;
      var ERR_METHOD_NOT_IMPLEMENTED = _require$codes.ERR_METHOD_NOT_IMPLEMENTED;
      var ERR_MULTIPLE_CALLBACK = _require$codes.ERR_MULTIPLE_CALLBACK;
      var ERR_STREAM_CANNOT_PIPE = _require$codes.ERR_STREAM_CANNOT_PIPE;
      var ERR_STREAM_DESTROYED = _require$codes.ERR_STREAM_DESTROYED;
      var ERR_STREAM_NULL_VALUES = _require$codes.ERR_STREAM_NULL_VALUES;
      var ERR_STREAM_WRITE_AFTER_END = _require$codes.ERR_STREAM_WRITE_AFTER_END;
      var ERR_UNKNOWN_ENCODING = _require$codes.ERR_UNKNOWN_ENCODING;
      var errorOrDestroy = destroyImpl.errorOrDestroy;
      require_inherits_browser()(Writable, Stream);
      function nop() {
      }
      function WritableState(options, stream, isDuplex) {
        Duplex = Duplex || require_stream_duplex();
        options = options || {};
        if (typeof isDuplex !== "boolean") isDuplex = stream instanceof Duplex;
        this.objectMode = !!options.objectMode;
        if (isDuplex) this.objectMode = this.objectMode || !!options.writableObjectMode;
        this.highWaterMark = getHighWaterMark(this, options, "writableHighWaterMark", isDuplex);
        this.finalCalled = false;
        this.needDrain = false;
        this.ending = false;
        this.ended = false;
        this.finished = false;
        this.destroyed = false;
        var noDecode = options.decodeStrings === false;
        this.decodeStrings = !noDecode;
        this.defaultEncoding = options.defaultEncoding || "utf8";
        this.length = 0;
        this.writing = false;
        this.corked = 0;
        this.sync = true;
        this.bufferProcessing = false;
        this.onwrite = function(er) {
          onwrite(stream, er);
        };
        this.writecb = null;
        this.writelen = 0;
        this.bufferedRequest = null;
        this.lastBufferedRequest = null;
        this.pendingcb = 0;
        this.prefinished = false;
        this.errorEmitted = false;
        this.emitClose = options.emitClose !== false;
        this.autoDestroy = !!options.autoDestroy;
        this.bufferedRequestCount = 0;
        this.corkedRequestsFree = new CorkedRequest(this);
      }
      WritableState.prototype.getBuffer = function getBuffer() {
        var current = this.bufferedRequest;
        var out = [];
        while (current) {
          out.push(current);
          current = current.next;
        }
        return out;
      };
      (function() {
        try {
          Object.defineProperty(WritableState.prototype, "buffer", {
            get: internalUtil.deprecate(function writableStateBufferGetter() {
              return this.getBuffer();
            }, "_writableState.buffer is deprecated. Use _writableState.getBuffer instead.", "DEP0003")
          });
        } catch (_) {
        }
      })();
      var realHasInstance;
      if (typeof Symbol === "function" && Symbol.hasInstance && typeof Function.prototype[Symbol.hasInstance] === "function") {
        realHasInstance = Function.prototype[Symbol.hasInstance];
        Object.defineProperty(Writable, Symbol.hasInstance, {
          value: function value(object) {
            if (realHasInstance.call(this, object)) return true;
            if (this !== Writable) return false;
            return object && object._writableState instanceof WritableState;
          }
        });
      } else {
        realHasInstance = function realHasInstance2(object) {
          return object instanceof this;
        };
      }
      function Writable(options) {
        Duplex = Duplex || require_stream_duplex();
        var isDuplex = this instanceof Duplex;
        if (!isDuplex && !realHasInstance.call(Writable, this)) return new Writable(options);
        this._writableState = new WritableState(options, this, isDuplex);
        this.writable = true;
        if (options) {
          if (typeof options.write === "function") this._write = options.write;
          if (typeof options.writev === "function") this._writev = options.writev;
          if (typeof options.destroy === "function") this._destroy = options.destroy;
          if (typeof options.final === "function") this._final = options.final;
        }
        Stream.call(this);
      }
      Writable.prototype.pipe = function() {
        errorOrDestroy(this, new ERR_STREAM_CANNOT_PIPE());
      };
      function writeAfterEnd(stream, cb) {
        var er = new ERR_STREAM_WRITE_AFTER_END();
        errorOrDestroy(stream, er);
        process.nextTick(cb, er);
      }
      function validChunk(stream, state, chunk, cb) {
        var er;
        if (chunk === null) {
          er = new ERR_STREAM_NULL_VALUES();
        } else if (typeof chunk !== "string" && !state.objectMode) {
          er = new ERR_INVALID_ARG_TYPE("chunk", ["string", "Buffer"], chunk);
        }
        if (er) {
          errorOrDestroy(stream, er);
          process.nextTick(cb, er);
          return false;
        }
        return true;
      }
      Writable.prototype.write = function(chunk, encoding, cb) {
        var state = this._writableState;
        var ret = false;
        var isBuf = !state.objectMode && _isUint8Array(chunk);
        if (isBuf && !Buffer3.isBuffer(chunk)) {
          chunk = _uint8ArrayToBuffer(chunk);
        }
        if (typeof encoding === "function") {
          cb = encoding;
          encoding = null;
        }
        if (isBuf) encoding = "buffer";
        else if (!encoding) encoding = state.defaultEncoding;
        if (typeof cb !== "function") cb = nop;
        if (state.ending) writeAfterEnd(this, cb);
        else if (isBuf || validChunk(this, state, chunk, cb)) {
          state.pendingcb++;
          ret = writeOrBuffer(this, state, isBuf, chunk, encoding, cb);
        }
        return ret;
      };
      Writable.prototype.cork = function() {
        this._writableState.corked++;
      };
      Writable.prototype.uncork = function() {
        var state = this._writableState;
        if (state.corked) {
          state.corked--;
          if (!state.writing && !state.corked && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
        }
      };
      Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
        if (typeof encoding === "string") encoding = encoding.toLowerCase();
        if (!(["hex", "utf8", "utf-8", "ascii", "binary", "base64", "ucs2", "ucs-2", "utf16le", "utf-16le", "raw"].indexOf((encoding + "").toLowerCase()) > -1)) throw new ERR_UNKNOWN_ENCODING(encoding);
        this._writableState.defaultEncoding = encoding;
        return this;
      };
      Object.defineProperty(Writable.prototype, "writableBuffer", {
        // making it explicit this property is not enumerable
        // because otherwise some prototype manipulation in
        // userland will fail
        enumerable: false,
        get: function get() {
          return this._writableState && this._writableState.getBuffer();
        }
      });
      function decodeChunk(state, chunk, encoding) {
        if (!state.objectMode && state.decodeStrings !== false && typeof chunk === "string") {
          chunk = Buffer3.from(chunk, encoding);
        }
        return chunk;
      }
      Object.defineProperty(Writable.prototype, "writableHighWaterMark", {
        // making it explicit this property is not enumerable
        // because otherwise some prototype manipulation in
        // userland will fail
        enumerable: false,
        get: function get() {
          return this._writableState.highWaterMark;
        }
      });
      function writeOrBuffer(stream, state, isBuf, chunk, encoding, cb) {
        if (!isBuf) {
          var newChunk = decodeChunk(state, chunk, encoding);
          if (chunk !== newChunk) {
            isBuf = true;
            encoding = "buffer";
            chunk = newChunk;
          }
        }
        var len = state.objectMode ? 1 : chunk.length;
        state.length += len;
        var ret = state.length < state.highWaterMark;
        if (!ret) state.needDrain = true;
        if (state.writing || state.corked) {
          var last = state.lastBufferedRequest;
          state.lastBufferedRequest = {
            chunk,
            encoding,
            isBuf,
            callback: cb,
            next: null
          };
          if (last) {
            last.next = state.lastBufferedRequest;
          } else {
            state.bufferedRequest = state.lastBufferedRequest;
          }
          state.bufferedRequestCount += 1;
        } else {
          doWrite(stream, state, false, len, chunk, encoding, cb);
        }
        return ret;
      }
      function doWrite(stream, state, writev, len, chunk, encoding, cb) {
        state.writelen = len;
        state.writecb = cb;
        state.writing = true;
        state.sync = true;
        if (state.destroyed) state.onwrite(new ERR_STREAM_DESTROYED("write"));
        else if (writev) stream._writev(chunk, state.onwrite);
        else stream._write(chunk, encoding, state.onwrite);
        state.sync = false;
      }
      function onwriteError(stream, state, sync, er, cb) {
        --state.pendingcb;
        if (sync) {
          process.nextTick(cb, er);
          process.nextTick(finishMaybe, stream, state);
          stream._writableState.errorEmitted = true;
          errorOrDestroy(stream, er);
        } else {
          cb(er);
          stream._writableState.errorEmitted = true;
          errorOrDestroy(stream, er);
          finishMaybe(stream, state);
        }
      }
      function onwriteStateUpdate(state) {
        state.writing = false;
        state.writecb = null;
        state.length -= state.writelen;
        state.writelen = 0;
      }
      function onwrite(stream, er) {
        var state = stream._writableState;
        var sync = state.sync;
        var cb = state.writecb;
        if (typeof cb !== "function") throw new ERR_MULTIPLE_CALLBACK();
        onwriteStateUpdate(state);
        if (er) onwriteError(stream, state, sync, er, cb);
        else {
          var finished = needFinish(state) || stream.destroyed;
          if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
            clearBuffer(stream, state);
          }
          if (sync) {
            process.nextTick(afterWrite, stream, state, finished, cb);
          } else {
            afterWrite(stream, state, finished, cb);
          }
        }
      }
      function afterWrite(stream, state, finished, cb) {
        if (!finished) onwriteDrain(stream, state);
        state.pendingcb--;
        cb();
        finishMaybe(stream, state);
      }
      function onwriteDrain(stream, state) {
        if (state.length === 0 && state.needDrain) {
          state.needDrain = false;
          stream.emit("drain");
        }
      }
      function clearBuffer(stream, state) {
        state.bufferProcessing = true;
        var entry = state.bufferedRequest;
        if (stream._writev && entry && entry.next) {
          var l = state.bufferedRequestCount;
          var buffer = new Array(l);
          var holder = state.corkedRequestsFree;
          holder.entry = entry;
          var count = 0;
          var allBuffers = true;
          while (entry) {
            buffer[count] = entry;
            if (!entry.isBuf) allBuffers = false;
            entry = entry.next;
            count += 1;
          }
          buffer.allBuffers = allBuffers;
          doWrite(stream, state, true, state.length, buffer, "", holder.finish);
          state.pendingcb++;
          state.lastBufferedRequest = null;
          if (holder.next) {
            state.corkedRequestsFree = holder.next;
            holder.next = null;
          } else {
            state.corkedRequestsFree = new CorkedRequest(state);
          }
          state.bufferedRequestCount = 0;
        } else {
          while (entry) {
            var chunk = entry.chunk;
            var encoding = entry.encoding;
            var cb = entry.callback;
            var len = state.objectMode ? 1 : chunk.length;
            doWrite(stream, state, false, len, chunk, encoding, cb);
            entry = entry.next;
            state.bufferedRequestCount--;
            if (state.writing) {
              break;
            }
          }
          if (entry === null) state.lastBufferedRequest = null;
        }
        state.bufferedRequest = entry;
        state.bufferProcessing = false;
      }
      Writable.prototype._write = function(chunk, encoding, cb) {
        cb(new ERR_METHOD_NOT_IMPLEMENTED("_write()"));
      };
      Writable.prototype._writev = null;
      Writable.prototype.end = function(chunk, encoding, cb) {
        var state = this._writableState;
        if (typeof chunk === "function") {
          cb = chunk;
          chunk = null;
          encoding = null;
        } else if (typeof encoding === "function") {
          cb = encoding;
          encoding = null;
        }
        if (chunk !== null && chunk !== void 0) this.write(chunk, encoding);
        if (state.corked) {
          state.corked = 1;
          this.uncork();
        }
        if (!state.ending) endWritable(this, state, cb);
        return this;
      };
      Object.defineProperty(Writable.prototype, "writableLength", {
        // making it explicit this property is not enumerable
        // because otherwise some prototype manipulation in
        // userland will fail
        enumerable: false,
        get: function get() {
          return this._writableState.length;
        }
      });
      function needFinish(state) {
        return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
      }
      function callFinal(stream, state) {
        stream._final(function(err) {
          state.pendingcb--;
          if (err) {
            errorOrDestroy(stream, err);
          }
          state.prefinished = true;
          stream.emit("prefinish");
          finishMaybe(stream, state);
        });
      }
      function prefinish(stream, state) {
        if (!state.prefinished && !state.finalCalled) {
          if (typeof stream._final === "function" && !state.destroyed) {
            state.pendingcb++;
            state.finalCalled = true;
            process.nextTick(callFinal, stream, state);
          } else {
            state.prefinished = true;
            stream.emit("prefinish");
          }
        }
      }
      function finishMaybe(stream, state) {
        var need = needFinish(state);
        if (need) {
          prefinish(stream, state);
          if (state.pendingcb === 0) {
            state.finished = true;
            stream.emit("finish");
            if (state.autoDestroy) {
              var rState = stream._readableState;
              if (!rState || rState.autoDestroy && rState.endEmitted) {
                stream.destroy();
              }
            }
          }
        }
        return need;
      }
      function endWritable(stream, state, cb) {
        state.ending = true;
        finishMaybe(stream, state);
        if (cb) {
          if (state.finished) process.nextTick(cb);
          else stream.once("finish", cb);
        }
        state.ended = true;
        stream.writable = false;
      }
      function onCorkedFinish(corkReq, state, err) {
        var entry = corkReq.entry;
        corkReq.entry = null;
        while (entry) {
          var cb = entry.callback;
          state.pendingcb--;
          cb(err);
          entry = entry.next;
        }
        state.corkedRequestsFree.next = corkReq;
      }
      Object.defineProperty(Writable.prototype, "destroyed", {
        // making it explicit this property is not enumerable
        // because otherwise some prototype manipulation in
        // userland will fail
        enumerable: false,
        get: function get() {
          if (this._writableState === void 0) {
            return false;
          }
          return this._writableState.destroyed;
        },
        set: function set(value) {
          if (!this._writableState) {
            return;
          }
          this._writableState.destroyed = value;
        }
      });
      Writable.prototype.destroy = destroyImpl.destroy;
      Writable.prototype._undestroy = destroyImpl.undestroy;
      Writable.prototype._destroy = function(err, cb) {
        cb(err);
      };
    }
  });

  // node_modules/readable-stream/lib/_stream_duplex.js
  var require_stream_duplex = __commonJS({
    "node_modules/readable-stream/lib/_stream_duplex.js"(exports, module) {
      "use strict";
      var objectKeys = Object.keys || function(obj) {
        var keys2 = [];
        for (var key in obj) keys2.push(key);
        return keys2;
      };
      module.exports = Duplex;
      var Readable = require_stream_readable();
      var Writable = require_stream_writable();
      require_inherits_browser()(Duplex, Readable);
      {
        keys = objectKeys(Writable.prototype);
        for (v = 0; v < keys.length; v++) {
          method = keys[v];
          if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
        }
      }
      var keys;
      var method;
      var v;
      function Duplex(options) {
        if (!(this instanceof Duplex)) return new Duplex(options);
        Readable.call(this, options);
        Writable.call(this, options);
        this.allowHalfOpen = true;
        if (options) {
          if (options.readable === false) this.readable = false;
          if (options.writable === false) this.writable = false;
          if (options.allowHalfOpen === false) {
            this.allowHalfOpen = false;
            this.once("end", onend);
          }
        }
      }
      Object.defineProperty(Duplex.prototype, "writableHighWaterMark", {
        // making it explicit this property is not enumerable
        // because otherwise some prototype manipulation in
        // userland will fail
        enumerable: false,
        get: function get() {
          return this._writableState.highWaterMark;
        }
      });
      Object.defineProperty(Duplex.prototype, "writableBuffer", {
        // making it explicit this property is not enumerable
        // because otherwise some prototype manipulation in
        // userland will fail
        enumerable: false,
        get: function get() {
          return this._writableState && this._writableState.getBuffer();
        }
      });
      Object.defineProperty(Duplex.prototype, "writableLength", {
        // making it explicit this property is not enumerable
        // because otherwise some prototype manipulation in
        // userland will fail
        enumerable: false,
        get: function get() {
          return this._writableState.length;
        }
      });
      function onend() {
        if (this._writableState.ended) return;
        process.nextTick(onEndNT, this);
      }
      function onEndNT(self2) {
        self2.end();
      }
      Object.defineProperty(Duplex.prototype, "destroyed", {
        // making it explicit this property is not enumerable
        // because otherwise some prototype manipulation in
        // userland will fail
        enumerable: false,
        get: function get() {
          if (this._readableState === void 0 || this._writableState === void 0) {
            return false;
          }
          return this._readableState.destroyed && this._writableState.destroyed;
        },
        set: function set(value) {
          if (this._readableState === void 0 || this._writableState === void 0) {
            return;
          }
          this._readableState.destroyed = value;
          this._writableState.destroyed = value;
        }
      });
    }
  });

  // node_modules/safe-buffer/index.js
  var require_safe_buffer = __commonJS({
    "node_modules/safe-buffer/index.js"(exports, module) {
      var buffer = require_buffer();
      var Buffer3 = buffer.Buffer;
      function copyProps(src, dst) {
        for (var key in src) {
          dst[key] = src[key];
        }
      }
      if (Buffer3.from && Buffer3.alloc && Buffer3.allocUnsafe && Buffer3.allocUnsafeSlow) {
        module.exports = buffer;
      } else {
        copyProps(buffer, exports);
        exports.Buffer = SafeBuffer;
      }
      function SafeBuffer(arg, encodingOrOffset, length) {
        return Buffer3(arg, encodingOrOffset, length);
      }
      SafeBuffer.prototype = Object.create(Buffer3.prototype);
      copyProps(Buffer3, SafeBuffer);
      SafeBuffer.from = function(arg, encodingOrOffset, length) {
        if (typeof arg === "number") {
          throw new TypeError("Argument must not be a number");
        }
        return Buffer3(arg, encodingOrOffset, length);
      };
      SafeBuffer.alloc = function(size, fill, encoding) {
        if (typeof size !== "number") {
          throw new TypeError("Argument must be a number");
        }
        var buf = Buffer3(size);
        if (fill !== void 0) {
          if (typeof encoding === "string") {
            buf.fill(fill, encoding);
          } else {
            buf.fill(fill);
          }
        } else {
          buf.fill(0);
        }
        return buf;
      };
      SafeBuffer.allocUnsafe = function(size) {
        if (typeof size !== "number") {
          throw new TypeError("Argument must be a number");
        }
        return Buffer3(size);
      };
      SafeBuffer.allocUnsafeSlow = function(size) {
        if (typeof size !== "number") {
          throw new TypeError("Argument must be a number");
        }
        return buffer.SlowBuffer(size);
      };
    }
  });

  // node_modules/string_decoder/lib/string_decoder.js
  var require_string_decoder = __commonJS({
    "node_modules/string_decoder/lib/string_decoder.js"(exports) {
      "use strict";
      var Buffer3 = require_safe_buffer().Buffer;
      var isEncoding = Buffer3.isEncoding || function(encoding) {
        encoding = "" + encoding;
        switch (encoding && encoding.toLowerCase()) {
          case "hex":
          case "utf8":
          case "utf-8":
          case "ascii":
          case "binary":
          case "base64":
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
          case "raw":
            return true;
          default:
            return false;
        }
      };
      function _normalizeEncoding(enc) {
        if (!enc) return "utf8";
        var retried;
        while (true) {
          switch (enc) {
            case "utf8":
            case "utf-8":
              return "utf8";
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return "utf16le";
            case "latin1":
            case "binary":
              return "latin1";
            case "base64":
            case "ascii":
            case "hex":
              return enc;
            default:
              if (retried) return;
              enc = ("" + enc).toLowerCase();
              retried = true;
          }
        }
      }
      function normalizeEncoding(enc) {
        var nenc = _normalizeEncoding(enc);
        if (typeof nenc !== "string" && (Buffer3.isEncoding === isEncoding || !isEncoding(enc))) throw new Error("Unknown encoding: " + enc);
        return nenc || enc;
      }
      exports.StringDecoder = StringDecoder;
      function StringDecoder(encoding) {
        this.encoding = normalizeEncoding(encoding);
        var nb;
        switch (this.encoding) {
          case "utf16le":
            this.text = utf16Text;
            this.end = utf16End;
            nb = 4;
            break;
          case "utf8":
            this.fillLast = utf8FillLast;
            nb = 4;
            break;
          case "base64":
            this.text = base64Text;
            this.end = base64End;
            nb = 3;
            break;
          default:
            this.write = simpleWrite;
            this.end = simpleEnd;
            return;
        }
        this.lastNeed = 0;
        this.lastTotal = 0;
        this.lastChar = Buffer3.allocUnsafe(nb);
      }
      StringDecoder.prototype.write = function(buf) {
        if (buf.length === 0) return "";
        var r;
        var i;
        if (this.lastNeed) {
          r = this.fillLast(buf);
          if (r === void 0) return "";
          i = this.lastNeed;
          this.lastNeed = 0;
        } else {
          i = 0;
        }
        if (i < buf.length) return r ? r + this.text(buf, i) : this.text(buf, i);
        return r || "";
      };
      StringDecoder.prototype.end = utf8End;
      StringDecoder.prototype.text = utf8Text;
      StringDecoder.prototype.fillLast = function(buf) {
        if (this.lastNeed <= buf.length) {
          buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed);
          return this.lastChar.toString(this.encoding, 0, this.lastTotal);
        }
        buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length);
        this.lastNeed -= buf.length;
      };
      function utf8CheckByte(byte) {
        if (byte <= 127) return 0;
        else if (byte >> 5 === 6) return 2;
        else if (byte >> 4 === 14) return 3;
        else if (byte >> 3 === 30) return 4;
        return byte >> 6 === 2 ? -1 : -2;
      }
      function utf8CheckIncomplete(self2, buf, i) {
        var j = buf.length - 1;
        if (j < i) return 0;
        var nb = utf8CheckByte(buf[j]);
        if (nb >= 0) {
          if (nb > 0) self2.lastNeed = nb - 1;
          return nb;
        }
        if (--j < i || nb === -2) return 0;
        nb = utf8CheckByte(buf[j]);
        if (nb >= 0) {
          if (nb > 0) self2.lastNeed = nb - 2;
          return nb;
        }
        if (--j < i || nb === -2) return 0;
        nb = utf8CheckByte(buf[j]);
        if (nb >= 0) {
          if (nb > 0) {
            if (nb === 2) nb = 0;
            else self2.lastNeed = nb - 3;
          }
          return nb;
        }
        return 0;
      }
      function utf8CheckExtraBytes(self2, buf, p) {
        if ((buf[0] & 192) !== 128) {
          self2.lastNeed = 0;
          return "\uFFFD";
        }
        if (self2.lastNeed > 1 && buf.length > 1) {
          if ((buf[1] & 192) !== 128) {
            self2.lastNeed = 1;
            return "\uFFFD";
          }
          if (self2.lastNeed > 2 && buf.length > 2) {
            if ((buf[2] & 192) !== 128) {
              self2.lastNeed = 2;
              return "\uFFFD";
            }
          }
        }
      }
      function utf8FillLast(buf) {
        var p = this.lastTotal - this.lastNeed;
        var r = utf8CheckExtraBytes(this, buf, p);
        if (r !== void 0) return r;
        if (this.lastNeed <= buf.length) {
          buf.copy(this.lastChar, p, 0, this.lastNeed);
          return this.lastChar.toString(this.encoding, 0, this.lastTotal);
        }
        buf.copy(this.lastChar, p, 0, buf.length);
        this.lastNeed -= buf.length;
      }
      function utf8Text(buf, i) {
        var total = utf8CheckIncomplete(this, buf, i);
        if (!this.lastNeed) return buf.toString("utf8", i);
        this.lastTotal = total;
        var end = buf.length - (total - this.lastNeed);
        buf.copy(this.lastChar, 0, end);
        return buf.toString("utf8", i, end);
      }
      function utf8End(buf) {
        var r = buf && buf.length ? this.write(buf) : "";
        if (this.lastNeed) return r + "\uFFFD";
        return r;
      }
      function utf16Text(buf, i) {
        if ((buf.length - i) % 2 === 0) {
          var r = buf.toString("utf16le", i);
          if (r) {
            var c = r.charCodeAt(r.length - 1);
            if (c >= 55296 && c <= 56319) {
              this.lastNeed = 2;
              this.lastTotal = 4;
              this.lastChar[0] = buf[buf.length - 2];
              this.lastChar[1] = buf[buf.length - 1];
              return r.slice(0, -1);
            }
          }
          return r;
        }
        this.lastNeed = 1;
        this.lastTotal = 2;
        this.lastChar[0] = buf[buf.length - 1];
        return buf.toString("utf16le", i, buf.length - 1);
      }
      function utf16End(buf) {
        var r = buf && buf.length ? this.write(buf) : "";
        if (this.lastNeed) {
          var end = this.lastTotal - this.lastNeed;
          return r + this.lastChar.toString("utf16le", 0, end);
        }
        return r;
      }
      function base64Text(buf, i) {
        var n = (buf.length - i) % 3;
        if (n === 0) return buf.toString("base64", i);
        this.lastNeed = 3 - n;
        this.lastTotal = 3;
        if (n === 1) {
          this.lastChar[0] = buf[buf.length - 1];
        } else {
          this.lastChar[0] = buf[buf.length - 2];
          this.lastChar[1] = buf[buf.length - 1];
        }
        return buf.toString("base64", i, buf.length - n);
      }
      function base64End(buf) {
        var r = buf && buf.length ? this.write(buf) : "";
        if (this.lastNeed) return r + this.lastChar.toString("base64", 0, 3 - this.lastNeed);
        return r;
      }
      function simpleWrite(buf) {
        return buf.toString(this.encoding);
      }
      function simpleEnd(buf) {
        return buf && buf.length ? this.write(buf) : "";
      }
    }
  });

  // node_modules/readable-stream/lib/internal/streams/end-of-stream.js
  var require_end_of_stream = __commonJS({
    "node_modules/readable-stream/lib/internal/streams/end-of-stream.js"(exports, module) {
      "use strict";
      var ERR_STREAM_PREMATURE_CLOSE = require_errors_browser().codes.ERR_STREAM_PREMATURE_CLOSE;
      function once2(callback) {
        var called = false;
        return function() {
          if (called) return;
          called = true;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          callback.apply(this, args);
        };
      }
      function noop2() {
      }
      function isRequest(stream) {
        return stream.setHeader && typeof stream.abort === "function";
      }
      function eos(stream, opts, callback) {
        if (typeof opts === "function") return eos(stream, null, opts);
        if (!opts) opts = {};
        callback = once2(callback || noop2);
        var readable = opts.readable || opts.readable !== false && stream.readable;
        var writable2 = opts.writable || opts.writable !== false && stream.writable;
        var onlegacyfinish = function onlegacyfinish2() {
          if (!stream.writable) onfinish();
        };
        var writableEnded = stream._writableState && stream._writableState.finished;
        var onfinish = function onfinish2() {
          writable2 = false;
          writableEnded = true;
          if (!readable) callback.call(stream);
        };
        var readableEnded = stream._readableState && stream._readableState.endEmitted;
        var onend = function onend2() {
          readable = false;
          readableEnded = true;
          if (!writable2) callback.call(stream);
        };
        var onerror = function onerror2(err) {
          callback.call(stream, err);
        };
        var onclose = function onclose2() {
          var err;
          if (readable && !readableEnded) {
            if (!stream._readableState || !stream._readableState.ended) err = new ERR_STREAM_PREMATURE_CLOSE();
            return callback.call(stream, err);
          }
          if (writable2 && !writableEnded) {
            if (!stream._writableState || !stream._writableState.ended) err = new ERR_STREAM_PREMATURE_CLOSE();
            return callback.call(stream, err);
          }
        };
        var onrequest = function onrequest2() {
          stream.req.on("finish", onfinish);
        };
        if (isRequest(stream)) {
          stream.on("complete", onfinish);
          stream.on("abort", onclose);
          if (stream.req) onrequest();
          else stream.on("request", onrequest);
        } else if (writable2 && !stream._writableState) {
          stream.on("end", onlegacyfinish);
          stream.on("close", onlegacyfinish);
        }
        stream.on("end", onend);
        stream.on("finish", onfinish);
        if (opts.error !== false) stream.on("error", onerror);
        stream.on("close", onclose);
        return function() {
          stream.removeListener("complete", onfinish);
          stream.removeListener("abort", onclose);
          stream.removeListener("request", onrequest);
          if (stream.req) stream.req.removeListener("finish", onfinish);
          stream.removeListener("end", onlegacyfinish);
          stream.removeListener("close", onlegacyfinish);
          stream.removeListener("finish", onfinish);
          stream.removeListener("end", onend);
          stream.removeListener("error", onerror);
          stream.removeListener("close", onclose);
        };
      }
      module.exports = eos;
    }
  });

  // node_modules/readable-stream/lib/internal/streams/async_iterator.js
  var require_async_iterator = __commonJS({
    "node_modules/readable-stream/lib/internal/streams/async_iterator.js"(exports, module) {
      "use strict";
      var _Object$setPrototypeO;
      function _defineProperty(obj, key, value) {
        key = _toPropertyKey(key);
        if (key in obj) {
          Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: true });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      function _toPropertyKey(arg) {
        var key = _toPrimitive(arg, "string");
        return typeof key === "symbol" ? key : String(key);
      }
      function _toPrimitive(input, hint) {
        if (typeof input !== "object" || input === null) return input;
        var prim = input[Symbol.toPrimitive];
        if (prim !== void 0) {
          var res = prim.call(input, hint || "default");
          if (typeof res !== "object") return res;
          throw new TypeError("@@toPrimitive must return a primitive value.");
        }
        return (hint === "string" ? String : Number)(input);
      }
      var finished = require_end_of_stream();
      var kLastResolve = Symbol("lastResolve");
      var kLastReject = Symbol("lastReject");
      var kError = Symbol("error");
      var kEnded = Symbol("ended");
      var kLastPromise = Symbol("lastPromise");
      var kHandlePromise = Symbol("handlePromise");
      var kStream = Symbol("stream");
      function createIterResult(value, done) {
        return {
          value,
          done
        };
      }
      function readAndResolve(iter) {
        var resolve2 = iter[kLastResolve];
        if (resolve2 !== null) {
          var data = iter[kStream].read();
          if (data !== null) {
            iter[kLastPromise] = null;
            iter[kLastResolve] = null;
            iter[kLastReject] = null;
            resolve2(createIterResult(data, false));
          }
        }
      }
      function onReadable(iter) {
        process.nextTick(readAndResolve, iter);
      }
      function wrapForNext(lastPromise, iter) {
        return function(resolve2, reject) {
          lastPromise.then(function() {
            if (iter[kEnded]) {
              resolve2(createIterResult(void 0, true));
              return;
            }
            iter[kHandlePromise](resolve2, reject);
          }, reject);
        };
      }
      var AsyncIteratorPrototype = Object.getPrototypeOf(function() {
      });
      var ReadableStreamAsyncIteratorPrototype = Object.setPrototypeOf((_Object$setPrototypeO = {
        get stream() {
          return this[kStream];
        },
        next: function next() {
          var _this = this;
          var error = this[kError];
          if (error !== null) {
            return Promise.reject(error);
          }
          if (this[kEnded]) {
            return Promise.resolve(createIterResult(void 0, true));
          }
          if (this[kStream].destroyed) {
            return new Promise(function(resolve2, reject) {
              process.nextTick(function() {
                if (_this[kError]) {
                  reject(_this[kError]);
                } else {
                  resolve2(createIterResult(void 0, true));
                }
              });
            });
          }
          var lastPromise = this[kLastPromise];
          var promise;
          if (lastPromise) {
            promise = new Promise(wrapForNext(lastPromise, this));
          } else {
            var data = this[kStream].read();
            if (data !== null) {
              return Promise.resolve(createIterResult(data, false));
            }
            promise = new Promise(this[kHandlePromise]);
          }
          this[kLastPromise] = promise;
          return promise;
        }
      }, _defineProperty(_Object$setPrototypeO, Symbol.asyncIterator, function() {
        return this;
      }), _defineProperty(_Object$setPrototypeO, "return", function _return() {
        var _this2 = this;
        return new Promise(function(resolve2, reject) {
          _this2[kStream].destroy(null, function(err) {
            if (err) {
              reject(err);
              return;
            }
            resolve2(createIterResult(void 0, true));
          });
        });
      }), _Object$setPrototypeO), AsyncIteratorPrototype);
      var createReadableStreamAsyncIterator = function createReadableStreamAsyncIterator2(stream) {
        var _Object$create;
        var iterator = Object.create(ReadableStreamAsyncIteratorPrototype, (_Object$create = {}, _defineProperty(_Object$create, kStream, {
          value: stream,
          writable: true
        }), _defineProperty(_Object$create, kLastResolve, {
          value: null,
          writable: true
        }), _defineProperty(_Object$create, kLastReject, {
          value: null,
          writable: true
        }), _defineProperty(_Object$create, kError, {
          value: null,
          writable: true
        }), _defineProperty(_Object$create, kEnded, {
          value: stream._readableState.endEmitted,
          writable: true
        }), _defineProperty(_Object$create, kHandlePromise, {
          value: function value(resolve2, reject) {
            var data = iterator[kStream].read();
            if (data) {
              iterator[kLastPromise] = null;
              iterator[kLastResolve] = null;
              iterator[kLastReject] = null;
              resolve2(createIterResult(data, false));
            } else {
              iterator[kLastResolve] = resolve2;
              iterator[kLastReject] = reject;
            }
          },
          writable: true
        }), _Object$create));
        iterator[kLastPromise] = null;
        finished(stream, function(err) {
          if (err && err.code !== "ERR_STREAM_PREMATURE_CLOSE") {
            var reject = iterator[kLastReject];
            if (reject !== null) {
              iterator[kLastPromise] = null;
              iterator[kLastResolve] = null;
              iterator[kLastReject] = null;
              reject(err);
            }
            iterator[kError] = err;
            return;
          }
          var resolve2 = iterator[kLastResolve];
          if (resolve2 !== null) {
            iterator[kLastPromise] = null;
            iterator[kLastResolve] = null;
            iterator[kLastReject] = null;
            resolve2(createIterResult(void 0, true));
          }
          iterator[kEnded] = true;
        });
        stream.on("readable", onReadable.bind(null, iterator));
        return iterator;
      };
      module.exports = createReadableStreamAsyncIterator;
    }
  });

  // node_modules/readable-stream/lib/internal/streams/from-browser.js
  var require_from_browser = __commonJS({
    "node_modules/readable-stream/lib/internal/streams/from-browser.js"(exports, module) {
      module.exports = function() {
        throw new Error("Readable.from is not available in the browser");
      };
    }
  });

  // node_modules/readable-stream/lib/_stream_readable.js
  var require_stream_readable = __commonJS({
    "node_modules/readable-stream/lib/_stream_readable.js"(exports, module) {
      "use strict";
      module.exports = Readable;
      var Duplex;
      Readable.ReadableState = ReadableState;
      var EE = require_events().EventEmitter;
      var EElistenerCount = function EElistenerCount2(emitter, type) {
        return emitter.listeners(type).length;
      };
      var Stream = require_stream_browser();
      var Buffer3 = require_buffer().Buffer;
      var OurUint8Array = (typeof global !== "undefined" ? global : typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : {}).Uint8Array || function() {
      };
      function _uint8ArrayToBuffer(chunk) {
        return Buffer3.from(chunk);
      }
      function _isUint8Array(obj) {
        return Buffer3.isBuffer(obj) || obj instanceof OurUint8Array;
      }
      var debugUtil = require_util4();
      var debug;
      if (debugUtil && debugUtil.debuglog) {
        debug = debugUtil.debuglog("stream");
      } else {
        debug = function debug2() {
        };
      }
      var BufferList = require_buffer_list();
      var destroyImpl = require_destroy();
      var _require = require_state();
      var getHighWaterMark = _require.getHighWaterMark;
      var _require$codes = require_errors_browser().codes;
      var ERR_INVALID_ARG_TYPE = _require$codes.ERR_INVALID_ARG_TYPE;
      var ERR_STREAM_PUSH_AFTER_EOF = _require$codes.ERR_STREAM_PUSH_AFTER_EOF;
      var ERR_METHOD_NOT_IMPLEMENTED = _require$codes.ERR_METHOD_NOT_IMPLEMENTED;
      var ERR_STREAM_UNSHIFT_AFTER_END_EVENT = _require$codes.ERR_STREAM_UNSHIFT_AFTER_END_EVENT;
      var StringDecoder;
      var createReadableStreamAsyncIterator;
      var from;
      require_inherits_browser()(Readable, Stream);
      var errorOrDestroy = destroyImpl.errorOrDestroy;
      var kProxyEvents = ["error", "close", "destroy", "pause", "resume"];
      function prependListener2(emitter, event, fn) {
        if (typeof emitter.prependListener === "function") return emitter.prependListener(event, fn);
        if (!emitter._events || !emitter._events[event]) emitter.on(event, fn);
        else if (Array.isArray(emitter._events[event])) emitter._events[event].unshift(fn);
        else emitter._events[event] = [fn, emitter._events[event]];
      }
      function ReadableState(options, stream, isDuplex) {
        Duplex = Duplex || require_stream_duplex();
        options = options || {};
        if (typeof isDuplex !== "boolean") isDuplex = stream instanceof Duplex;
        this.objectMode = !!options.objectMode;
        if (isDuplex) this.objectMode = this.objectMode || !!options.readableObjectMode;
        this.highWaterMark = getHighWaterMark(this, options, "readableHighWaterMark", isDuplex);
        this.buffer = new BufferList();
        this.length = 0;
        this.pipes = null;
        this.pipesCount = 0;
        this.flowing = null;
        this.ended = false;
        this.endEmitted = false;
        this.reading = false;
        this.sync = true;
        this.needReadable = false;
        this.emittedReadable = false;
        this.readableListening = false;
        this.resumeScheduled = false;
        this.paused = true;
        this.emitClose = options.emitClose !== false;
        this.autoDestroy = !!options.autoDestroy;
        this.destroyed = false;
        this.defaultEncoding = options.defaultEncoding || "utf8";
        this.awaitDrain = 0;
        this.readingMore = false;
        this.decoder = null;
        this.encoding = null;
        if (options.encoding) {
          if (!StringDecoder) StringDecoder = require_string_decoder().StringDecoder;
          this.decoder = new StringDecoder(options.encoding);
          this.encoding = options.encoding;
        }
      }
      function Readable(options) {
        Duplex = Duplex || require_stream_duplex();
        if (!(this instanceof Readable)) return new Readable(options);
        var isDuplex = this instanceof Duplex;
        this._readableState = new ReadableState(options, this, isDuplex);
        this.readable = true;
        if (options) {
          if (typeof options.read === "function") this._read = options.read;
          if (typeof options.destroy === "function") this._destroy = options.destroy;
        }
        Stream.call(this);
      }
      Object.defineProperty(Readable.prototype, "destroyed", {
        // making it explicit this property is not enumerable
        // because otherwise some prototype manipulation in
        // userland will fail
        enumerable: false,
        get: function get() {
          if (this._readableState === void 0) {
            return false;
          }
          return this._readableState.destroyed;
        },
        set: function set(value) {
          if (!this._readableState) {
            return;
          }
          this._readableState.destroyed = value;
        }
      });
      Readable.prototype.destroy = destroyImpl.destroy;
      Readable.prototype._undestroy = destroyImpl.undestroy;
      Readable.prototype._destroy = function(err, cb) {
        cb(err);
      };
      Readable.prototype.push = function(chunk, encoding) {
        var state = this._readableState;
        var skipChunkCheck;
        if (!state.objectMode) {
          if (typeof chunk === "string") {
            encoding = encoding || state.defaultEncoding;
            if (encoding !== state.encoding) {
              chunk = Buffer3.from(chunk, encoding);
              encoding = "";
            }
            skipChunkCheck = true;
          }
        } else {
          skipChunkCheck = true;
        }
        return readableAddChunk(this, chunk, encoding, false, skipChunkCheck);
      };
      Readable.prototype.unshift = function(chunk) {
        return readableAddChunk(this, chunk, null, true, false);
      };
      function readableAddChunk(stream, chunk, encoding, addToFront, skipChunkCheck) {
        debug("readableAddChunk", chunk);
        var state = stream._readableState;
        if (chunk === null) {
          state.reading = false;
          onEofChunk(stream, state);
        } else {
          var er;
          if (!skipChunkCheck) er = chunkInvalid(state, chunk);
          if (er) {
            errorOrDestroy(stream, er);
          } else if (state.objectMode || chunk && chunk.length > 0) {
            if (typeof chunk !== "string" && !state.objectMode && Object.getPrototypeOf(chunk) !== Buffer3.prototype) {
              chunk = _uint8ArrayToBuffer(chunk);
            }
            if (addToFront) {
              if (state.endEmitted) errorOrDestroy(stream, new ERR_STREAM_UNSHIFT_AFTER_END_EVENT());
              else addChunk(stream, state, chunk, true);
            } else if (state.ended) {
              errorOrDestroy(stream, new ERR_STREAM_PUSH_AFTER_EOF());
            } else if (state.destroyed) {
              return false;
            } else {
              state.reading = false;
              if (state.decoder && !encoding) {
                chunk = state.decoder.write(chunk);
                if (state.objectMode || chunk.length !== 0) addChunk(stream, state, chunk, false);
                else maybeReadMore(stream, state);
              } else {
                addChunk(stream, state, chunk, false);
              }
            }
          } else if (!addToFront) {
            state.reading = false;
            maybeReadMore(stream, state);
          }
        }
        return !state.ended && (state.length < state.highWaterMark || state.length === 0);
      }
      function addChunk(stream, state, chunk, addToFront) {
        if (state.flowing && state.length === 0 && !state.sync) {
          state.awaitDrain = 0;
          stream.emit("data", chunk);
        } else {
          state.length += state.objectMode ? 1 : chunk.length;
          if (addToFront) state.buffer.unshift(chunk);
          else state.buffer.push(chunk);
          if (state.needReadable) emitReadable(stream);
        }
        maybeReadMore(stream, state);
      }
      function chunkInvalid(state, chunk) {
        var er;
        if (!_isUint8Array(chunk) && typeof chunk !== "string" && chunk !== void 0 && !state.objectMode) {
          er = new ERR_INVALID_ARG_TYPE("chunk", ["string", "Buffer", "Uint8Array"], chunk);
        }
        return er;
      }
      Readable.prototype.isPaused = function() {
        return this._readableState.flowing === false;
      };
      Readable.prototype.setEncoding = function(enc) {
        if (!StringDecoder) StringDecoder = require_string_decoder().StringDecoder;
        var decoder = new StringDecoder(enc);
        this._readableState.decoder = decoder;
        this._readableState.encoding = this._readableState.decoder.encoding;
        var p = this._readableState.buffer.head;
        var content = "";
        while (p !== null) {
          content += decoder.write(p.data);
          p = p.next;
        }
        this._readableState.buffer.clear();
        if (content !== "") this._readableState.buffer.push(content);
        this._readableState.length = content.length;
        return this;
      };
      var MAX_HWM = 1073741824;
      function computeNewHighWaterMark(n) {
        if (n >= MAX_HWM) {
          n = MAX_HWM;
        } else {
          n--;
          n |= n >>> 1;
          n |= n >>> 2;
          n |= n >>> 4;
          n |= n >>> 8;
          n |= n >>> 16;
          n++;
        }
        return n;
      }
      function howMuchToRead(n, state) {
        if (n <= 0 || state.length === 0 && state.ended) return 0;
        if (state.objectMode) return 1;
        if (n !== n) {
          if (state.flowing && state.length) return state.buffer.head.data.length;
          else return state.length;
        }
        if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
        if (n <= state.length) return n;
        if (!state.ended) {
          state.needReadable = true;
          return 0;
        }
        return state.length;
      }
      Readable.prototype.read = function(n) {
        debug("read", n);
        n = parseInt(n, 10);
        var state = this._readableState;
        var nOrig = n;
        if (n !== 0) state.emittedReadable = false;
        if (n === 0 && state.needReadable && ((state.highWaterMark !== 0 ? state.length >= state.highWaterMark : state.length > 0) || state.ended)) {
          debug("read: emitReadable", state.length, state.ended);
          if (state.length === 0 && state.ended) endReadable(this);
          else emitReadable(this);
          return null;
        }
        n = howMuchToRead(n, state);
        if (n === 0 && state.ended) {
          if (state.length === 0) endReadable(this);
          return null;
        }
        var doRead = state.needReadable;
        debug("need readable", doRead);
        if (state.length === 0 || state.length - n < state.highWaterMark) {
          doRead = true;
          debug("length less than watermark", doRead);
        }
        if (state.ended || state.reading) {
          doRead = false;
          debug("reading or ended", doRead);
        } else if (doRead) {
          debug("do read");
          state.reading = true;
          state.sync = true;
          if (state.length === 0) state.needReadable = true;
          this._read(state.highWaterMark);
          state.sync = false;
          if (!state.reading) n = howMuchToRead(nOrig, state);
        }
        var ret;
        if (n > 0) ret = fromList(n, state);
        else ret = null;
        if (ret === null) {
          state.needReadable = state.length <= state.highWaterMark;
          n = 0;
        } else {
          state.length -= n;
          state.awaitDrain = 0;
        }
        if (state.length === 0) {
          if (!state.ended) state.needReadable = true;
          if (nOrig !== n && state.ended) endReadable(this);
        }
        if (ret !== null) this.emit("data", ret);
        return ret;
      };
      function onEofChunk(stream, state) {
        debug("onEofChunk");
        if (state.ended) return;
        if (state.decoder) {
          var chunk = state.decoder.end();
          if (chunk && chunk.length) {
            state.buffer.push(chunk);
            state.length += state.objectMode ? 1 : chunk.length;
          }
        }
        state.ended = true;
        if (state.sync) {
          emitReadable(stream);
        } else {
          state.needReadable = false;
          if (!state.emittedReadable) {
            state.emittedReadable = true;
            emitReadable_(stream);
          }
        }
      }
      function emitReadable(stream) {
        var state = stream._readableState;
        debug("emitReadable", state.needReadable, state.emittedReadable);
        state.needReadable = false;
        if (!state.emittedReadable) {
          debug("emitReadable", state.flowing);
          state.emittedReadable = true;
          process.nextTick(emitReadable_, stream);
        }
      }
      function emitReadable_(stream) {
        var state = stream._readableState;
        debug("emitReadable_", state.destroyed, state.length, state.ended);
        if (!state.destroyed && (state.length || state.ended)) {
          stream.emit("readable");
          state.emittedReadable = false;
        }
        state.needReadable = !state.flowing && !state.ended && state.length <= state.highWaterMark;
        flow(stream);
      }
      function maybeReadMore(stream, state) {
        if (!state.readingMore) {
          state.readingMore = true;
          process.nextTick(maybeReadMore_, stream, state);
        }
      }
      function maybeReadMore_(stream, state) {
        while (!state.reading && !state.ended && (state.length < state.highWaterMark || state.flowing && state.length === 0)) {
          var len = state.length;
          debug("maybeReadMore read 0");
          stream.read(0);
          if (len === state.length)
            break;
        }
        state.readingMore = false;
      }
      Readable.prototype._read = function(n) {
        errorOrDestroy(this, new ERR_METHOD_NOT_IMPLEMENTED("_read()"));
      };
      Readable.prototype.pipe = function(dest, pipeOpts) {
        var src = this;
        var state = this._readableState;
        switch (state.pipesCount) {
          case 0:
            state.pipes = dest;
            break;
          case 1:
            state.pipes = [state.pipes, dest];
            break;
          default:
            state.pipes.push(dest);
            break;
        }
        state.pipesCount += 1;
        debug("pipe count=%d opts=%j", state.pipesCount, pipeOpts);
        var doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== process.stdout && dest !== process.stderr;
        var endFn = doEnd ? onend : unpipe;
        if (state.endEmitted) process.nextTick(endFn);
        else src.once("end", endFn);
        dest.on("unpipe", onunpipe);
        function onunpipe(readable, unpipeInfo) {
          debug("onunpipe");
          if (readable === src) {
            if (unpipeInfo && unpipeInfo.hasUnpiped === false) {
              unpipeInfo.hasUnpiped = true;
              cleanup();
            }
          }
        }
        function onend() {
          debug("onend");
          dest.end();
        }
        var ondrain = pipeOnDrain(src);
        dest.on("drain", ondrain);
        var cleanedUp = false;
        function cleanup() {
          debug("cleanup");
          dest.removeListener("close", onclose);
          dest.removeListener("finish", onfinish);
          dest.removeListener("drain", ondrain);
          dest.removeListener("error", onerror);
          dest.removeListener("unpipe", onunpipe);
          src.removeListener("end", onend);
          src.removeListener("end", unpipe);
          src.removeListener("data", ondata);
          cleanedUp = true;
          if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
        }
        src.on("data", ondata);
        function ondata(chunk) {
          debug("ondata");
          var ret = dest.write(chunk);
          debug("dest.write", ret);
          if (ret === false) {
            if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
              debug("false write response, pause", state.awaitDrain);
              state.awaitDrain++;
            }
            src.pause();
          }
        }
        function onerror(er) {
          debug("onerror", er);
          unpipe();
          dest.removeListener("error", onerror);
          if (EElistenerCount(dest, "error") === 0) errorOrDestroy(dest, er);
        }
        prependListener2(dest, "error", onerror);
        function onclose() {
          dest.removeListener("finish", onfinish);
          unpipe();
        }
        dest.once("close", onclose);
        function onfinish() {
          debug("onfinish");
          dest.removeListener("close", onclose);
          unpipe();
        }
        dest.once("finish", onfinish);
        function unpipe() {
          debug("unpipe");
          src.unpipe(dest);
        }
        dest.emit("pipe", src);
        if (!state.flowing) {
          debug("pipe resume");
          src.resume();
        }
        return dest;
      };
      function pipeOnDrain(src) {
        return function pipeOnDrainFunctionResult() {
          var state = src._readableState;
          debug("pipeOnDrain", state.awaitDrain);
          if (state.awaitDrain) state.awaitDrain--;
          if (state.awaitDrain === 0 && EElistenerCount(src, "data")) {
            state.flowing = true;
            flow(src);
          }
        };
      }
      Readable.prototype.unpipe = function(dest) {
        var state = this._readableState;
        var unpipeInfo = {
          hasUnpiped: false
        };
        if (state.pipesCount === 0) return this;
        if (state.pipesCount === 1) {
          if (dest && dest !== state.pipes) return this;
          if (!dest) dest = state.pipes;
          state.pipes = null;
          state.pipesCount = 0;
          state.flowing = false;
          if (dest) dest.emit("unpipe", this, unpipeInfo);
          return this;
        }
        if (!dest) {
          var dests = state.pipes;
          var len = state.pipesCount;
          state.pipes = null;
          state.pipesCount = 0;
          state.flowing = false;
          for (var i = 0; i < len; i++) dests[i].emit("unpipe", this, {
            hasUnpiped: false
          });
          return this;
        }
        var index = indexOf(state.pipes, dest);
        if (index === -1) return this;
        state.pipes.splice(index, 1);
        state.pipesCount -= 1;
        if (state.pipesCount === 1) state.pipes = state.pipes[0];
        dest.emit("unpipe", this, unpipeInfo);
        return this;
      };
      Readable.prototype.on = function(ev, fn) {
        var res = Stream.prototype.on.call(this, ev, fn);
        var state = this._readableState;
        if (ev === "data") {
          state.readableListening = this.listenerCount("readable") > 0;
          if (state.flowing !== false) this.resume();
        } else if (ev === "readable") {
          if (!state.endEmitted && !state.readableListening) {
            state.readableListening = state.needReadable = true;
            state.flowing = false;
            state.emittedReadable = false;
            debug("on readable", state.length, state.reading);
            if (state.length) {
              emitReadable(this);
            } else if (!state.reading) {
              process.nextTick(nReadingNextTick, this);
            }
          }
        }
        return res;
      };
      Readable.prototype.addListener = Readable.prototype.on;
      Readable.prototype.removeListener = function(ev, fn) {
        var res = Stream.prototype.removeListener.call(this, ev, fn);
        if (ev === "readable") {
          process.nextTick(updateReadableListening, this);
        }
        return res;
      };
      Readable.prototype.removeAllListeners = function(ev) {
        var res = Stream.prototype.removeAllListeners.apply(this, arguments);
        if (ev === "readable" || ev === void 0) {
          process.nextTick(updateReadableListening, this);
        }
        return res;
      };
      function updateReadableListening(self2) {
        var state = self2._readableState;
        state.readableListening = self2.listenerCount("readable") > 0;
        if (state.resumeScheduled && !state.paused) {
          state.flowing = true;
        } else if (self2.listenerCount("data") > 0) {
          self2.resume();
        }
      }
      function nReadingNextTick(self2) {
        debug("readable nexttick read 0");
        self2.read(0);
      }
      Readable.prototype.resume = function() {
        var state = this._readableState;
        if (!state.flowing) {
          debug("resume");
          state.flowing = !state.readableListening;
          resume(this, state);
        }
        state.paused = false;
        return this;
      };
      function resume(stream, state) {
        if (!state.resumeScheduled) {
          state.resumeScheduled = true;
          process.nextTick(resume_, stream, state);
        }
      }
      function resume_(stream, state) {
        debug("resume", state.reading);
        if (!state.reading) {
          stream.read(0);
        }
        state.resumeScheduled = false;
        stream.emit("resume");
        flow(stream);
        if (state.flowing && !state.reading) stream.read(0);
      }
      Readable.prototype.pause = function() {
        debug("call pause flowing=%j", this._readableState.flowing);
        if (this._readableState.flowing !== false) {
          debug("pause");
          this._readableState.flowing = false;
          this.emit("pause");
        }
        this._readableState.paused = true;
        return this;
      };
      function flow(stream) {
        var state = stream._readableState;
        debug("flow", state.flowing);
        while (state.flowing && stream.read() !== null) ;
      }
      Readable.prototype.wrap = function(stream) {
        var _this = this;
        var state = this._readableState;
        var paused = false;
        stream.on("end", function() {
          debug("wrapped end");
          if (state.decoder && !state.ended) {
            var chunk = state.decoder.end();
            if (chunk && chunk.length) _this.push(chunk);
          }
          _this.push(null);
        });
        stream.on("data", function(chunk) {
          debug("wrapped data");
          if (state.decoder) chunk = state.decoder.write(chunk);
          if (state.objectMode && (chunk === null || chunk === void 0)) return;
          else if (!state.objectMode && (!chunk || !chunk.length)) return;
          var ret = _this.push(chunk);
          if (!ret) {
            paused = true;
            stream.pause();
          }
        });
        for (var i in stream) {
          if (this[i] === void 0 && typeof stream[i] === "function") {
            this[i] = /* @__PURE__ */ (function methodWrap(method) {
              return function methodWrapReturnFunction() {
                return stream[method].apply(stream, arguments);
              };
            })(i);
          }
        }
        for (var n = 0; n < kProxyEvents.length; n++) {
          stream.on(kProxyEvents[n], this.emit.bind(this, kProxyEvents[n]));
        }
        this._read = function(n2) {
          debug("wrapped _read", n2);
          if (paused) {
            paused = false;
            stream.resume();
          }
        };
        return this;
      };
      if (typeof Symbol === "function") {
        Readable.prototype[Symbol.asyncIterator] = function() {
          if (createReadableStreamAsyncIterator === void 0) {
            createReadableStreamAsyncIterator = require_async_iterator();
          }
          return createReadableStreamAsyncIterator(this);
        };
      }
      Object.defineProperty(Readable.prototype, "readableHighWaterMark", {
        // making it explicit this property is not enumerable
        // because otherwise some prototype manipulation in
        // userland will fail
        enumerable: false,
        get: function get() {
          return this._readableState.highWaterMark;
        }
      });
      Object.defineProperty(Readable.prototype, "readableBuffer", {
        // making it explicit this property is not enumerable
        // because otherwise some prototype manipulation in
        // userland will fail
        enumerable: false,
        get: function get() {
          return this._readableState && this._readableState.buffer;
        }
      });
      Object.defineProperty(Readable.prototype, "readableFlowing", {
        // making it explicit this property is not enumerable
        // because otherwise some prototype manipulation in
        // userland will fail
        enumerable: false,
        get: function get() {
          return this._readableState.flowing;
        },
        set: function set(state) {
          if (this._readableState) {
            this._readableState.flowing = state;
          }
        }
      });
      Readable._fromList = fromList;
      Object.defineProperty(Readable.prototype, "readableLength", {
        // making it explicit this property is not enumerable
        // because otherwise some prototype manipulation in
        // userland will fail
        enumerable: false,
        get: function get() {
          return this._readableState.length;
        }
      });
      function fromList(n, state) {
        if (state.length === 0) return null;
        var ret;
        if (state.objectMode) ret = state.buffer.shift();
        else if (!n || n >= state.length) {
          if (state.decoder) ret = state.buffer.join("");
          else if (state.buffer.length === 1) ret = state.buffer.first();
          else ret = state.buffer.concat(state.length);
          state.buffer.clear();
        } else {
          ret = state.buffer.consume(n, state.decoder);
        }
        return ret;
      }
      function endReadable(stream) {
        var state = stream._readableState;
        debug("endReadable", state.endEmitted);
        if (!state.endEmitted) {
          state.ended = true;
          process.nextTick(endReadableNT, state, stream);
        }
      }
      function endReadableNT(state, stream) {
        debug("endReadableNT", state.endEmitted, state.length);
        if (!state.endEmitted && state.length === 0) {
          state.endEmitted = true;
          stream.readable = false;
          stream.emit("end");
          if (state.autoDestroy) {
            var wState = stream._writableState;
            if (!wState || wState.autoDestroy && wState.finished) {
              stream.destroy();
            }
          }
        }
      }
      if (typeof Symbol === "function") {
        Readable.from = function(iterable, opts) {
          if (from === void 0) {
            from = require_from_browser();
          }
          return from(Readable, iterable, opts);
        };
      }
      function indexOf(xs, x) {
        for (var i = 0, l = xs.length; i < l; i++) {
          if (xs[i] === x) return i;
        }
        return -1;
      }
    }
  });

  // node_modules/readable-stream/lib/_stream_transform.js
  var require_stream_transform = __commonJS({
    "node_modules/readable-stream/lib/_stream_transform.js"(exports, module) {
      "use strict";
      module.exports = Transform;
      var _require$codes = require_errors_browser().codes;
      var ERR_METHOD_NOT_IMPLEMENTED = _require$codes.ERR_METHOD_NOT_IMPLEMENTED;
      var ERR_MULTIPLE_CALLBACK = _require$codes.ERR_MULTIPLE_CALLBACK;
      var ERR_TRANSFORM_ALREADY_TRANSFORMING = _require$codes.ERR_TRANSFORM_ALREADY_TRANSFORMING;
      var ERR_TRANSFORM_WITH_LENGTH_0 = _require$codes.ERR_TRANSFORM_WITH_LENGTH_0;
      var Duplex = require_stream_duplex();
      require_inherits_browser()(Transform, Duplex);
      function afterTransform(er, data) {
        var ts = this._transformState;
        ts.transforming = false;
        var cb = ts.writecb;
        if (cb === null) {
          return this.emit("error", new ERR_MULTIPLE_CALLBACK());
        }
        ts.writechunk = null;
        ts.writecb = null;
        if (data != null)
          this.push(data);
        cb(er);
        var rs = this._readableState;
        rs.reading = false;
        if (rs.needReadable || rs.length < rs.highWaterMark) {
          this._read(rs.highWaterMark);
        }
      }
      function Transform(options) {
        if (!(this instanceof Transform)) return new Transform(options);
        Duplex.call(this, options);
        this._transformState = {
          afterTransform: afterTransform.bind(this),
          needTransform: false,
          transforming: false,
          writecb: null,
          writechunk: null,
          writeencoding: null
        };
        this._readableState.needReadable = true;
        this._readableState.sync = false;
        if (options) {
          if (typeof options.transform === "function") this._transform = options.transform;
          if (typeof options.flush === "function") this._flush = options.flush;
        }
        this.on("prefinish", prefinish);
      }
      function prefinish() {
        var _this = this;
        if (typeof this._flush === "function" && !this._readableState.destroyed) {
          this._flush(function(er, data) {
            done(_this, er, data);
          });
        } else {
          done(this, null, null);
        }
      }
      Transform.prototype.push = function(chunk, encoding) {
        this._transformState.needTransform = false;
        return Duplex.prototype.push.call(this, chunk, encoding);
      };
      Transform.prototype._transform = function(chunk, encoding, cb) {
        cb(new ERR_METHOD_NOT_IMPLEMENTED("_transform()"));
      };
      Transform.prototype._write = function(chunk, encoding, cb) {
        var ts = this._transformState;
        ts.writecb = cb;
        ts.writechunk = chunk;
        ts.writeencoding = encoding;
        if (!ts.transforming) {
          var rs = this._readableState;
          if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
        }
      };
      Transform.prototype._read = function(n) {
        var ts = this._transformState;
        if (ts.writechunk !== null && !ts.transforming) {
          ts.transforming = true;
          this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
        } else {
          ts.needTransform = true;
        }
      };
      Transform.prototype._destroy = function(err, cb) {
        Duplex.prototype._destroy.call(this, err, function(err2) {
          cb(err2);
        });
      };
      function done(stream, er, data) {
        if (er) return stream.emit("error", er);
        if (data != null)
          stream.push(data);
        if (stream._writableState.length) throw new ERR_TRANSFORM_WITH_LENGTH_0();
        if (stream._transformState.transforming) throw new ERR_TRANSFORM_ALREADY_TRANSFORMING();
        return stream.push(null);
      }
    }
  });

  // node_modules/readable-stream/lib/_stream_passthrough.js
  var require_stream_passthrough = __commonJS({
    "node_modules/readable-stream/lib/_stream_passthrough.js"(exports, module) {
      "use strict";
      module.exports = PassThrough;
      var Transform = require_stream_transform();
      require_inherits_browser()(PassThrough, Transform);
      function PassThrough(options) {
        if (!(this instanceof PassThrough)) return new PassThrough(options);
        Transform.call(this, options);
      }
      PassThrough.prototype._transform = function(chunk, encoding, cb) {
        cb(null, chunk);
      };
    }
  });

  // node_modules/readable-stream/lib/internal/streams/pipeline.js
  var require_pipeline = __commonJS({
    "node_modules/readable-stream/lib/internal/streams/pipeline.js"(exports, module) {
      "use strict";
      var eos;
      function once2(callback) {
        var called = false;
        return function() {
          if (called) return;
          called = true;
          callback.apply(void 0, arguments);
        };
      }
      var _require$codes = require_errors_browser().codes;
      var ERR_MISSING_ARGS = _require$codes.ERR_MISSING_ARGS;
      var ERR_STREAM_DESTROYED = _require$codes.ERR_STREAM_DESTROYED;
      function noop2(err) {
        if (err) throw err;
      }
      function isRequest(stream) {
        return stream.setHeader && typeof stream.abort === "function";
      }
      function destroyer(stream, reading, writing, callback) {
        callback = once2(callback);
        var closed = false;
        stream.on("close", function() {
          closed = true;
        });
        if (eos === void 0) eos = require_end_of_stream();
        eos(stream, {
          readable: reading,
          writable: writing
        }, function(err) {
          if (err) return callback(err);
          closed = true;
          callback();
        });
        var destroyed = false;
        return function(err) {
          if (closed) return;
          if (destroyed) return;
          destroyed = true;
          if (isRequest(stream)) return stream.abort();
          if (typeof stream.destroy === "function") return stream.destroy();
          callback(err || new ERR_STREAM_DESTROYED("pipe"));
        };
      }
      function call(fn) {
        fn();
      }
      function pipe(from, to) {
        return from.pipe(to);
      }
      function popCallback(streams) {
        if (!streams.length) return noop2;
        if (typeof streams[streams.length - 1] !== "function") return noop2;
        return streams.pop();
      }
      function pipeline() {
        for (var _len = arguments.length, streams = new Array(_len), _key = 0; _key < _len; _key++) {
          streams[_key] = arguments[_key];
        }
        var callback = popCallback(streams);
        if (Array.isArray(streams[0])) streams = streams[0];
        if (streams.length < 2) {
          throw new ERR_MISSING_ARGS("streams");
        }
        var error;
        var destroys = streams.map(function(stream, i) {
          var reading = i < streams.length - 1;
          var writing = i > 0;
          return destroyer(stream, reading, writing, function(err) {
            if (!error) error = err;
            if (err) destroys.forEach(call);
            if (reading) return;
            destroys.forEach(call);
            callback(error);
          });
        });
        return streams.reduce(pipe);
      }
      module.exports = pipeline;
    }
  });

  // node_modules/stream-browserify/index.js
  var require_stream_browserify = __commonJS({
    "node_modules/stream-browserify/index.js"(exports, module) {
      module.exports = Stream;
      var EE = require_events().EventEmitter;
      var inherits = require_inherits_browser();
      inherits(Stream, EE);
      Stream.Readable = require_stream_readable();
      Stream.Writable = require_stream_writable();
      Stream.Duplex = require_stream_duplex();
      Stream.Transform = require_stream_transform();
      Stream.PassThrough = require_stream_passthrough();
      Stream.finished = require_end_of_stream();
      Stream.pipeline = require_pipeline();
      Stream.Stream = Stream;
      function Stream() {
        EE.call(this);
      }
      Stream.prototype.pipe = function(dest, options) {
        var source = this;
        function ondata(chunk) {
          if (dest.writable) {
            if (false === dest.write(chunk) && source.pause) {
              source.pause();
            }
          }
        }
        source.on("data", ondata);
        function ondrain() {
          if (source.readable && source.resume) {
            source.resume();
          }
        }
        dest.on("drain", ondrain);
        if (!dest._isStdio && (!options || options.end !== false)) {
          source.on("end", onend);
          source.on("close", onclose);
        }
        var didOnEnd = false;
        function onend() {
          if (didOnEnd) return;
          didOnEnd = true;
          dest.end();
        }
        function onclose() {
          if (didOnEnd) return;
          didOnEnd = true;
          if (typeof dest.destroy === "function") dest.destroy();
        }
        function onerror(er) {
          cleanup();
          if (EE.listenerCount(this, "error") === 0) {
            throw er;
          }
        }
        source.on("error", onerror);
        dest.on("error", onerror);
        function cleanup() {
          source.removeListener("data", ondata);
          dest.removeListener("drain", ondrain);
          source.removeListener("end", onend);
          source.removeListener("close", onclose);
          source.removeListener("error", onerror);
          dest.removeListener("error", onerror);
          source.removeListener("end", cleanup);
          source.removeListener("close", cleanup);
          dest.removeListener("close", cleanup);
        }
        source.on("end", cleanup);
        source.on("close", cleanup);
        dest.on("close", cleanup);
        dest.emit("pipe", source);
        return dest;
      };
    }
  });

  // node_modules/@jsonjoy.com/fs-node-builtins/lib/stream.js
  var require_stream = __commonJS({
    "node_modules/@jsonjoy.com/fs-node-builtins/lib/stream.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Writable = exports.Readable = void 0;
      var node_stream_1 = require_stream_browserify();
      Object.defineProperty(exports, "Readable", { enumerable: true, get: function() {
        return node_stream_1.Readable;
      } });
      Object.defineProperty(exports, "Writable", { enumerable: true, get: function() {
        return node_stream_1.Writable;
      } });
    }
  });

  // node_modules/@jsonjoy.com/fs-node-builtins/lib/events.js
  var require_events2 = __commonJS({
    "node_modules/@jsonjoy.com/fs-node-builtins/lib/events.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.EventEmitter = void 0;
      var node_events_1 = require_events();
      Object.defineProperty(exports, "EventEmitter", { enumerable: true, get: function() {
        return node_events_1.EventEmitter;
      } });
    }
  });

  // node_modules/@jsonjoy.com/fs-node/lib/FileHandle.js
  var require_FileHandle = __commonJS({
    "node_modules/@jsonjoy.com/fs-node/lib/FileHandle.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.FileHandle = void 0;
      var util_1 = require_util3();
      var readWriteArgs_1 = require_readWriteArgs();
      var events_1 = require_events2();
      var assertOpen = (fd, syscall) => {
        if (fd !== -1)
          return;
        const error = new Error("file closed");
        error.code = "EBADF";
        error.syscall = syscall;
        throw error;
      };
      var FileHandle = class extends events_1.EventEmitter {
        constructor(fs2, fd) {
          super();
          this.refs = 1;
          this.closePromise = null;
          this.readableWebStreamLocked = false;
          this.fs = fs2;
          this.fd = fd;
        }
        getAsyncId() {
          return this.fd;
        }
        appendFile(data, options) {
          return (0, util_1.promisify)(this.fs, "appendFile")(this.fd, data, options);
        }
        chmod(mode) {
          return (0, util_1.promisify)(this.fs, "fchmod")(this.fd, mode);
        }
        chown(uid, gid) {
          return (0, util_1.promisify)(this.fs, "fchown")(this.fd, uid, gid);
        }
        close() {
          if (this.fd === -1) {
            return Promise.resolve();
          }
          if (this.closePromise) {
            return this.closePromise;
          }
          this.refs--;
          if (this.refs === 0) {
            const currentFd = this.fd;
            this.fd = -1;
            this.closePromise = (0, util_1.promisify)(this.fs, "close")(currentFd).finally(() => {
              this.closePromise = null;
            });
          } else {
            this.closePromise = new Promise((resolve2, reject) => {
              this.closeResolve = resolve2;
              this.closeReject = reject;
            }).finally(() => {
              this.closePromise = null;
              this.closeReject = void 0;
              this.closeResolve = void 0;
            });
          }
          this.emit("close");
          return this.closePromise;
        }
        datasync() {
          return (0, util_1.promisify)(this.fs, "fdatasync")(this.fd);
        }
        createReadStream(options) {
          return this.fs.createReadStream("", { ...options, fd: this });
        }
        createWriteStream(options) {
          return this.fs.createWriteStream("", { ...options, fd: this });
        }
        readableWebStream(options = {}) {
          const { type = "bytes", autoClose = false } = options;
          if (this.fd === -1) {
            throw new Error("The FileHandle is closed");
          }
          if (this.closePromise) {
            throw new Error("The FileHandle is closing");
          }
          if (this.readableWebStreamLocked) {
            throw new Error("An error will be thrown if this method is called more than once or is called after the FileHandle is closed or closing.");
          }
          this.readableWebStreamLocked = true;
          this.ref();
          const unlockAndCleanup = () => {
            this.readableWebStreamLocked = false;
            this.unref();
            if (autoClose) {
              this.close().catch(() => {
              });
            }
          };
          return new ReadableStream({
            type: type === "bytes" ? "bytes" : void 0,
            autoAllocateChunkSize: 16384,
            pull: async (controller) => {
              try {
                const view = controller.byobRequest?.view;
                if (!view) {
                  const buffer = new Uint8Array(16384);
                  const result2 = await this.read(buffer, 0, buffer.length, null);
                  if (result2.bytesRead === 0) {
                    controller.close();
                    unlockAndCleanup();
                    return;
                  }
                  controller.enqueue(buffer.slice(0, result2.bytesRead));
                  return;
                }
                const result = await this.read(view, 0, view.byteLength, null);
                if (result.bytesRead === 0) {
                  controller.close();
                  controller.byobRequest.respond(0);
                  unlockAndCleanup();
                  return;
                }
                controller.byobRequest.respond(result.bytesRead);
              } catch (error) {
                controller.error(error);
                unlockAndCleanup();
              }
            },
            cancel: async () => {
              unlockAndCleanup();
            }
          });
        }
        async read(bufferOrParams, offsetOrOptions, length, position) {
          assertOpen(this.fd, "read");
          const args = (0, readWriteArgs_1.getHandleReadArgs)(bufferOrParams, offsetOrOptions, length, position);
          const buffer = args.buffer;
          if (args.length === 0)
            return { __proto__: null, bytesRead: args.length, buffer };
          const bytesRead = await (0, util_1.promisify)(this.fs, "read")(this.fd, buffer, args.offset, args.length, args.position);
          return { __proto__: null, bytesRead, buffer };
        }
        async readv(buffers, position) {
          assertOpen(this.fd, "readv");
          const bytesRead = await (0, util_1.promisify)(this.fs, "readv")(this.fd, buffers, position ?? null);
          return { __proto__: null, bytesRead, buffers };
        }
        readFile(options) {
          return (0, util_1.promisify)(this.fs, "readFile")(this.fd, options);
        }
        stat(options) {
          return (0, util_1.promisify)(this.fs, "fstat")(this.fd, options);
        }
        sync() {
          return (0, util_1.promisify)(this.fs, "fsync")(this.fd);
        }
        truncate(len) {
          return (0, util_1.promisify)(this.fs, "ftruncate")(this.fd, len);
        }
        utimes(atime, mtime) {
          return (0, util_1.promisify)(this.fs, "futimes")(this.fd, atime, mtime);
        }
        async write(data, offsetOrOptions, lengthOrEncoding, position) {
          assertOpen(this.fd, "write");
          const args = (0, readWriteArgs_1.getHandleWriteArgs)(data, offsetOrOptions, lengthOrEncoding, position);
          if (!args)
            return { __proto__: null, bytesWritten: 0, buffer: data };
          const bytesWritten = await (0, util_1.promisify)(this.fs, "write")(this.fd, args.buffer, args.offset, args.length, args.position);
          return { __proto__: null, bytesWritten, buffer: data };
        }
        async writev(buffers, position) {
          assertOpen(this.fd, "writev");
          const bytesWritten = await (0, util_1.promisify)(this.fs, "writev")(this.fd, buffers, position ?? null);
          return { __proto__: null, bytesWritten, buffers };
        }
        writeFile(data, options) {
          return (0, util_1.promisify)(this.fs, "writeFile")(this.fd, data, options);
        }
        // Implement Symbol.asyncDispose if available (ES2023+)
        async [Symbol.asyncDispose]() {
          await this.close();
        }
        ref() {
          this.refs++;
        }
        unref() {
          this.refs--;
          if (this.refs === 0) {
            this.fd = -1;
            if (this.closeResolve) {
              (0, util_1.promisify)(this.fs, "close")(this.fd).then(this.closeResolve, this.closeReject);
            }
          }
        }
      };
      exports.FileHandle = FileHandle;
    }
  });

  // node_modules/@jsonjoy.com/fs-node-builtins/lib/util.js
  var require_util5 = __commonJS({
    "node_modules/@jsonjoy.com/fs-node-builtins/lib/util.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.inherits = inherits;
      exports.promisify = promisify;
      exports.inspect = inspect;
      exports.format = format2;
      function inherits(ctor, superCtor) {
        if (ctor === void 0 || ctor === null) {
          throw new TypeError("The constructor to inherit from is not defined");
        }
        if (superCtor === void 0 || superCtor === null) {
          throw new TypeError("The super constructor to inherit from is not defined");
        }
        ctor.super_ = superCtor;
        ctor.prototype = Object.create(superCtor.prototype, {
          constructor: {
            value: ctor,
            enumerable: false,
            writable: true,
            configurable: true
          }
        });
      }
      function promisify(fn) {
        if (typeof fn !== "function") {
          throw new TypeError('The "original" argument must be of type function');
        }
        return function(...args) {
          return new Promise((resolve2, reject) => {
            fn.call(this, ...args, (err, result) => {
              if (err) {
                reject(err);
              } else {
                resolve2(result);
              }
            });
          });
        };
      }
      function inspect(value) {
        if (value === null)
          return "null";
        if (value === void 0)
          return "undefined";
        if (typeof value === "string")
          return `'${value}'`;
        if (typeof value === "number" || typeof value === "boolean")
          return String(value);
        if (Array.isArray(value)) {
          const items = value.map((item) => inspect(item)).join(", ");
          return `[ ${items} ]`;
        }
        if (typeof value === "object") {
          const entries = Object.entries(value).map(([key, val]) => `${key}: ${inspect(val)}`).join(", ");
          return `{ ${entries} }`;
        }
        return String(value);
      }
      function format2(template, ...args) {
        if (args.length === 0)
          return template;
        let result = template;
        let argIndex = 0;
        result = result.replace(/%[sdj%]/g, (match) => {
          if (argIndex >= args.length)
            return match;
          const arg = args[argIndex++];
          switch (match) {
            case "%s":
              return String(arg);
            case "%d":
              return Number(arg).toString();
            case "%j":
              try {
                return JSON.stringify(arg);
              } catch {
                return "[Circular]";
              }
            case "%%":
              return "%";
            default:
              return match;
          }
        });
        while (argIndex < args.length) {
          result += " " + String(args[argIndex++]);
        }
        return result;
      }
    }
  });

  // node_modules/@jsonjoy.com/fs-node/lib/cp.js
  var require_cp = __commonJS({
    "node_modules/@jsonjoy.com/fs-node/lib/cp.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.cpAsync = exports.cpSync = exports.copyFileCore = exports.getCpOptions = exports.getValidCopyFileMode = void 0;
      var path_1 = require_path();
      var fs_node_utils_1 = require_lib2();
      var fs_core_1 = require_lib3();
      var argErrors_1 = require_argErrors();
      var validators_1 = require_validators();
      var pathResolve = path_1.posix.resolve;
      var { O_RDONLY, O_WRONLY, O_CREAT, O_EXCL, COPYFILE_EXCL, COPYFILE_FICLONE_FORCE } = fs_node_utils_1.constants;
      var PREFIX = {
        ERR_FS_CP_DIR_TO_NON_DIR: "Cannot overwrite non-directory with directory",
        ERR_FS_CP_EEXIST: "Target already exists",
        ERR_FS_CP_EINVAL: "Invalid src or dest",
        ERR_FS_CP_FIFO_PIPE: "Cannot copy a FIFO pipe",
        ERR_FS_CP_NON_DIR_TO_DIR: "Cannot overwrite directory with non-directory",
        ERR_FS_CP_SOCKET: "Cannot copy a socket file",
        ERR_FS_CP_SYMLINK_TO_SUBDIRECTORY: "Cannot overwrite symlink in subdirectory of self",
        ERR_FS_CP_UNKNOWN: "Cannot copy an unknown file type",
        ERR_FS_EISDIR: "Path is a directory"
      };
      var cpSystemError = (code, message, path2, errno, uv) => new fs_core_1.SystemError(code, PREFIX[code], { code: uv, message, path: path2, syscall: "cp", errno });
      var cpCodeError = (code, message) => (0, argErrors_1.withNativeCode)(new Error(message), code);
      var invalidFilterReturn = (value) => (0, argErrors_1.withCode)(new TypeError('Expected boolean to be returned from the "filter" function but got an instance of Promise.'), "ERR_INVALID_RETURN_VALUE");
      var asCopyfileError = (error, src, dest) => error && typeof error.code === "string" && typeof error.syscall === "string" ? (0, fs_core_1.createError)(error.code, "copyfile", src, dest) : error;
      var getValidCpMode = (mode) => {
        if (mode === null || mode === void 0)
          return 0;
        (0, validators_1.validateInteger)(mode, "mode", 0, 7);
        return mode;
      };
      var getValidCopyFileMode = (mode) => {
        if (mode === null || mode === void 0)
          return 0;
        if (typeof mode !== "number")
          throw (0, argErrors_1.withNativeCode)(new TypeError("mode must be int32 or null/undefined"), "ERR_INVALID_ARG_TYPE");
        if (!Number.isFinite(mode))
          throw (0, argErrors_1.withNativeCode)(new RangeError("mode is out of range"), "ERR_OUT_OF_RANGE");
        const truncated = Math.trunc(mode);
        if (truncated < 0 || truncated > 7)
          throw (0, argErrors_1.withNativeCode)(new RangeError("mode is out of range: >= 0 && <= 7"), "ERR_OUT_OF_RANGE");
        return truncated;
      };
      exports.getValidCopyFileMode = getValidCopyFileMode;
      var CP_DEFAULTS = {
        dereference: false,
        errorOnExist: false,
        filter: void 0,
        force: true,
        mode: 0,
        preserveTimestamps: false,
        recursive: false,
        verbatimSymlinks: false
      };
      var getCpOptions = (options) => {
        if (options === void 0)
          return { ...CP_DEFAULTS };
        (0, validators_1.validateObject)(options, "options");
        const resolved = { ...CP_DEFAULTS, ...options };
        (0, validators_1.validateBoolean)(resolved.dereference, "options.dereference");
        (0, validators_1.validateBoolean)(resolved.errorOnExist, "options.errorOnExist");
        (0, validators_1.validateBoolean)(resolved.force, "options.force");
        (0, validators_1.validateBoolean)(resolved.preserveTimestamps, "options.preserveTimestamps");
        (0, validators_1.validateBoolean)(resolved.recursive, "options.recursive");
        (0, validators_1.validateBoolean)(resolved.verbatimSymlinks, "options.verbatimSymlinks");
        resolved.mode = getValidCpMode(options.mode);
        if (resolved.dereference === true && resolved.verbatimSymlinks === true)
          throw (0, argErrors_1.withCode)(new TypeError('Option "dereference" cannot be used in combination with option "verbatimSymlinks"'), "ERR_INCOMPATIBLE_OPTION_PAIR");
        if (resolved.filter !== void 0)
          (0, validators_1.validateFunction)(resolved.filter, "options.filter");
        return resolved;
      };
      exports.getCpOptions = getCpOptions;
      var isPromise = (value) => !!value && (typeof value === "object" || typeof value === "function") && typeof value.then === "function";
      var copyFileCore = (core, src, dest, flags) => {
        let srcFd = -1;
        let destFd = -1;
        let copied = false;
        try {
          srcFd = core.open(src, O_RDONLY, 0);
          const srcNode = core.getFileByFdOrThrow(srcFd, "copyfile").node;
          const srcMode = srcNode.mode;
          const excl = !!(flags & COPYFILE_EXCL);
          destFd = core.open(dest, excl ? O_WRONLY | O_CREAT | O_EXCL : O_WRONLY | O_CREAT, 438);
          const destNode = core.getFileByFdOrThrow(destFd, "copyfile").node;
          if (!excl) {
            if (destNode === srcNode) {
              copied = true;
              return;
            }
            core.ftruncate(destFd, 0);
          }
          core.fchmod(destFd, srcMode);
          if (flags & COPYFILE_FICLONE_FORCE)
            throw (0, fs_core_1.createError)("ENOSYS", "copyfile", src, dest);
          if (srcNode.isDirectory())
            throw (0, fs_core_1.createError)("EISDIR", "copyfile", src, dest);
          const size = srcNode.getSize();
          if (size > 0)
            core.write(destFd, srcNode.getBuffer(), 0, size, 0);
          copied = true;
        } catch (error) {
          throw asCopyfileError(error, src, dest);
        } finally {
          if (srcFd >= 0)
            core.close(srcFd);
          if (destFd >= 0) {
            core.close(destFd);
            if (!copied)
              try {
                core.unlink(dest);
              } catch {
              }
          }
        }
      };
      exports.copyFileCore = copyFileCore;
      var toParts = (path2) => {
        const raw = pathResolve(path2).split("/");
        const parts = [];
        for (let i = 0; i < raw.length; i++)
          if (raw[i])
            parts.push(raw[i]);
        return parts;
      };
      var isSrcSubdir = (src, dest) => {
        const srcArr = toParts(src);
        const destArr = toParts(dest);
        const length = srcArr.length;
        if (length > destArr.length)
          return false;
        for (let i = 0; i < length; i++)
          if (destArr[i] !== srcArr[i])
            return false;
        return true;
      };
      var areIdentical = (srcStat, destStat) => srcStat.ino === destStat.ino && srcStat.dev === destStat.dev;
      var statOf = (vol, path2, dereference) => dereference ? vol.statSync(path2) : vol.lstatSync(path2);
      var statOrNull = (vol, path2, dereference) => dereference ? vol.statSync(path2, { throwIfNoEntry: false }) : vol.lstatSync(path2, { throwIfNoEntry: false });
      var readEntries = (vol, dir) => {
        try {
          return vol.readdirSync(dir);
        } catch (error) {
          const code = error.code;
          throw code ? (0, fs_core_1.createError)(code, "opendir", dir) : error;
        }
      };
      var isDirectory = (vol, path2) => {
        const stats = vol.statSync(path2, { throwIfNoEntry: false });
        return !!stats && stats.isDirectory();
      };
      var setDestMode = (vol, dest, srcMode) => {
        vol.chmodSync(dest, Number(srcMode));
      };
      var setDestTimestamps = (vol, src, dest) => {
        const updated = vol.statSync(src);
        vol.utimesSync(dest, updated.atime, updated.mtime);
      };
      var resolveLinkTarget = (vol, src, verbatimSymlinks) => {
        const target = String(vol.readlinkSync(src));
        return !verbatimSymlinks && target[0] !== "/" ? pathResolve((0, fs_node_utils_1.pathDirname)(src), target) : target;
      };
      var identicalPaths = (vol, a, b) => {
        try {
          const statA = vol.statSync(a, { throwIfNoEntry: false });
          if (!statA)
            return false;
          const statB = vol.statSync(b, { throwIfNoEntry: false });
          return !!statB && areIdentical(statA, statB);
        } catch {
          return false;
        }
      };
      var srcAliasesAncestor = (vol, srcStat, srcParent, destParent) => {
        for (let ancestor = destParent; ancestor !== srcParent && ancestor !== "/"; ancestor = (0, fs_node_utils_1.pathDirname)(ancestor)) {
          let stat;
          try {
            stat = vol.statSync(ancestor, { throwIfNoEntry: false });
          } catch {
            return false;
          }
          if (!stat)
            continue;
          if (!stat.isDirectory())
            return false;
          if (areIdentical(srcStat, stat))
            return true;
        }
        return false;
      };
      var checkPathsSync = (vol, src, dest, dereference, recursive) => {
        let srcStat;
        try {
          srcStat = statOf(vol, src, !dereference);
        } catch (error) {
          const code = error.code;
          throw code ? (0, fs_core_1.createError)(code, dereference ? "stat" : "lstat", src) : error;
        }
        let destStat;
        try {
          destStat = statOf(vol, dest, dereference);
        } catch {
        }
        const srcIsDir = srcStat.isDirectory() || dereference && srcStat.isSymbolicLink();
        const srcPath = pathResolve(src);
        const destPath = pathResolve(dest);
        if (destStat) {
          if (identicalPaths(vol, srcPath, destPath))
            throw cpCodeError("ERR_FS_CP_EINVAL", "src and dest cannot be the same " + destPath);
          const destIsDir = destStat.isDirectory();
          if (srcIsDir && !destIsDir)
            throw cpCodeError("ERR_FS_CP_DIR_TO_NON_DIR", "Cannot overwrite non-directory " + destPath + " with directory " + srcPath);
          if (!srcIsDir && destIsDir)
            throw cpCodeError("ERR_FS_CP_NON_DIR_TO_DIR", "Cannot overwrite directory " + destPath + " with non-directory " + srcPath);
        }
        const srcPrefix = srcPath === "/" ? srcPath : srcPath + "/";
        if (srcIsDir && destPath.startsWith(srcPrefix))
          throw cpCodeError("ERR_FS_CP_EINVAL", "Cannot copy " + srcPrefix + " to a subdirectory of self " + destPath);
        const destParent = (0, fs_node_utils_1.pathDirname)(destPath);
        const srcParent = (0, fs_node_utils_1.pathDirname)(srcPath);
        if (srcParent !== destParent && destParent !== "/" && identicalPaths(vol, srcPath, destParent))
          throw cpCodeError("ERR_FS_CP_EINVAL", "Cannot copy " + srcPrefix + " to a subdirectory of self " + destPath);
        if (recursive && srcIsDir) {
          const copyStat = statOrNull(vol, src, dereference);
          const followed = dereference ? copyStat : srcStat;
          if (copyStat && followed && copyStat.isDirectory() && srcAliasesAncestor(vol, followed, srcParent, destParent))
            throw cpCodeError("ERR_FS_CP_EINVAL", "Cannot copy " + srcPrefix + " to a subdirectory of self " + destPath);
        }
        if (srcIsDir && !recursive)
          throw cpCodeError("ERR_FS_EISDIR", "Recursive option not enabled, cannot copy a directory: " + srcPrefix);
        if (srcStat.isSocket())
          throw cpCodeError("ERR_FS_CP_SOCKET", "Cannot copy a socket file: " + destPath);
        if (srcStat.isFIFO())
          throw cpCodeError("ERR_FS_CP_FIFO_PIPE", "Cannot copy a FIFO pipe: " + destPath);
        try {
          if (!destStat || !vol.existsSync(destParent))
            vol.mkdirSync(destParent, { recursive: true });
        } catch {
        }
      };
      var filterSync = (filter2, src, dest) => {
        const shouldCopy = filter2(src, dest);
        if (isPromise(shouldCopy))
          throw invalidFilterReturn(shouldCopy);
        return !!shouldCopy;
      };
      var cpSync = (vol, src, dest, options) => {
        const filter2 = options.filter;
        if (filter2 && !filterSync(filter2, src, dest))
          return;
        checkPathsSync(vol, src, dest, options.dereference, options.recursive);
        getStatsSync(vol, src, dest, options);
      };
      exports.cpSync = cpSync;
      var getStatsSync = (vol, src, dest, options) => {
        const dereference = options.dereference;
        const srcStat = statOf(vol, src, dereference);
        const destStat = statOrNull(vol, dest, dereference);
        if (srcStat.isDirectory() && options.recursive)
          return onDirSync(srcStat, destStat, vol, src, dest, options);
        if (srcStat.isFile() || srcStat.isCharacterDevice() || srcStat.isBlockDevice())
          return onFileSync(srcStat, destStat, vol, src, dest, options);
        if (srcStat.isSymbolicLink())
          return onLinkSync(destStat, vol, src, dest, options.verbatimSymlinks);
      };
      var onFileSync = (srcStat, destStat, vol, src, dest, options) => {
        if (destStat) {
          if (options.force)
            vol.unlinkSync(dest);
          else if (options.errorOnExist)
            throw cpSystemError("ERR_FS_CP_EEXIST", dest + " already exists", dest, 17, "EEXIST");
          else
            return;
        }
        (0, exports.copyFileCore)(vol._core, src, dest, options.mode);
        const srcMode = Number(srcStat.mode);
        setDestMode(vol, dest, srcMode);
        if (options.preserveTimestamps)
          setDestTimestamps(vol, src, dest);
      };
      var onDirSync = (srcStat, destStat, vol, src, dest, options) => {
        if (!destStat)
          copyDirSync(vol, src, dest, options, true, Number(srcStat.mode));
        else
          copyDirSync(vol, src, dest, options, false, void 0);
      };
      var copyDirSync = (vol, src, dest, options, mkDir, srcMode) => {
        if (mkDir)
          vol.mkdirSync(dest);
        try {
          const entries = readEntries(vol, src);
          const filter2 = options.filter;
          for (let i = 0; i < entries.length; i++) {
            const name = entries[i];
            const srcItem = (0, fs_node_utils_1.pathJoin)(src, name);
            const destItem = (0, fs_node_utils_1.pathJoin)(dest, name);
            if (filter2 && !filterSync(filter2, srcItem, destItem))
              continue;
            getStatsSync(vol, srcItem, destItem, options);
          }
        } finally {
          if (srcMode !== void 0)
            setDestMode(vol, dest, srcMode);
        }
      };
      var onLinkSync = (destStat, vol, src, dest, verbatimSymlinks) => {
        const resolvedSrc = resolveLinkTarget(vol, src, verbatimSymlinks);
        if (!destStat) {
          vol.symlinkSync(resolvedSrc, dest);
          return;
        }
        let resolvedDest;
        try {
          resolvedDest = String(vol.readlinkSync(dest));
        } catch (error) {
          if (error.code === "EINVAL") {
            vol.symlinkSync(resolvedSrc, dest);
            return;
          }
          throw error;
        }
        if (resolvedDest[0] !== "/")
          resolvedDest = pathResolve((0, fs_node_utils_1.pathDirname)(dest), resolvedDest);
        if (isDirectory(vol, src) && isSrcSubdir(resolvedSrc, resolvedDest))
          throw cpCodeError("ERR_FS_CP_EINVAL", "Cannot copy " + resolvedSrc + " to a subdirectory of self " + resolvedDest);
        if (isDirectory(vol, dest) && isSrcSubdir(resolvedDest, resolvedSrc))
          throw cpCodeError("ERR_FS_CP_SYMLINK_TO_SUBDIRECTORY", "cannot overwrite " + resolvedDest + " with " + resolvedSrc);
        vol.unlinkSync(dest);
        vol.symlinkSync(resolvedSrc, dest);
      };
      var cpAsync = async (vol, src, dest, options) => {
        const stats = await checkPaths(vol, src, dest, options);
        if (!stats)
          return;
        checkParentPaths(vol, src, stats.srcStat, dest, options.recursive);
        const destParent = (0, fs_node_utils_1.pathDirname)(dest);
        if (!vol.existsSync(destParent))
          vol.mkdirSync(destParent, { recursive: true });
        await getStatsForCopy(vol, stats.destStat, src, dest, options);
      };
      exports.cpAsync = cpAsync;
      var checkPaths = async (vol, src, dest, options) => {
        const filter2 = options.filter;
        if (filter2 && !await filter2(src, dest))
          return void 0;
        const dereference = options.dereference;
        const srcStat = statOf(vol, src, dereference);
        const destStat = statOrNull(vol, dest, dereference);
        if (destStat) {
          if (areIdentical(srcStat, destStat))
            throw cpSystemError("ERR_FS_CP_EINVAL", "src and dest cannot be the same", dest, 22, "EINVAL");
          if (srcStat.isDirectory() && !destStat.isDirectory())
            throw cpSystemError("ERR_FS_CP_DIR_TO_NON_DIR", "cannot overwrite non-directory " + dest + " with directory " + src, dest, 21, "EISDIR");
          if (!srcStat.isDirectory() && destStat.isDirectory())
            throw cpSystemError("ERR_FS_CP_NON_DIR_TO_DIR", "cannot overwrite directory " + dest + " with non-directory " + src, dest, 20, "ENOTDIR");
        }
        if (srcStat.isDirectory() && isSrcSubdir(src, dest))
          throw cpSystemError("ERR_FS_CP_EINVAL", "cannot copy " + src + " to a subdirectory of self " + dest, dest, 22, "EINVAL");
        return { srcStat, destStat };
      };
      var checkParentPaths = (vol, src, srcStat, dest, recursive) => {
        const srcParent = pathResolve((0, fs_node_utils_1.pathDirname)(src));
        const skipMissing = recursive && srcStat.isDirectory();
        let at = dest;
        for (let parent = pathResolve((0, fs_node_utils_1.pathDirname)(dest)); parent !== srcParent && parent !== "/"; at = parent, parent = (0, fs_node_utils_1.pathDirname)(parent)) {
          const parentStat = vol.statSync(parent, { throwIfNoEntry: false });
          if (!parentStat) {
            if (skipMissing)
              continue;
            return;
          }
          if (areIdentical(srcStat, parentStat))
            throw cpSystemError("ERR_FS_CP_EINVAL", "cannot copy " + src + " to a subdirectory of self " + at, at, 22, "EINVAL");
        }
      };
      var getStatsForCopy = async (vol, destStat, src, dest, options) => {
        const srcStat = statOf(vol, src, options.dereference);
        if (srcStat.isDirectory() && options.recursive)
          return onDir(vol, srcStat, destStat, src, dest, options);
        if (srcStat.isDirectory())
          throw cpSystemError("ERR_FS_EISDIR", src + " is a directory (not copied)", src, 21, "EISDIR");
        if (srcStat.isFile() || srcStat.isCharacterDevice() || srcStat.isBlockDevice())
          return onFile(vol, srcStat, destStat, src, dest, options);
        if (srcStat.isSymbolicLink())
          return onLink(vol, destStat, src, dest, options);
        if (srcStat.isSocket())
          throw cpSystemError("ERR_FS_CP_SOCKET", "cannot copy a socket file: " + dest, dest, 22, "EINVAL");
        if (srcStat.isFIFO())
          throw cpSystemError("ERR_FS_CP_FIFO_PIPE", "cannot copy a FIFO pipe: " + dest, dest, 22, "EINVAL");
        throw cpSystemError("ERR_FS_CP_UNKNOWN", "cannot copy an unknown file type: " + dest, dest, 22, "EINVAL");
      };
      var onFile = async (vol, srcStat, destStat, src, dest, options) => {
        if (destStat) {
          if (options.force)
            vol.unlinkSync(dest);
          else if (options.errorOnExist)
            throw cpSystemError("ERR_FS_CP_EEXIST", dest + " already exists", dest, 17, "EEXIST");
          else
            return;
        }
        (0, exports.copyFileCore)(vol._core, src, dest, options.mode);
        const srcMode = Number(srcStat.mode);
        setDestMode(vol, dest, srcMode);
        if (options.preserveTimestamps)
          setDestTimestamps(vol, src, dest);
      };
      var onDir = async (vol, srcStat, destStat, src, dest, options) => {
        if (!destStat) {
          vol.mkdirSync(dest);
          await copyDir(vol, src, dest, options);
          setDestMode(vol, dest, Number(srcStat.mode));
          return;
        }
        if (options.errorOnExist && !options.force)
          throw cpSystemError("ERR_FS_CP_EEXIST", dest + " already exists", dest, 17, "EEXIST");
        await copyDir(vol, src, dest, options);
      };
      var copyDir = async (vol, src, dest, options) => {
        const entries = readEntries(vol, src);
        for (let i = 0; i < entries.length; i++) {
          const name = entries[i];
          const srcItem = (0, fs_node_utils_1.pathJoin)(src, name);
          const destItem = (0, fs_node_utils_1.pathJoin)(dest, name);
          const checked = await checkPaths(vol, srcItem, destItem, options);
          if (checked)
            await getStatsForCopy(vol, checked.destStat, srcItem, destItem, options);
        }
      };
      var onLink = async (vol, destStat, src, dest, options) => {
        const resolvedSrc = resolveLinkTarget(vol, src, options.verbatimSymlinks);
        if (!destStat) {
          vol.symlinkSync(resolvedSrc, dest);
          return;
        }
        let resolvedDest;
        try {
          resolvedDest = String(vol.readlinkSync(dest));
        } catch (error) {
          if (error.code === "EINVAL") {
            vol.symlinkSync(resolvedSrc, dest);
            return;
          }
          throw error;
        }
        if (resolvedDest[0] !== "/")
          resolvedDest = pathResolve((0, fs_node_utils_1.pathDirname)(dest), resolvedDest);
        if (isDirectory(vol, src) && isSrcSubdir(resolvedSrc, resolvedDest))
          throw cpSystemError("ERR_FS_CP_EINVAL", "cannot copy " + resolvedSrc + " to a subdirectory of self " + resolvedDest, dest, 22, "EINVAL");
        if (statOf(vol, src, true).isDirectory() && isSrcSubdir(resolvedDest, resolvedSrc))
          throw cpSystemError("ERR_FS_CP_SYMLINK_TO_SUBDIRECTORY", "cannot overwrite " + resolvedDest + " with " + resolvedSrc, dest, 22, "EINVAL");
        vol.unlinkSync(dest);
        vol.symlinkSync(resolvedSrc, dest);
      };
    }
  });

  // node_modules/@jsonjoy.com/fs-node/lib/FsPromises.js
  var require_FsPromises = __commonJS({
    "node_modules/@jsonjoy.com/fs-node/lib/FsPromises.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.FsPromises = void 0;
      var util_1 = require_util3();
      var cp_1 = require_cp();
      var glob_1 = require_glob();
      var fs_node_utils_1 = require_lib2();
      var newAbortError = (signal) => {
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        error.code = "ABORT_ERR";
        error.cause = signal.reason;
        return error;
      };
      var FSWatchAsyncIterator = class {
        constructor(fs2, path2, options = {}) {
          this.fs = fs2;
          this.path = path2;
          this.options = options;
          this.eventQueue = [];
          this.resolveQueue = [];
          this.finished = false;
          this.maxQueue = options.maxQueue || 2048;
          const overflow = options.overflow || "ignore";
          if (overflow !== "ignore" && overflow !== "error" && overflow !== "throw")
            throw new TypeError(`The argument 'options.overflow' must be one of: 'ignore', 'error'. Received '${overflow}'`);
          this.overflow = overflow === "throw" ? "error" : overflow;
          const signal = options.signal;
          if (signal) {
            if (signal.aborted) {
              this.finish(newAbortError(signal));
              return;
            }
            this.onAbort = () => this.finish(newAbortError(signal));
            signal.addEventListener("abort", this.onAbort);
          }
          this.startWatching();
        }
        startWatching() {
          const { signal, ...watchOptions } = this.options;
          try {
            this.watcher = this.fs.watch(this.path, watchOptions, (eventType, filename) => {
              this.enqueueEvent({ eventType, filename });
            });
          } catch (error) {
            this.finish();
            throw error;
          }
        }
        enqueueEvent(event) {
          if (this.finished)
            return;
          if (this.eventQueue.length >= this.maxQueue) {
            if (this.overflow === "error") {
              const error = new Error(`Watch queue overflow: more than ${this.maxQueue} events queued`);
              error.code = "ERR_FS_WATCH_QUEUE_OVERFLOW";
              this.finish(error);
            } else if (typeof process !== "undefined" && typeof process.emitWarning === "function") {
              process.emitWarning("fs.watch maxQueue exceeded");
            }
            return;
          }
          this.eventQueue.push(event);
          if (this.resolveQueue.length > 0) {
            const { resolve: resolve2 } = this.resolveQueue.shift();
            const nextEvent = this.eventQueue.shift();
            resolve2({ value: nextEvent, done: false });
          }
        }
        finish(error) {
          if (this.finished)
            return;
          this.finished = true;
          this.error = error;
          if (error)
            this.eventQueue.length = 0;
          if (this.onAbort) {
            this.options.signal.removeEventListener("abort", this.onAbort);
            this.onAbort = void 0;
          }
          if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
          }
          const delivered = error && this.resolveQueue.length > 0;
          while (this.resolveQueue.length > 0) {
            const { resolve: resolve2, reject } = this.resolveQueue.shift();
            if (error) {
              reject(error);
            } else {
              resolve2({ value: void 0, done: true });
            }
          }
          if (delivered)
            this.error = void 0;
        }
        async next() {
          if (this.error) {
            const error = this.error;
            this.error = void 0;
            throw error;
          }
          if (this.finished) {
            return { value: void 0, done: true };
          }
          if (this.eventQueue.length > 0) {
            const event = this.eventQueue.shift();
            return { value: event, done: false };
          }
          return new Promise((resolve2, reject) => {
            this.resolveQueue.push({ resolve: resolve2, reject });
          });
        }
        async return() {
          this.finish();
          return { value: void 0, done: true };
        }
        async throw(error) {
          this.finish(error);
          throw error;
        }
        [Symbol.asyncIterator]() {
          return this;
        }
      };
      var FsPromises = class {
        constructor(fs2, FileHandle) {
          this.fs = fs2;
          this.FileHandle = FileHandle;
          this.constants = fs_node_utils_1.constants;
          this.cp = (src, dest, options) => new Promise((resolve2, reject) => {
            this.fs.cp(src, dest, (0, cp_1.getCpOptions)(options), (error) => error ? reject(error) : resolve2());
          });
          this.copyFile = (src, dest, mode) => new Promise((resolve2, reject) => {
            this.fs.copyFile(src, dest, mode, (error) => error ? reject(error) : resolve2());
          });
          this.opendir = (0, util_1.promisify)(this.fs, "opendir");
          this.statfs = (0, util_1.promisify)(this.fs, "statfs");
          this.lutimes = (0, util_1.promisify)(this.fs, "lutimes");
          this.glob = (pattern, options) => (0, glob_1.glob)(this.fs, pattern, options);
          this.access = (0, util_1.promisify)(this.fs, "access");
          this.chmod = (0, util_1.promisify)(this.fs, "chmod");
          this.chown = (0, util_1.promisify)(this.fs, "chown");
          this.lchmod = (0, util_1.promisify)(this.fs, "lchmod");
          this.lchown = (0, util_1.promisify)(this.fs, "lchown");
          this.link = (0, util_1.promisify)(this.fs, "link");
          this.lstat = (0, util_1.promisify)(this.fs, "lstat");
          this.mkdir = (0, util_1.promisify)(this.fs, "mkdir");
          this.mkdtemp = (0, util_1.promisify)(this.fs, "mkdtemp");
          this.readdir = (0, util_1.promisify)(this.fs, "readdir");
          this.readlink = (0, util_1.promisify)(this.fs, "readlink");
          this.realpath = (0, util_1.promisify)(this.fs, "realpath");
          this.rename = (0, util_1.promisify)(this.fs, "rename");
          this.rmdir = (0, util_1.promisify)(this.fs, "rmdir");
          this.rm = (0, util_1.promisify)(this.fs, "rm");
          this.stat = (0, util_1.promisify)(this.fs, "stat");
          this.symlink = (0, util_1.promisify)(this.fs, "symlink");
          this.truncate = (0, util_1.promisify)(this.fs, "truncate");
          this.unlink = (0, util_1.promisify)(this.fs, "unlink");
          this.utimes = (0, util_1.promisify)(this.fs, "utimes");
          this.readFile = (id, options) => {
            return (0, util_1.promisify)(this.fs, "readFile")(id instanceof this.FileHandle ? id.fd : id, options);
          };
          this.appendFile = (path2, data, options) => {
            return (0, util_1.promisify)(this.fs, "appendFile")(path2 instanceof this.FileHandle ? path2.fd : path2, data, options);
          };
          this.open = (path2, flags = "r", mode) => {
            return (0, util_1.promisify)(this.fs, "open", (fd) => new this.FileHandle(this.fs, fd))(path2, flags, mode);
          };
          this.writeFile = (id, data, options) => {
            const dataPromise = (0, util_1.isReadableStream)(data) ? (0, util_1.streamToBuffer)(data) : Promise.resolve(data);
            return dataPromise.then((data2) => (0, util_1.promisify)(this.fs, "writeFile")(id instanceof this.FileHandle ? id.fd : id, data2, options));
          };
          this.watch = (filename, options) => {
            const watchOptions = typeof options === "string" ? { encoding: options } : options || {};
            return new FSWatchAsyncIterator(this.fs, filename, watchOptions);
          };
        }
      };
      exports.FsPromises = FsPromises;
    }
  });

  // node_modules/tree-dump/lib/printTree.js
  var require_printTree = __commonJS({
    "node_modules/tree-dump/lib/printTree.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.printTree = void 0;
      var printTree = (tab = "", children) => {
        let str = "";
        let last = children.length - 1;
        for (; last >= 0; last--)
          if (children[last])
            break;
        for (let i = 0; i <= last; i++) {
          const fn = children[i];
          if (!fn)
            continue;
          const isLast = i === last;
          const child = fn(tab + (isLast ? " " : "\u2502") + "  ");
          const branch = child ? isLast ? "\u2514\u2500" : "\u251C\u2500" : "\u2502";
          str += "\n" + tab + branch + (child ? " " + child : "");
        }
        return str;
      };
      exports.printTree = printTree;
    }
  });

  // node_modules/tree-dump/lib/printBinary.js
  var require_printBinary = __commonJS({
    "node_modules/tree-dump/lib/printBinary.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.printBinary = void 0;
      var printBinary = (tab = "", children) => {
        const left = children[0], right = children[1];
        let str = "";
        if (left)
          str += "\n" + tab + "\u2190 " + left(tab + "  ");
        if (right)
          str += "\n" + tab + "\u2192 " + right(tab + "  ");
        return str;
      };
      exports.printBinary = printBinary;
    }
  });

  // node_modules/tree-dump/lib/printJson.js
  var require_printJson = __commonJS({
    "node_modules/tree-dump/lib/printJson.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.printJson = void 0;
      var printJson = (tab = "", json, space = 2) => (JSON.stringify(json, null, space) || "nil").split("\n").join("\n" + tab);
      exports.printJson = printJson;
    }
  });

  // node_modules/tree-dump/lib/index.js
  var require_lib5 = __commonJS({
    "node_modules/tree-dump/lib/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_printTree(), exports);
      tslib_1.__exportStar(require_printBinary(), exports);
      tslib_1.__exportStar(require_printJson(), exports);
    }
  });

  // node_modules/@jsonjoy.com/fs-print/lib/index.js
  var require_lib6 = __commonJS({
    "node_modules/@jsonjoy.com/fs-print/lib/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.toTreeSync = void 0;
      var tree_dump_1 = require_lib5();
      var fs_node_utils_1 = require_lib2();
      var toTreeSync = (fs2, opts = {}) => {
        const separator = opts.separator || "/";
        let dir = opts.dir || separator;
        if (dir[dir.length - 1] !== separator)
          dir += separator;
        const tab = opts.tab || "";
        const depth = opts.depth ?? 10;
        const sort = opts.sort ?? true;
        let subtree = " (...)";
        if (depth > 0) {
          const list2 = fs2.readdirSync(dir, { withFileTypes: true });
          if (sort) {
            list2.sort((a, b) => {
              if (a.isDirectory() && b.isDirectory()) {
                return a.name.toString().localeCompare(b.name.toString());
              } else if (a.isDirectory()) {
                return -1;
              } else if (b.isDirectory()) {
                return 1;
              } else {
                return a.name.toString().localeCompare(b.name.toString());
              }
            });
          }
          subtree = (0, tree_dump_1.printTree)(tab, list2.map((entry) => (tab2) => {
            if (entry.isDirectory()) {
              return (0, exports.toTreeSync)(fs2, { dir: dir + entry.name, depth: depth - 1, tab: tab2 });
            } else if (entry.isSymbolicLink()) {
              return "" + entry.name + " \u2192 " + fs2.readlinkSync(dir + entry.name);
            } else {
              return "" + entry.name;
            }
          }));
        }
        const base2 = (0, fs_node_utils_1.basename)(dir, separator) + separator;
        return base2 + subtree;
      };
      exports.toTreeSync = toTreeSync;
    }
  });

  // node_modules/@jsonjoy.com/fs-snapshot/lib/constants.js
  var require_constants3 = __commonJS({
    "node_modules/@jsonjoy.com/fs-snapshot/lib/constants.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
    }
  });

  // node_modules/@jsonjoy.com/buffers/lib/Slice.js
  var require_Slice = __commonJS({
    "node_modules/@jsonjoy.com/buffers/lib/Slice.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Slice = void 0;
      var Slice = class {
        constructor(uint8, view, start, end) {
          this.uint8 = uint8;
          this.view = view;
          this.start = start;
          this.end = end;
        }
        subarray() {
          return this.uint8.subarray(this.start, this.end);
        }
      };
      exports.Slice = Slice;
    }
  });

  // node_modules/@jsonjoy.com/buffers/lib/Writer.js
  var require_Writer = __commonJS({
    "node_modules/@jsonjoy.com/buffers/lib/Writer.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Writer = void 0;
      var Slice_1 = require_Slice();
      var EMPTY_UINT8 = new Uint8Array([]);
      var EMPTY_VIEW = new DataView(EMPTY_UINT8.buffer);
      var hasBuffer = typeof Buffer === "function";
      var utf8Write = hasBuffer ? Buffer.prototype.utf8Write : null;
      var from = hasBuffer ? Buffer.from : null;
      var textEncoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
      var Writer = class {
        /**
         * @param allocSize Number of bytes to allocate at a time when buffer ends.
         */
        constructor(allocSize = 64 * 1024) {
          this.allocSize = allocSize;
          this.view = EMPTY_VIEW;
          this.x0 = 0;
          this.x = 0;
          this.uint8 = new Uint8Array(allocSize);
          this.size = allocSize;
          this.view = new DataView(this.uint8.buffer);
        }
        /** @ignore */
        grow(size) {
          const x0 = this.x0;
          const x = this.x;
          const oldUint8 = this.uint8;
          const newUint8 = new Uint8Array(size);
          const view = new DataView(newUint8.buffer);
          const activeSlice = oldUint8.subarray(x0, x);
          newUint8.set(activeSlice, 0);
          this.x = x - x0;
          this.x0 = 0;
          this.uint8 = newUint8;
          this.size = size;
          this.view = view;
        }
        /**
         * Make sure the internal buffer has enough space to write the specified number
         * of bytes, otherwise resize the internal buffer to accommodate for more size.
         *
         * @param capacity Number of bytes.
         */
        ensureCapacity(capacity) {
          const byteLength2 = this.size;
          const remaining = byteLength2 - this.x;
          if (remaining < capacity) {
            const total = byteLength2 - this.x0;
            const required = capacity - remaining;
            const totalRequired = total + required;
            this.grow(totalRequired <= this.allocSize ? this.allocSize : totalRequired * 2);
          }
        }
        /** @todo Consider renaming to "skip"? */
        move(capacity) {
          this.ensureCapacity(capacity);
          this.x += capacity;
        }
        reset() {
          this.x0 = this.x;
        }
        /**
         * Allocates a new {@link ArrayBuffer}, useful when the underlying
         * {@link ArrayBuffer} cannot be shared between threads.
         *
         * @param size Size of memory to allocate.
         */
        newBuffer(size) {
          const uint8 = this.uint8 = new Uint8Array(size);
          this.size = size;
          this.view = new DataView(uint8.buffer);
          this.x = this.x0 = 0;
        }
        /**
         * @returns Encoded memory buffer contents.
         */
        flush() {
          const result = this.uint8.subarray(this.x0, this.x);
          this.x0 = this.x;
          return result;
        }
        flushSlice() {
          const slice = new Slice_1.Slice(this.uint8, this.view, this.x0, this.x);
          this.x0 = this.x;
          return slice;
        }
        u8(char) {
          this.ensureCapacity(1);
          this.uint8[this.x++] = char;
        }
        u16(word) {
          this.ensureCapacity(2);
          this.view.setUint16(this.x, word);
          this.x += 2;
        }
        u32(dword) {
          this.ensureCapacity(4);
          this.view.setUint32(this.x, dword);
          this.x += 4;
        }
        i32(dword) {
          this.ensureCapacity(4);
          this.view.setInt32(this.x, dword);
          this.x += 4;
        }
        u64(qword) {
          this.ensureCapacity(8);
          this.view.setBigUint64(this.x, BigInt(qword));
          this.x += 8;
        }
        f64(float) {
          this.ensureCapacity(8);
          this.view.setFloat64(this.x, float);
          this.x += 8;
        }
        u8u16(u8, u16) {
          this.ensureCapacity(3);
          let x = this.x;
          this.uint8[x++] = u8;
          this.uint8[x++] = u16 >>> 8;
          this.uint8[x++] = u16 & 255;
          this.x = x;
        }
        u8u32(u8, u32) {
          this.ensureCapacity(5);
          let x = this.x;
          this.uint8[x++] = u8;
          this.view.setUint32(x, u32);
          this.x = x + 4;
        }
        u8u64(u8, u64) {
          this.ensureCapacity(9);
          let x = this.x;
          this.uint8[x++] = u8;
          this.view.setBigUint64(x, BigInt(u64));
          this.x = x + 8;
        }
        u8f32(u8, f32) {
          this.ensureCapacity(5);
          let x = this.x;
          this.uint8[x++] = u8;
          this.view.setFloat32(x, f32);
          this.x = x + 4;
        }
        u8f64(u8, f64) {
          this.ensureCapacity(9);
          let x = this.x;
          this.uint8[x++] = u8;
          this.view.setFloat64(x, f64);
          this.x = x + 8;
        }
        buf(buf, length) {
          this.ensureCapacity(length);
          const x = this.x;
          this.uint8.set(buf, x);
          this.x = x + length;
        }
        /**
         * Encodes string as UTF-8. You need to call .ensureCapacity(str.length * 4)
         * before calling
         *
         * @param str String to encode as UTF-8.
         * @returns The number of bytes written
         */
        utf8(str) {
          const theoreticalMaxLength = str.length * 4;
          if (theoreticalMaxLength < 168)
            return this.utf8Native(str);
          this.ensureCapacity(theoreticalMaxLength);
          const maxLength = this.size - this.x;
          if (utf8Write) {
            const writeLength = utf8Write.call(this.uint8, str, this.x, maxLength);
            this.x += writeLength;
            return writeLength;
          } else if (from) {
            const uint8 = this.uint8;
            const offset = uint8.byteOffset + this.x;
            const buf = from(uint8.buffer).subarray(offset, offset + maxLength);
            const writeLength = buf.write(str, 0, maxLength, "utf8");
            this.x += writeLength;
            return writeLength;
          } else if (theoreticalMaxLength > 1024 && textEncoder) {
            const writeLength = textEncoder.encodeInto(str, this.uint8.subarray(this.x, this.x + maxLength)).written;
            this.x += writeLength;
            return writeLength;
          }
          return this.utf8Native(str);
        }
        utf8Native(str) {
          const length = str.length;
          const uint8 = this.uint8;
          let offset = this.x;
          let pos = 0;
          while (pos < length) {
            let value = str.charCodeAt(pos++);
            if ((value & 4294967168) === 0) {
              uint8[offset++] = value;
              continue;
            } else if ((value & 4294965248) === 0) {
              uint8[offset++] = value >> 6 & 31 | 192;
            } else {
              if (value >= 55296 && value <= 56319) {
                if (pos < length) {
                  const extra = str.charCodeAt(pos);
                  if ((extra & 64512) === 56320) {
                    pos++;
                    value = ((value & 1023) << 10) + (extra & 1023) + 65536;
                  }
                }
              }
              if ((value & 4294901760) === 0) {
                uint8[offset++] = value >> 12 & 15 | 224;
                uint8[offset++] = value >> 6 & 63 | 128;
              } else {
                uint8[offset++] = value >> 18 & 7 | 240;
                uint8[offset++] = value >> 12 & 63 | 128;
                uint8[offset++] = value >> 6 & 63 | 128;
              }
            }
            uint8[offset++] = value & 63 | 128;
          }
          const writeLength = offset - this.x;
          this.x = offset;
          return writeLength;
        }
        ascii(str) {
          const length = str.length;
          this.ensureCapacity(length);
          const uint8 = this.uint8;
          let x = this.x;
          let pos = 0;
          while (pos < length)
            uint8[x++] = str.charCodeAt(pos++);
          this.x = x;
        }
      };
      exports.Writer = Writer;
    }
  });

  // node_modules/@jsonjoy.com/fs-snapshot/lib/shared.js
  var require_shared = __commonJS({
    "node_modules/@jsonjoy.com/fs-snapshot/lib/shared.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.validateEntryName = exports.writer = void 0;
      var Writer_1 = require_Writer();
      exports.writer = new Writer_1.Writer(1024 * 32);
      var validateEntryName = (name) => {
        if (!name || name === "." || name === ".." || name.indexOf("/") !== -1 || name.indexOf("\\") !== -1)
          throw new Error(`Invalid snapshot entry name: ${JSON.stringify(name)}`);
      };
      exports.validateEntryName = validateEntryName;
    }
  });

  // node_modules/@jsonjoy.com/fs-snapshot/lib/sync.js
  var require_sync = __commonJS({
    "node_modules/@jsonjoy.com/fs-snapshot/lib/sync.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.fromSnapshotSync = exports.toSnapshotSync = void 0;
      var shared_1 = require_shared();
      var toSnapshotSync = ({ fs: fs2, path: path2 = "/", separator = "/" }) => {
        const stats = fs2.lstatSync(path2);
        if (stats.isDirectory()) {
          const list2 = fs2.readdirSync(path2);
          const entries = {};
          const dir = path2.endsWith(separator) ? path2 : path2 + separator;
          for (const child of list2) {
            const childSnapshot = (0, exports.toSnapshotSync)({ fs: fs2, path: `${dir}${child}`, separator });
            if (childSnapshot)
              entries["" + child] = childSnapshot;
          }
          return [0, {}, entries];
        } else if (stats.isFile()) {
          const buf = fs2.readFileSync(path2);
          const uint8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
          return [1, {}, uint8];
        } else if (stats.isSymbolicLink()) {
          return [
            2,
            {
              target: fs2.readlinkSync(path2).toString()
            }
          ];
        }
        return null;
      };
      exports.toSnapshotSync = toSnapshotSync;
      var fromSnapshotSync = (snapshot, { fs: fs2, path: path2 = "/", separator = "/" }) => {
        if (!snapshot)
          return;
        switch (snapshot[0]) {
          case 0: {
            if (!path2.endsWith(separator))
              path2 = path2 + separator;
            const [, , entries] = snapshot;
            fs2.mkdirSync(path2, { recursive: true });
            for (const [name, child] of Object.entries(entries)) {
              (0, shared_1.validateEntryName)(name);
              (0, exports.fromSnapshotSync)(child, { fs: fs2, path: `${path2}${name}`, separator });
            }
            break;
          }
          case 1: {
            const [, , data] = snapshot;
            fs2.writeFileSync(path2, data);
            break;
          }
          case 2: {
            const [, { target }] = snapshot;
            fs2.symlinkSync(target, path2);
            break;
          }
        }
      };
      exports.fromSnapshotSync = fromSnapshotSync;
    }
  });

  // node_modules/@jsonjoy.com/buffers/lib/isFloat32.js
  var require_isFloat32 = __commonJS({
    "node_modules/@jsonjoy.com/buffers/lib/isFloat32.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.isFloat32 = void 0;
      var view = new DataView(new ArrayBuffer(4));
      var isFloat32 = (n) => {
        view.setFloat32(0, n);
        return n === view.getFloat32(0);
      };
      exports.isFloat32 = isFloat32;
    }
  });

  // node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/json-pack/lib/JsonPackExtension.js
  var require_JsonPackExtension = __commonJS({
    "node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/json-pack/lib/JsonPackExtension.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.JsonPackExtension = void 0;
      var JsonPackExtension = class {
        constructor(tag, val) {
          this.tag = tag;
          this.val = val;
        }
      };
      exports.JsonPackExtension = JsonPackExtension;
    }
  });

  // node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/json-pack/lib/cbor/CborEncoderFast.js
  var require_CborEncoderFast = __commonJS({
    "node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/json-pack/lib/cbor/CborEncoderFast.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.CborEncoderFast = void 0;
      var Writer_1 = require_Writer();
      var isSafeInteger = Number.isSafeInteger;
      var CborEncoderFast = class {
        constructor(writer = new Writer_1.Writer()) {
          this.writer = writer;
        }
        encode(value) {
          this.writeAny(value);
          return this.writer.flush();
        }
        writeAny(value) {
          switch (typeof value) {
            case "number":
              return this.writeNumber(value);
            case "string":
              return this.writeStr(value);
            case "boolean":
              return this.writer.u8(244 + +value);
            case "object": {
              if (!value)
                return this.writer.u8(246);
              const constr = value.constructor;
              switch (constr) {
                case Array:
                  return this.writeArr(value);
                default:
                  return this.writeObj(value);
              }
            }
          }
        }
        writeCbor() {
          this.writer.u8u16(217, 55799);
        }
        writeEnd() {
          this.writer.u8(
            255
            /* CONST.END */
          );
        }
        writeNull() {
          this.writer.u8(246);
        }
        writeBoolean(bool) {
          if (bool)
            this.writer.u8(245);
          else
            this.writer.u8(244);
        }
        writeNumber(num) {
          if (isSafeInteger(num))
            this.writeInteger(num);
          else if (typeof num === "bigint")
            this.writeBigInt(num);
          else
            this.writeFloat(num);
        }
        writeBigInt(int) {
          if (int >= 0)
            this.writeBigUint(int);
          else
            this.writeBigSint(int);
        }
        writeBigUint(uint) {
          if (uint <= Number.MAX_SAFE_INTEGER)
            return this.writeUInteger(Number(uint));
          this.writer.u8u64(27, uint);
        }
        writeBigSint(int) {
          if (int >= Number.MIN_SAFE_INTEGER)
            return this.encodeNint(Number(int));
          const uint = -BigInt(1) - int;
          this.writer.u8u64(59, uint);
        }
        writeInteger(int) {
          if (int >= 0)
            this.writeUInteger(int);
          else
            this.encodeNint(int);
        }
        writeUInteger(uint) {
          const writer = this.writer;
          writer.ensureCapacity(9);
          const uint8 = writer.uint8;
          let x = writer.x;
          if (uint <= 23) {
            uint8[x++] = 0 + uint;
          } else if (uint <= 255) {
            uint8[x++] = 24;
            uint8[x++] = uint;
          } else if (uint <= 65535) {
            uint8[x++] = 25;
            writer.view.setUint16(x, uint);
            x += 2;
          } else if (uint <= 4294967295) {
            uint8[x++] = 26;
            writer.view.setUint32(x, uint);
            x += 4;
          } else {
            uint8[x++] = 27;
            writer.view.setBigUint64(x, BigInt(uint));
            x += 8;
          }
          writer.x = x;
        }
        /** @deprecated Remove and use `writeNumber` instead. */
        encodeNumber(num) {
          this.writeNumber(num);
        }
        /** @deprecated Remove and use `writeInteger` instead. */
        encodeInteger(int) {
          this.writeInteger(int);
        }
        /** @deprecated */
        encodeUint(uint) {
          this.writeUInteger(uint);
        }
        encodeNint(int) {
          const uint = -1 - int;
          const writer = this.writer;
          writer.ensureCapacity(9);
          const uint8 = writer.uint8;
          let x = writer.x;
          if (uint < 24) {
            uint8[x++] = 32 + uint;
          } else if (uint <= 255) {
            uint8[x++] = 56;
            uint8[x++] = uint;
          } else if (uint <= 65535) {
            uint8[x++] = 57;
            writer.view.setUint16(x, uint);
            x += 2;
          } else if (uint <= 4294967295) {
            uint8[x++] = 58;
            writer.view.setUint32(x, uint);
            x += 4;
          } else {
            uint8[x++] = 59;
            writer.view.setBigUint64(x, BigInt(uint));
            x += 8;
          }
          writer.x = x;
        }
        writeFloat(float) {
          this.writer.u8f64(251, float);
        }
        writeBin(buf) {
          const length = buf.length;
          this.writeBinHdr(length);
          this.writer.buf(buf, length);
        }
        writeBinHdr(length) {
          const writer = this.writer;
          if (length <= 23)
            writer.u8(64 + length);
          else if (length <= 255)
            writer.u16((88 << 8) + length);
          else if (length <= 65535)
            writer.u8u16(89, length);
          else if (length <= 4294967295)
            writer.u8u32(90, length);
          else
            writer.u8u64(91, length);
        }
        writeStr(str) {
          const writer = this.writer;
          const length = str.length;
          const maxSize = length * 4;
          writer.ensureCapacity(5 + maxSize);
          const uint8 = writer.uint8;
          let lengthOffset = writer.x;
          if (maxSize <= 23)
            writer.x++;
          else if (maxSize <= 255) {
            uint8[writer.x++] = 120;
            lengthOffset = writer.x;
            writer.x++;
          } else if (maxSize <= 65535) {
            uint8[writer.x++] = 121;
            lengthOffset = writer.x;
            writer.x += 2;
          } else {
            uint8[writer.x++] = 122;
            lengthOffset = writer.x;
            writer.x += 4;
          }
          const bytesWritten = writer.utf8(str);
          if (maxSize <= 23)
            uint8[lengthOffset] = 96 + bytesWritten;
          else if (maxSize <= 255)
            uint8[lengthOffset] = bytesWritten;
          else if (maxSize <= 65535)
            writer.view.setUint16(lengthOffset, bytesWritten);
          else
            writer.view.setUint32(lengthOffset, bytesWritten);
        }
        writeStrHdr(length) {
          const writer = this.writer;
          if (length <= 23)
            writer.u8(96 + length);
          else if (length <= 255)
            writer.u16((120 << 8) + length);
          else if (length <= 65535)
            writer.u8u16(121, length);
          else
            writer.u8u32(122, length);
        }
        writeAsciiStr(str) {
          this.writeStrHdr(str.length);
          this.writer.ascii(str);
        }
        writeArr(arr) {
          const length = arr.length;
          this.writeArrHdr(length);
          for (let i = 0; i < length; i++)
            this.writeAny(arr[i]);
        }
        writeArrHdr(length) {
          const writer = this.writer;
          if (length <= 23)
            writer.u8(128 + length);
          else if (length <= 255)
            writer.u16((152 << 8) + length);
          else if (length <= 65535)
            writer.u8u16(153, length);
          else if (length <= 4294967295)
            writer.u8u32(154, length);
          else
            writer.u8u64(155, length);
        }
        writeObj(obj) {
          const keys = Object.keys(obj);
          const length = keys.length;
          this.writeObjHdr(length);
          for (let i = 0; i < length; i++) {
            const key = keys[i];
            this.writeStr(key);
            this.writeAny(obj[key]);
          }
        }
        writeObjHdr(length) {
          const writer = this.writer;
          if (length <= 23)
            writer.u8(160 + length);
          else if (length <= 255)
            writer.u16((184 << 8) + length);
          else if (length <= 65535)
            writer.u8u16(185, length);
          else if (length <= 4294967295)
            writer.u8u32(186, length);
          else
            writer.u8u64(187, length);
        }
        writeMapHdr(length) {
          this.writeObjHdr(length);
        }
        writeStartMap() {
          this.writer.u8(191);
        }
        writeTag(tag, value) {
          this.writeTagHdr(tag);
          this.writeAny(value);
        }
        writeTagHdr(tag) {
          const writer = this.writer;
          if (tag <= 23)
            writer.u8(192 + tag);
          else if (tag <= 255)
            writer.u16((216 << 8) + tag);
          else if (tag <= 65535)
            writer.u8u16(217, tag);
          else if (tag <= 4294967295)
            writer.u8u32(218, tag);
          else
            writer.u8u64(219, tag);
        }
        writeTkn(value) {
          const writer = this.writer;
          if (value <= 23)
            writer.u8(224 + value);
          else if (value <= 255)
            writer.u16((248 << 8) + value);
        }
        // ------------------------------------------------------- Streaming encoding
        writeStartStr() {
          this.writer.u8(127);
        }
        writeStrChunk(str) {
          throw new Error("Not implemented");
        }
        writeEndStr() {
          throw new Error("Not implemented");
        }
        writeStartBin() {
          this.writer.u8(95);
        }
        writeBinChunk(buf) {
          throw new Error("Not implemented");
        }
        writeEndBin() {
          throw new Error("Not implemented");
        }
        writeStartArr() {
          this.writer.u8(159);
        }
        writeArrChunk(item) {
          throw new Error("Not implemented");
        }
        writeEndArr() {
          this.writer.u8(
            255
            /* CONST.END */
          );
        }
        writeStartObj() {
          this.writer.u8(191);
        }
        writeObjChunk(key, value) {
          throw new Error("Not implemented");
        }
        writeEndObj() {
          this.writer.u8(
            255
            /* CONST.END */
          );
        }
      };
      exports.CborEncoderFast = CborEncoderFast;
    }
  });

  // node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/json-pack/lib/JsonPackValue.js
  var require_JsonPackValue = __commonJS({
    "node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/json-pack/lib/JsonPackValue.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.JsonPackValue = void 0;
      var JsonPackValue = class {
        constructor(val) {
          this.val = val;
        }
      };
      exports.JsonPackValue = JsonPackValue;
    }
  });

  // node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/json-pack/lib/cbor/CborEncoder.js
  var require_CborEncoder = __commonJS({
    "node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/json-pack/lib/cbor/CborEncoder.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.CborEncoder = void 0;
      var isFloat32_1 = require_isFloat32();
      var JsonPackExtension_1 = require_JsonPackExtension();
      var CborEncoderFast_1 = require_CborEncoderFast();
      var JsonPackValue_1 = require_JsonPackValue();
      var CborEncoder = class extends CborEncoderFast_1.CborEncoderFast {
        /**
         * Called when the encoder encounters a value that it does not know how to encode.
         *
         * @param value Some JavaScript value.
         */
        writeUnknown(value) {
          this.writeNull();
        }
        writeAny(value) {
          switch (typeof value) {
            case "number":
              return this.writeNumber(value);
            case "string":
              return this.writeStr(value);
            case "boolean":
              return this.writer.u8(244 + +value);
            case "object": {
              if (!value)
                return this.writer.u8(246);
              const constr = value.constructor;
              switch (constr) {
                case Object:
                  return this.writeObj(value);
                case Array:
                  return this.writeArr(value);
                case Uint8Array:
                  return this.writeBin(value);
                case Map:
                  return this.writeMap(value);
                case JsonPackExtension_1.JsonPackExtension:
                  return this.writeTag(value.tag, value.val);
                case JsonPackValue_1.JsonPackValue: {
                  const buf = value.val;
                  return this.writer.buf(buf, buf.length);
                }
                default:
                  if (value instanceof Uint8Array)
                    return this.writeBin(value);
                  if (Array.isArray(value))
                    return this.writeArr(value);
                  if (value instanceof Map)
                    return this.writeMap(value);
                  return this.writeUnknown(value);
              }
            }
            case "undefined":
              return this.writeUndef();
            case "bigint":
              return this.writeBigInt(value);
            default:
              return this.writeUnknown(value);
          }
        }
        writeFloat(float) {
          if ((0, isFloat32_1.isFloat32)(float))
            this.writer.u8f32(250, float);
          else
            this.writer.u8f64(251, float);
        }
        writeMap(map) {
          this.writeMapHdr(map.size);
          map.forEach((value, key) => {
            this.writeAny(key);
            this.writeAny(value);
          });
        }
        writeUndef() {
          this.writer.u8(247);
        }
      };
      exports.CborEncoder = CborEncoder;
    }
  });

  // node_modules/@jsonjoy.com/buffers/lib/f16.js
  var require_f16 = __commonJS({
    "node_modules/@jsonjoy.com/buffers/lib/f16.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.decodeF16 = void 0;
      var pow = Math.pow;
      var decodeF16 = (binary) => {
        const exponent = (binary & 31744) >> 10;
        const fraction = binary & 1023;
        return (binary >> 15 ? -1 : 1) * (exponent ? exponent === 31 ? fraction ? NaN : Infinity : pow(2, exponent - 15) * (1 + fraction / 1024) : 6103515625e-14 * (fraction / 1024));
      };
      exports.decodeF16 = decodeF16;
    }
  });

  // node_modules/@jsonjoy.com/buffers/lib/utf8/decodeAscii.js
  var require_decodeAscii = __commonJS({
    "node_modules/@jsonjoy.com/buffers/lib/utf8/decodeAscii.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.decodeAsciiMax15 = exports.decodeAscii = void 0;
      var fromCharCode = String.fromCharCode;
      var decodeAscii = (src, position, length) => {
        const bytes = [];
        for (let i = 0; i < length; i++) {
          const byte = src[position++];
          if (byte & 128)
            return;
          bytes.push(byte);
        }
        return fromCharCode.apply(String, bytes);
      };
      exports.decodeAscii = decodeAscii;
      var decodeAsciiMax15 = (src, position, length) => {
        if (length < 4) {
          if (length < 2) {
            if (length === 0)
              return "";
            else {
              const a = src[position++];
              if ((a & 128) > 1) {
                position -= 1;
                return;
              }
              return fromCharCode(a);
            }
          } else {
            const a = src[position++];
            const b = src[position++];
            if ((a & 128) > 0 || (b & 128) > 0) {
              position -= 2;
              return;
            }
            if (length < 3)
              return fromCharCode(a, b);
            const c = src[position++];
            if ((c & 128) > 0) {
              position -= 3;
              return;
            }
            return fromCharCode(a, b, c);
          }
        } else {
          const a = src[position++];
          const b = src[position++];
          const c = src[position++];
          const d = src[position++];
          if ((a & 128) > 0 || (b & 128) > 0 || (c & 128) > 0 || (d & 128) > 0) {
            position -= 4;
            return;
          }
          if (length < 6) {
            if (length === 4)
              return fromCharCode(a, b, c, d);
            else {
              const e = src[position++];
              if ((e & 128) > 0) {
                position -= 5;
                return;
              }
              return fromCharCode(a, b, c, d, e);
            }
          } else if (length < 8) {
            const e = src[position++];
            const f = src[position++];
            if ((e & 128) > 0 || (f & 128) > 0) {
              position -= 6;
              return;
            }
            if (length < 7)
              return fromCharCode(a, b, c, d, e, f);
            const g = src[position++];
            if ((g & 128) > 0) {
              position -= 7;
              return;
            }
            return fromCharCode(a, b, c, d, e, f, g);
          } else {
            const e = src[position++];
            const f = src[position++];
            const g = src[position++];
            const h = src[position++];
            if ((e & 128) > 0 || (f & 128) > 0 || (g & 128) > 0 || (h & 128) > 0) {
              position -= 8;
              return;
            }
            if (length < 10) {
              if (length === 8)
                return fromCharCode(a, b, c, d, e, f, g, h);
              else {
                const i = src[position++];
                if ((i & 128) > 0) {
                  position -= 9;
                  return;
                }
                return fromCharCode(a, b, c, d, e, f, g, h, i);
              }
            } else if (length < 12) {
              const i = src[position++];
              const j = src[position++];
              if ((i & 128) > 0 || (j & 128) > 0) {
                position -= 10;
                return;
              }
              if (length < 11)
                return fromCharCode(a, b, c, d, e, f, g, h, i, j);
              const k = src[position++];
              if ((k & 128) > 0) {
                position -= 11;
                return;
              }
              return fromCharCode(a, b, c, d, e, f, g, h, i, j, k);
            } else {
              const i = src[position++];
              const j = src[position++];
              const k = src[position++];
              const l = src[position++];
              if ((i & 128) > 0 || (j & 128) > 0 || (k & 128) > 0 || (l & 128) > 0) {
                position -= 12;
                return;
              }
              if (length < 14) {
                if (length === 12)
                  return fromCharCode(a, b, c, d, e, f, g, h, i, j, k, l);
                else {
                  const m = src[position++];
                  if ((m & 128) > 0) {
                    position -= 13;
                    return;
                  }
                  return fromCharCode(a, b, c, d, e, f, g, h, i, j, k, l, m);
                }
              } else {
                const m = src[position++];
                const n = src[position++];
                if ((m & 128) > 0 || (n & 128) > 0) {
                  position -= 14;
                  return;
                }
                if (length < 15)
                  return fromCharCode(a, b, c, d, e, f, g, h, i, j, k, l, m, n);
                const o = src[position++];
                if ((o & 128) > 0) {
                  position -= 15;
                  return;
                }
                return fromCharCode(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o);
              }
            }
          }
        }
      };
      exports.decodeAsciiMax15 = decodeAsciiMax15;
    }
  });

  // node_modules/@jsonjoy.com/buffers/lib/utf8/decodeUtf8/v18.js
  var require_v18 = __commonJS({
    "node_modules/@jsonjoy.com/buffers/lib/utf8/decodeUtf8/v18.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var fromCharCode = String.fromCharCode;
      exports.default = (buf, start, length) => {
        let offset = start;
        const end = offset + length;
        const points = [];
        while (offset < end) {
          let code = buf[offset++];
          if ((code & 128) !== 0) {
            const octet2 = buf[offset++] & 63;
            if ((code & 224) === 192) {
              code = (code & 31) << 6 | octet2;
            } else {
              const octet3 = buf[offset++] & 63;
              if ((code & 240) === 224) {
                code = (code & 31) << 12 | octet2 << 6 | octet3;
              } else {
                if ((code & 248) === 240) {
                  const octet4 = buf[offset++] & 63;
                  let unit = (code & 7) << 18 | octet2 << 12 | octet3 << 6 | octet4;
                  if (unit > 65535) {
                    unit -= 65536;
                    const unit0 = unit >>> 10 & 1023 | 55296;
                    code = 56320 | unit & 1023;
                    points.push(unit0);
                  } else {
                    code = unit;
                  }
                }
              }
            }
          }
          points.push(code);
        }
        return fromCharCode.apply(String, points);
      };
    }
  });

  // node_modules/@jsonjoy.com/buffers/lib/utf8/decodeUtf8/v16.js
  var require_v16 = __commonJS({
    "node_modules/@jsonjoy.com/buffers/lib/utf8/decodeUtf8/v16.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      var decodeAscii_1 = require_decodeAscii();
      var v18_1 = tslib_1.__importDefault(require_v18());
      var hasBuffer = typeof Buffer !== "undefined";
      var utf8Slice = hasBuffer ? Buffer.prototype.utf8Slice : null;
      var from = hasBuffer ? Buffer.from : null;
      var shortDecoder = (buf, start, length) => (0, decodeAscii_1.decodeAsciiMax15)(buf, start, length) ?? (0, v18_1.default)(buf, start, length);
      var midDecoder = (buf, start, length) => (0, decodeAscii_1.decodeAscii)(buf, start, length) ?? (0, v18_1.default)(buf, start, length);
      var longDecoder = utf8Slice ? (buf, start, length) => utf8Slice.call(buf, start, start + length) : from ? (buf, start, length) => from(buf).subarray(start, start + length).toString("utf8") : v18_1.default;
      var decoder = (buf, start, length) => {
        if (length < 16)
          return shortDecoder(buf, start, length);
        if (length < 32)
          return midDecoder(buf, start, length);
        return longDecoder(buf, start, length);
      };
      exports.default = decoder;
    }
  });

  // node_modules/@jsonjoy.com/buffers/lib/utf8/decodeUtf8/index.js
  var require_decodeUtf8 = __commonJS({
    "node_modules/@jsonjoy.com/buffers/lib/utf8/decodeUtf8/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.decodeUtf8 = void 0;
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      var v16_1 = tslib_1.__importDefault(require_v16());
      exports.decodeUtf8 = v16_1.default;
    }
  });

  // node_modules/@jsonjoy.com/buffers/lib/Reader.js
  var require_Reader = __commonJS({
    "node_modules/@jsonjoy.com/buffers/lib/Reader.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Reader = void 0;
      var decodeUtf8_1 = require_decodeUtf8();
      var Reader = class _Reader {
        constructor(uint8 = new Uint8Array([]), view = new DataView(uint8.buffer, uint8.byteOffset, uint8.length), x = 0, end = uint8.length) {
          this.uint8 = uint8;
          this.view = view;
          this.x = x;
          this.end = end;
        }
        reset(uint8) {
          this.x = 0;
          this.uint8 = uint8;
          this.view = new DataView(uint8.buffer, uint8.byteOffset, uint8.length);
        }
        size() {
          return this.end - this.x;
        }
        /**
         * Get current byte value without advancing the cursor.
         */
        peek() {
          return this.view.getUint8(this.x);
        }
        /**
         * @deprecated Use peek() instead.
         */
        peak() {
          return this.peek();
        }
        skip(length) {
          this.x += length;
        }
        buf(size = this.size()) {
          const x = this.x;
          const end = x + size;
          const bin = this.uint8.subarray(x, end);
          this.x = end;
          return bin;
        }
        subarray(start = 0, end) {
          const x = this.x;
          const actualStart = x + start;
          const actualEnd = typeof end === "number" ? x + end : this.end;
          return this.uint8.subarray(actualStart, actualEnd);
        }
        /**
         * Creates a new {@link Reader} that references the same underlying memory
         * buffer. But with independent cursor and end.
         *
         * Preferred over {@link buf} since it also provides a DataView and is much
         * faster to allocate a new {@link Slice} than a new {@link Uint8Array}.
         *
         * @param start Start offset relative to the current cursor position.
         * @param end End offset relative to the current cursor position.
         * @returns A new {@link Reader} instance.
         */
        slice(start = 0, end) {
          const x = this.x;
          const actualStart = x + start;
          const actualEnd = typeof end === "number" ? x + end : this.end;
          return new _Reader(this.uint8, this.view, actualStart, actualEnd);
        }
        /**
         * Similar to {@link slice} but also advances the cursor. Returns a new
         * {@link Reader} that references the same underlying memory buffer, starting
         * from the current cursor position.
         *
         * @param size Number of bytes to cut from the current position.
         * @returns A new {@link Reader} instance.
         */
        cut(size = this.size()) {
          const slice = this.slice(0, size);
          this.skip(size);
          return slice;
        }
        u8() {
          return this.uint8[this.x++];
        }
        i8() {
          return this.view.getInt8(this.x++);
        }
        u16() {
          let x = this.x;
          const num = (this.uint8[x++] << 8) + this.uint8[x++];
          this.x = x;
          return num;
        }
        i16() {
          const num = this.view.getInt16(this.x);
          this.x += 2;
          return num;
        }
        u32() {
          const num = this.view.getUint32(this.x);
          this.x += 4;
          return num;
        }
        i32() {
          const num = this.view.getInt32(this.x);
          this.x += 4;
          return num;
        }
        u64() {
          const num = this.view.getBigUint64(this.x);
          this.x += 8;
          return num;
        }
        i64() {
          const num = this.view.getBigInt64(this.x);
          this.x += 8;
          return num;
        }
        f32() {
          const pos = this.x;
          this.x += 4;
          return this.view.getFloat32(pos);
        }
        f64() {
          const pos = this.x;
          this.x += 8;
          return this.view.getFloat64(pos);
        }
        utf8(size) {
          const start = this.x;
          this.x += size;
          return (0, decodeUtf8_1.decodeUtf8)(this.uint8, start, size);
        }
        ascii(length) {
          const uint8 = this.uint8;
          let str = "";
          const end = this.x + length;
          for (let i = this.x; i < end; i++)
            str += String.fromCharCode(uint8[i]);
          this.x = end;
          return str;
        }
      };
      exports.Reader = Reader;
    }
  });

  // node_modules/@jsonjoy.com/buffers/lib/utf8/decodeUtf8/v10.js
  var require_v10 = __commonJS({
    "node_modules/@jsonjoy.com/buffers/lib/utf8/decodeUtf8/v10.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var fromCharCode = String.fromCharCode;
      exports.default = (buf, start, length) => {
        let offset = start;
        const end = offset + length;
        let str = "";
        while (offset < end) {
          const octet1 = buf[offset++];
          if ((octet1 & 128) === 0) {
            str += fromCharCode(octet1);
            continue;
          }
          const octet2 = buf[offset++] & 63;
          if ((octet1 & 224) === 192) {
            str += fromCharCode((octet1 & 31) << 6 | octet2);
            continue;
          }
          const octet3 = buf[offset++] & 63;
          if ((octet1 & 240) === 224) {
            str += fromCharCode((octet1 & 31) << 12 | octet2 << 6 | octet3);
            continue;
          }
          if ((octet1 & 248) === 240) {
            const octet4 = buf[offset++] & 63;
            let unit = (octet1 & 7) << 18 | octet2 << 12 | octet3 << 6 | octet4;
            if (unit > 65535) {
              unit -= 65536;
              const unit0 = unit >>> 10 & 1023 | 55296;
              unit = 56320 | unit & 1023;
              str += fromCharCode(unit0, unit);
            } else {
              str += fromCharCode(unit);
            }
          } else {
            str += fromCharCode(octet1);
          }
        }
        return str;
      };
    }
  });

  // node_modules/@jsonjoy.com/buffers/lib/utf8/CachedUtf8Decoder.js
  var require_CachedUtf8Decoder = __commonJS({
    "node_modules/@jsonjoy.com/buffers/lib/utf8/CachedUtf8Decoder.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.CachedUtf8Decoder = void 0;
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      var v10_1 = tslib_1.__importDefault(require_v10());
      var x = 1 + Math.round(Math.random() * ((-1 >>> 0) - 1));
      function randomU32(min, max) {
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        return (x >>> 0) % (max - min + 1) + min;
      }
      var CacheItem = class {
        constructor(bytes, value) {
          this.bytes = bytes;
          this.value = value;
        }
      };
      var CachedUtf8Decoder = class {
        constructor() {
          this.caches = [];
          for (let i = 0; i < 31; i++)
            this.caches.push([]);
        }
        get(bytes, offset, size) {
          const records = this.caches[size - 1];
          const len = records.length;
          FIND_CHUNK: for (let i = 0; i < len; i++) {
            const record = records[i];
            const recordBytes = record.bytes;
            for (let j = 0; j < size; j++)
              if (recordBytes[j] !== bytes[offset + j])
                continue FIND_CHUNK;
            return record.value;
          }
          return null;
        }
        store(bytes, value) {
          const records = this.caches[bytes.length - 1];
          const record = new CacheItem(bytes, value);
          const length = records.length;
          if (length >= 16)
            records[randomU32(0, 16 - 1)] = record;
          else
            records.push(record);
        }
        decode(bytes, offset, size) {
          if (!size)
            return "";
          const cachedValue = this.get(bytes, offset, size);
          if (cachedValue !== null)
            return cachedValue;
          const value = (0, v10_1.default)(bytes, offset, size);
          const copy = Uint8Array.prototype.slice.call(bytes, offset, offset + size);
          this.store(copy, value);
          return value;
        }
      };
      exports.CachedUtf8Decoder = CachedUtf8Decoder;
    }
  });

  // node_modules/@jsonjoy.com/buffers/lib/utf8/sharedCachedUtf8Decoder.js
  var require_sharedCachedUtf8Decoder = __commonJS({
    "node_modules/@jsonjoy.com/buffers/lib/utf8/sharedCachedUtf8Decoder.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var CachedUtf8Decoder_1 = require_CachedUtf8Decoder();
      exports.default = new CachedUtf8Decoder_1.CachedUtf8Decoder();
    }
  });

  // node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/json-pack/lib/cbor/CborDecoderBase.js
  var require_CborDecoderBase = __commonJS({
    "node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/json-pack/lib/cbor/CborDecoderBase.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.CborDecoderBase = void 0;
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      var f16_1 = require_f16();
      var JsonPackExtension_1 = require_JsonPackExtension();
      var JsonPackValue_1 = require_JsonPackValue();
      var Reader_1 = require_Reader();
      var sharedCachedUtf8Decoder_1 = tslib_1.__importDefault(require_sharedCachedUtf8Decoder());
      var CborDecoderBase = class {
        constructor(reader = new Reader_1.Reader(), keyDecoder = sharedCachedUtf8Decoder_1.default) {
          this.reader = reader;
          this.keyDecoder = keyDecoder;
        }
        read(uint8) {
          this.reader.reset(uint8);
          return this.readAny();
        }
        decode(uint8) {
          this.reader.reset(uint8);
          return this.readAny();
        }
        // -------------------------------------------------------- Any value reading
        val() {
          return this.readAny();
        }
        readAny() {
          const reader = this.reader;
          const octet = reader.u8();
          const major = octet >> 5;
          const minor = octet & 31;
          if (major < 4) {
            if (major < 2)
              return major === 0 ? this.readUint(minor) : this.readNint(minor);
            else
              return major === 2 ? this.readBin(minor) : this.readStr(minor);
          } else {
            if (major < 6)
              return major === 4 ? this.readArr(minor) : this.readObj(minor);
            else
              return major === 6 ? this.readTag(minor) : this.readTkn(minor);
          }
        }
        readAnyRaw(octet) {
          const major = octet >> 5;
          const minor = octet & 31;
          if (major < 4) {
            if (major < 2)
              return major === 0 ? this.readUint(minor) : this.readNint(minor);
            else
              return major === 2 ? this.readBin(minor) : this.readStr(minor);
          } else {
            if (major < 6)
              return major === 4 ? this.readArr(minor) : this.readObj(minor);
            else
              return major === 6 ? this.readTag(minor) : this.readTkn(minor);
          }
        }
        readMinorLen(minor) {
          if (minor < 24)
            return minor;
          switch (minor) {
            case 24:
              return this.reader.u8();
            case 25:
              return this.reader.u16();
            case 26:
              return this.reader.u32();
            case 27:
              return Number(this.reader.u64());
            case 31:
              return -1;
            default:
              throw 1;
          }
        }
        // ----------------------------------------------------- Unsigned int reading
        readUint(minor) {
          if (minor < 25) {
            return minor === 24 ? this.reader.u8() : minor;
          } else {
            if (minor < 27) {
              return minor === 25 ? this.reader.u16() : this.reader.u32();
            } else {
              const num = this.reader.u64();
              return num > 9007199254740991 ? num : Number(num);
            }
          }
        }
        // ----------------------------------------------------- Negative int reading
        readNint(minor) {
          if (minor < 25) {
            return minor === 24 ? -this.reader.u8() - 1 : -minor - 1;
          } else {
            if (minor < 27) {
              return minor === 25 ? -this.reader.u16() - 1 : -this.reader.u32() - 1;
            } else {
              const num = this.reader.u64();
              return num > 9007199254740991 - 1 ? -num - BigInt(1) : -Number(num) - 1;
            }
          }
        }
        // ----------------------------------------------------------- Binary reading
        readBin(minor) {
          const reader = this.reader;
          if (minor <= 23)
            return reader.buf(minor);
          switch (minor) {
            case 24:
              return reader.buf(reader.u8());
            case 25:
              return reader.buf(reader.u16());
            case 26:
              return reader.buf(reader.u32());
            case 27:
              return reader.buf(Number(reader.u64()));
            case 31: {
              let size = 0;
              const list2 = [];
              while (this.reader.peak() !== 255) {
                const uint8 = this.readBinChunk();
                size += uint8.length;
                list2.push(uint8);
              }
              this.reader.x++;
              const res = new Uint8Array(size);
              let offset = 0;
              const length = list2.length;
              for (let i = 0; i < length; i++) {
                const arr = list2[i];
                res.set(arr, offset);
                offset += arr.length;
              }
              return res;
            }
            default:
              throw 1;
          }
        }
        readBinChunk() {
          const octet = this.reader.u8();
          const major = octet >> 5;
          const minor = octet & 31;
          if (major !== 2)
            throw 2;
          if (minor > 27)
            throw 3;
          return this.readBin(minor);
        }
        // ----------------------------------------------------------- String reading
        readAsStr() {
          const reader = this.reader;
          const octet = reader.u8();
          const major = octet >> 5;
          const minor = octet & 31;
          if (major !== 3)
            throw 11;
          return this.readStr(minor);
        }
        readStr(minor) {
          const reader = this.reader;
          if (minor <= 23)
            return reader.utf8(minor);
          switch (minor) {
            case 24:
              return reader.utf8(reader.u8());
            case 25:
              return reader.utf8(reader.u16());
            case 26:
              return reader.utf8(reader.u32());
            case 27:
              return reader.utf8(Number(reader.u64()));
            case 31: {
              let str = "";
              while (reader.peak() !== 255)
                str += this.readStrChunk();
              this.reader.x++;
              return str;
            }
            default:
              throw 1;
          }
        }
        readStrLen(minor) {
          if (minor <= 23)
            return minor;
          switch (minor) {
            case 24:
              return this.reader.u8();
            case 25:
              return this.reader.u16();
            case 26:
              return this.reader.u32();
            case 27:
              return Number(this.reader.u64());
            default:
              throw 1;
          }
        }
        readStrChunk() {
          const octet = this.reader.u8();
          const major = octet >> 5;
          const minor = octet & 31;
          if (major !== 3)
            throw 4;
          if (minor > 27)
            throw 5;
          return this.readStr(minor);
        }
        // ------------------------------------------------------------ Array reading
        readArr(minor) {
          const length = this.readMinorLen(minor);
          if (length >= 0)
            return this.readArrRaw(length);
          return this.readArrIndef();
        }
        readArrRaw(length) {
          const arr = [];
          for (let i = 0; i < length; i++)
            arr.push(this.readAny());
          return arr;
        }
        readArrIndef() {
          const arr = [];
          while (this.reader.peak() !== 255)
            arr.push(this.readAny());
          this.reader.x++;
          return arr;
        }
        // ----------------------------------------------------------- Object reading
        readObj(minor) {
          if (minor < 28) {
            let length = minor;
            switch (minor) {
              case 24:
                length = this.reader.u8();
                break;
              case 25:
                length = this.reader.u16();
                break;
              case 26:
                length = this.reader.u32();
                break;
              case 27:
                length = Number(this.reader.u64());
                break;
            }
            const obj = {};
            for (let i = 0; i < length; i++) {
              const key = this.key();
              if (key === "__proto__")
                throw 6;
              const value = this.readAny();
              obj[key] = value;
            }
            return obj;
          } else if (minor === 31)
            return this.readObjIndef();
          else
            throw 1;
        }
        /** Remove this? */
        readObjRaw(length) {
          const obj = {};
          for (let i = 0; i < length; i++) {
            const key = this.key();
            const value = this.readAny();
            obj[key] = value;
          }
          return obj;
        }
        readObjIndef() {
          const obj = {};
          while (this.reader.peak() !== 255) {
            const key = this.key();
            if (this.reader.peak() === 255)
              throw 7;
            const value = this.readAny();
            obj[key] = value;
          }
          this.reader.x++;
          return obj;
        }
        key() {
          const octet = this.reader.u8();
          const major = octet >> 5;
          const minor = octet & 31;
          if (major !== 3)
            return String(this.readAnyRaw(octet));
          const length = this.readStrLen(minor);
          if (length > 31)
            return this.reader.utf8(length);
          const key = this.keyDecoder.decode(this.reader.uint8, this.reader.x, length);
          this.reader.skip(length);
          return key;
        }
        // -------------------------------------------------------------- Tag reading
        readTag(minor) {
          if (minor <= 23)
            return this.readTagRaw(minor);
          switch (minor) {
            case 24:
              return this.readTagRaw(this.reader.u8());
            case 25:
              return this.readTagRaw(this.reader.u16());
            case 26:
              return this.readTagRaw(this.reader.u32());
            case 27:
              return this.readTagRaw(Number(this.reader.u64()));
            default:
              throw 1;
          }
        }
        readTagRaw(tag) {
          return new JsonPackExtension_1.JsonPackExtension(tag, this.readAny());
        }
        // ------------------------------------------------------------ Token reading
        readTkn(minor) {
          switch (minor) {
            case 244 & 31:
              return false;
            case 245 & 31:
              return true;
            case 246 & 31:
              return null;
            case 247 & 31:
              return void 0;
            case 248 & 31:
              return new JsonPackValue_1.JsonPackValue(this.reader.u8());
            case 249 & 31:
              return this.f16();
            case 250 & 31:
              return this.reader.f32();
            case 251 & 31:
              return this.reader.f64();
          }
          if (minor <= 23)
            return new JsonPackValue_1.JsonPackValue(minor);
          throw 1;
        }
        f16() {
          return (0, f16_1.decodeF16)(this.reader.u16());
        }
      };
      exports.CborDecoderBase = CborDecoderBase;
    }
  });

  // node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/json-pack/lib/cbor/CborDecoder.js
  var require_CborDecoder = __commonJS({
    "node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/json-pack/lib/cbor/CborDecoder.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.CborDecoder = void 0;
      var CborDecoderBase_1 = require_CborDecoderBase();
      var JsonPackValue_1 = require_JsonPackValue();
      var CborDecoder = class extends CborDecoderBase_1.CborDecoderBase {
        // -------------------------------------------------------------- Map reading
        readAsMap() {
          const octet = this.reader.u8();
          const major = octet >> 5;
          const minor = octet & 31;
          switch (major) {
            case 5:
              return this.readMap(minor);
            default:
              throw 0;
          }
        }
        readMap(minor) {
          const length = this.readMinorLen(minor);
          if (length >= 0)
            return this.readMapRaw(length);
          else
            return this.readMapIndef();
        }
        readMapRaw(length) {
          const map = /* @__PURE__ */ new Map();
          for (let i = 0; i < length; i++) {
            const key = this.readAny();
            const value = this.readAny();
            map.set(key, value);
          }
          return map;
        }
        readMapIndef() {
          const map = /* @__PURE__ */ new Map();
          while (this.reader.peak() !== 255) {
            const key = this.readAny();
            if (this.reader.peak() === 255)
              throw 7;
            const value = this.readAny();
            map.set(key, value);
          }
          this.reader.x++;
          return map;
        }
        // ----------------------------------------------------------- Value skipping
        skipN(n) {
          for (let i = 0; i < n; i++)
            this.skipAny();
        }
        skipAny() {
          this.skipAnyRaw(this.reader.u8());
        }
        skipAnyRaw(octet) {
          const major = octet >> 5;
          const minor = octet & 31;
          switch (major) {
            case 0:
            case 1:
              this.skipUNint(minor);
              break;
            case 2:
              this.skipBin(minor);
              break;
            case 3:
              this.skipStr(minor);
              break;
            case 4:
              this.skipArr(minor);
              break;
            case 5:
              this.skipObj(minor);
              break;
            case 7:
              this.skipTkn(minor);
              break;
            case 6:
              this.skipTag(minor);
              break;
          }
        }
        skipMinorLen(minor) {
          if (minor <= 23)
            return minor;
          switch (minor) {
            case 24:
              return this.reader.u8();
            case 25:
              return this.reader.u16();
            case 26:
              return this.reader.u32();
            case 27:
              return Number(this.reader.u64());
            case 31:
              return -1;
            default:
              throw 1;
          }
        }
        // --------------------------------------------------------- Integer skipping
        skipUNint(minor) {
          if (minor <= 23)
            return;
          switch (minor) {
            case 24:
              return this.reader.skip(1);
            case 25:
              return this.reader.skip(2);
            case 26:
              return this.reader.skip(4);
            case 27:
              return this.reader.skip(8);
            default:
              throw 1;
          }
        }
        // ---------------------------------------------------------- Binary skipping
        skipBin(minor) {
          const length = this.skipMinorLen(minor);
          if (length >= 0)
            this.reader.skip(length);
          else {
            while (this.reader.peak() !== 255)
              this.skipBinChunk();
            this.reader.x++;
          }
        }
        skipBinChunk() {
          const octet = this.reader.u8();
          const major = octet >> 5;
          const minor = octet & 31;
          if (major !== 2)
            throw 2;
          if (minor > 27)
            throw 3;
          this.skipBin(minor);
        }
        // ---------------------------------------------------------- String skipping
        skipStr(minor) {
          const length = this.skipMinorLen(minor);
          if (length >= 0)
            this.reader.skip(length);
          else {
            while (this.reader.peak() !== 255)
              this.skipStrChunk();
            this.reader.x++;
          }
        }
        skipStrChunk() {
          const octet = this.reader.u8();
          const major = octet >> 5;
          const minor = octet & 31;
          if (major !== 3)
            throw 4;
          if (minor > 27)
            throw 5;
          this.skipStr(minor);
        }
        // ----------------------------------------------------------- Array skipping
        skipArr(minor) {
          const length = this.skipMinorLen(minor);
          if (length >= 0)
            this.skipN(length);
          else {
            while (this.reader.peak() !== 255)
              this.skipAny();
            this.reader.x++;
          }
        }
        // ---------------------------------------------------------- Object skipping
        skipObj(minor) {
          const length = this.readMinorLen(minor);
          if (length >= 0)
            return this.skipN(length * 2);
          else {
            while (this.reader.peak() !== 255) {
              this.skipAny();
              if (this.reader.peak() === 255)
                throw 7;
              this.skipAny();
            }
            this.reader.x++;
          }
        }
        // ------------------------------------------------------------- Tag skipping
        skipTag(minor) {
          const length = this.skipMinorLen(minor);
          if (length < 0)
            throw 1;
          this.skipAny();
        }
        // ----------------------------------------------------------- Token skipping
        skipTkn(minor) {
          switch (minor) {
            case 248 & 31:
              this.reader.skip(1);
              return;
            case 249 & 31:
              this.reader.skip(2);
              return;
            case 250 & 31:
              this.reader.skip(4);
              return;
            case 251 & 31:
              this.reader.skip(8);
              return;
          }
          if (minor <= 23)
            return;
          throw 1;
        }
        // --------------------------------------------------------------- Validation
        /**
         * Throws if at given offset in a buffer there is an invalid CBOR value, or
         * if the value does not span the exact length specified in `size`. I.e.
         * throws if:
         *
         * - The value is not a valid CBOR value.
         * - The value is shorter than `size`.
         * - The value is longer than `size`.
         *
         * @param value Buffer in which to validate CBOR value.
         * @param offset Offset at which the value starts.
         * @param size Expected size of the value.
         */
        validate(value, offset = 0, size = value.length) {
          this.reader.reset(value);
          this.reader.x = offset;
          const start = offset;
          this.skipAny();
          const end = this.reader.x;
          if (end - start !== size)
            throw 8;
        }
        // -------------------------------------------- One level reading - any value
        decodeLevel(value) {
          this.reader.reset(value);
          return this.readLevel();
        }
        /**
         * Decodes only one level of objects and arrays. Other values are decoded
         * completely.
         *
         * @returns One level of decoded CBOR value.
         */
        readLevel() {
          const octet = this.reader.u8();
          const major = octet >> 5;
          const minor = octet & 31;
          switch (major) {
            case 4:
              return this.readArrLevel(minor);
            case 5:
              return this.readObjLevel(minor);
            default:
              return super.readAnyRaw(octet);
          }
        }
        /**
         * Decodes primitive values, returns container values as `JsonPackValue`.
         *
         * @returns A primitive value, or CBOR container value as a blob.
         */
        readPrimitiveOrVal() {
          const octet = this.reader.peak();
          const major = octet >> 5;
          switch (major) {
            case 4:
            case 5:
              return this.readAsValue();
            default:
              return this.readAny();
          }
        }
        readAsValue() {
          const reader = this.reader;
          const start = reader.x;
          this.skipAny();
          const end = reader.x;
          return new JsonPackValue_1.JsonPackValue(reader.uint8.subarray(start, end));
        }
        // ----------------------------------------------- One level reading - object
        readObjLevel(minor) {
          const length = this.readMinorLen(minor);
          if (length >= 0)
            return this.readObjRawLevel(length);
          else
            return this.readObjIndefLevel();
        }
        readObjRawLevel(length) {
          const obj = {};
          for (let i = 0; i < length; i++) {
            const key = this.key();
            const value = this.readPrimitiveOrVal();
            obj[key] = value;
          }
          return obj;
        }
        readObjIndefLevel() {
          const obj = {};
          while (this.reader.peak() !== 255) {
            const key = this.key();
            if (this.reader.peak() === 255)
              throw 7;
            const value = this.readPrimitiveOrVal();
            obj[key] = value;
          }
          this.reader.x++;
          return obj;
        }
        // ------------------------------------------------ One level reading - array
        readArrLevel(minor) {
          const length = this.readMinorLen(minor);
          if (length >= 0)
            return this.readArrRawLevel(length);
          return this.readArrIndefLevel();
        }
        readArrRawLevel(length) {
          const arr = [];
          for (let i = 0; i < length; i++)
            arr.push(this.readPrimitiveOrVal());
          return arr;
        }
        readArrIndefLevel() {
          const arr = [];
          while (this.reader.peak() !== 255)
            arr.push(this.readPrimitiveOrVal());
          this.reader.x++;
          return arr;
        }
        // ---------------------------------------------------------- Shallow reading
        readHdr(expectedMajor) {
          const octet = this.reader.u8();
          const major = octet >> 5;
          if (major !== expectedMajor)
            throw 0;
          const minor = octet & 31;
          if (minor < 24)
            return minor;
          switch (minor) {
            case 24:
              return this.reader.u8();
            case 25:
              return this.reader.u16();
            case 26:
              return this.reader.u32();
            case 27:
              return Number(this.reader.u64());
            case 31:
              return -1;
          }
          throw 1;
        }
        readStrHdr() {
          return this.readHdr(
            3
            /* MAJOR.STR */
          );
        }
        readObjHdr() {
          return this.readHdr(
            5
            /* MAJOR.MAP */
          );
        }
        readArrHdr() {
          return this.readHdr(
            4
            /* MAJOR.ARR */
          );
        }
        findKey(key) {
          const size = this.readObjHdr();
          for (let i = 0; i < size; i++) {
            const k = this.key();
            if (k === key)
              return this;
            this.skipAny();
          }
          throw 9;
        }
        findIndex(index) {
          const size = this.readArrHdr();
          if (index >= size)
            throw 10;
          for (let i = 0; i < index; i++)
            this.skipAny();
          return this;
        }
        find(path2) {
          for (let i = 0; i < path2.length; i++) {
            const segment = path2[i];
            if (typeof segment === "string")
              this.findKey(segment);
            else
              this.findIndex(segment);
          }
          return this;
        }
      };
      exports.CborDecoder = CborDecoder;
    }
  });

  // node_modules/@jsonjoy.com/fs-snapshot/lib/async.js
  var require_async = __commonJS({
    "node_modules/@jsonjoy.com/fs-snapshot/lib/async.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.fromSnapshot = exports.toSnapshot = void 0;
      var shared_1 = require_shared();
      var toSnapshot = async ({ fs: fs2, path: path2 = "/", separator = "/" }) => {
        const stats = await fs2.lstat(path2);
        if (stats.isDirectory()) {
          const list2 = await fs2.readdir(path2);
          const entries = {};
          const dir = path2.endsWith(separator) ? path2 : path2 + separator;
          const snapshots = await Promise.all(list2.map((child) => (0, exports.toSnapshot)({ fs: fs2, path: `${dir}${child}`, separator })));
          for (let i = 0; i < list2.length; i++) {
            if (snapshots[i])
              entries["" + list2[i]] = snapshots[i];
          }
          return [0, {}, entries];
        } else if (stats.isFile()) {
          const buf = await fs2.readFile(path2);
          const uint8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
          return [1, {}, uint8];
        } else if (stats.isSymbolicLink()) {
          return [
            2,
            {
              target: await fs2.readlink(path2, { encoding: "utf8" })
            }
          ];
        }
        return null;
      };
      exports.toSnapshot = toSnapshot;
      var fromSnapshot = async (snapshot, { fs: fs2, path: path2 = "/", separator = "/" }) => {
        if (!snapshot)
          return;
        switch (snapshot[0]) {
          case 0: {
            if (!path2.endsWith(separator))
              path2 = path2 + separator;
            const [, , entries] = snapshot;
            await fs2.mkdir(path2, { recursive: true });
            for (const [name, child] of Object.entries(entries)) {
              (0, shared_1.validateEntryName)(name);
              await (0, exports.fromSnapshot)(child, { fs: fs2, path: `${path2}${name}`, separator });
            }
            break;
          }
          case 1: {
            const [, , data] = snapshot;
            await fs2.writeFile(path2, data);
            break;
          }
          case 2: {
            const [, { target }] = snapshot;
            await fs2.symlink(target, path2);
            break;
          }
        }
      };
      exports.fromSnapshot = fromSnapshot;
    }
  });

  // node_modules/@jsonjoy.com/fs-snapshot/lib/binary.js
  var require_binary = __commonJS({
    "node_modules/@jsonjoy.com/fs-snapshot/lib/binary.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.fromBinarySnapshot = exports.toBinarySnapshot = exports.fromBinarySnapshotSync = exports.toBinarySnapshotSync = void 0;
      var CborEncoder_1 = require_CborEncoder();
      var CborDecoder_1 = require_CborDecoder();
      var sync_1 = require_sync();
      var async_1 = require_async();
      var shared_1 = require_shared();
      var encoder = new CborEncoder_1.CborEncoder(shared_1.writer);
      var decoder = new CborDecoder_1.CborDecoder();
      var toBinarySnapshotSync = (options) => {
        const snapshot = (0, sync_1.toSnapshotSync)(options);
        return encoder.encode(snapshot);
      };
      exports.toBinarySnapshotSync = toBinarySnapshotSync;
      var fromBinarySnapshotSync = (uint8, options) => {
        const snapshot = decoder.decode(uint8);
        (0, sync_1.fromSnapshotSync)(snapshot, options);
      };
      exports.fromBinarySnapshotSync = fromBinarySnapshotSync;
      var toBinarySnapshot = async (options) => {
        const snapshot = await (0, async_1.toSnapshot)(options);
        return encoder.encode(snapshot);
      };
      exports.toBinarySnapshot = toBinarySnapshot;
      var fromBinarySnapshot = async (uint8, options) => {
        const snapshot = decoder.decode(uint8);
        await (0, async_1.fromSnapshot)(snapshot, options);
      };
      exports.fromBinarySnapshot = fromBinarySnapshot;
    }
  });

  // node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/base64/lib/constants.js
  var require_constants4 = __commonJS({
    "node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/base64/lib/constants.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.hasBuffer = exports.alphabet = void 0;
      exports.alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      exports.hasBuffer = typeof Buffer === "function" && typeof Buffer.from === "function";
    }
  });

  // node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/base64/lib/createToBase64Bin.js
  var require_createToBase64Bin = __commonJS({
    "node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/base64/lib/createToBase64Bin.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.createToBase64Bin = void 0;
      var constants_1 = require_constants4();
      var createToBase64Bin = (chars = constants_1.alphabet, pad = "=") => {
        if (chars.length !== 64)
          throw new Error("chars must be 64 characters long");
        const table = chars.split("").map((c) => c.charCodeAt(0));
        const table2 = [];
        for (const c1 of table) {
          for (const c2 of table) {
            const two = (c1 << 8) + c2;
            table2.push(two);
          }
        }
        const doAddPadding = pad.length === 1;
        const E = doAddPadding ? pad.charCodeAt(0) : 0;
        const EE = doAddPadding ? E << 8 | E : 0;
        return (uint8, start, length, dest, offset) => {
          const extraLength = length % 3;
          const baseLength = length - extraLength;
          for (; start < baseLength; start += 3) {
            const o1 = uint8[start];
            const o2 = uint8[start + 1];
            const o3 = uint8[start + 2];
            const v1 = o1 << 4 | o2 >> 4;
            const v2 = (o2 & 15) << 8 | o3;
            dest.setInt32(offset, (table2[v1] << 16) + table2[v2]);
            offset += 4;
          }
          if (extraLength === 1) {
            const o1 = uint8[baseLength];
            if (doAddPadding) {
              dest.setInt32(offset, (table2[o1 << 4] << 16) + EE);
              offset += 4;
            } else {
              dest.setInt16(offset, table2[o1 << 4]);
              offset += 2;
            }
          } else if (extraLength) {
            const o1 = uint8[baseLength];
            const o2 = uint8[baseLength + 1];
            const v1 = o1 << 4 | o2 >> 4;
            const v2 = (o2 & 15) << 2;
            if (doAddPadding) {
              dest.setInt32(offset, (table2[v1] << 16) + (table[v2] << 8) + E);
              offset += 4;
            } else {
              dest.setInt16(offset, table2[v1]);
              offset += 2;
              dest.setInt8(offset, table[v2]);
              offset += 1;
            }
          }
          return offset;
        };
      };
      exports.createToBase64Bin = createToBase64Bin;
    }
  });

  // node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/base64/lib/toBase64Bin.js
  var require_toBase64Bin = __commonJS({
    "node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/base64/lib/toBase64Bin.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.toBase64Bin = void 0;
      var createToBase64Bin_1 = require_createToBase64Bin();
      exports.toBase64Bin = (0, createToBase64Bin_1.createToBase64Bin)();
    }
  });

  // node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/json-pack/lib/json/JsonEncoder.js
  var require_JsonEncoder = __commonJS({
    "node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/json-pack/lib/json/JsonEncoder.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.JsonEncoder = void 0;
      var toBase64Bin_1 = require_toBase64Bin();
      var JsonEncoder = class {
        constructor(writer) {
          this.writer = writer;
        }
        encode(value) {
          const writer = this.writer;
          writer.reset();
          this.writeAny(value);
          return writer.flush();
        }
        /**
         * Called when the encoder encounters a value that it does not know how to encode.
         *
         * @param value Some JavaScript value.
         */
        writeUnknown(value) {
          this.writeNull();
        }
        writeAny(value) {
          switch (typeof value) {
            case "boolean":
              return this.writeBoolean(value);
            case "number":
              return this.writeNumber(value);
            case "string":
              return this.writeStr(value);
            case "object": {
              if (value === null)
                return this.writeNull();
              const constr = value.constructor;
              switch (constr) {
                case Object:
                  return this.writeObj(value);
                case Array:
                  return this.writeArr(value);
                case Uint8Array:
                  return this.writeBin(value);
                default:
                  if (value instanceof Uint8Array)
                    return this.writeBin(value);
                  if (Array.isArray(value))
                    return this.writeArr(value);
                  return this.writeUnknown(value);
              }
            }
            case "undefined": {
              return this.writeUndef();
            }
            default:
              return this.writeUnknown(value);
          }
        }
        writeNull() {
          this.writer.u32(1853189228);
        }
        writeUndef() {
          const writer = this.writer;
          const length = 35;
          writer.ensureCapacity(length);
          const view = writer.view;
          let x = writer.x;
          view.setUint32(x, 577003892);
          x += 4;
          view.setUint32(x, 1631215984);
          x += 4;
          view.setUint32(x, 1886153059);
          x += 4;
          view.setUint32(x, 1635019119);
          x += 4;
          view.setUint32(x, 1848599394);
          x += 4;
          view.setUint32(x, 1869753442);
          x += 4;
          view.setUint32(x, 1634952502);
          x += 4;
          view.setUint32(x, 876296567);
          x += 4;
          view.setUint16(x, 15677);
          x += 2;
          writer.uint8[x++] = 34;
          writer.x = x;
        }
        writeBoolean(bool) {
          if (bool)
            this.writer.u32(1953658213);
          else
            this.writer.u8u32(102, 1634497381);
        }
        writeNumber(num) {
          const str = num.toString();
          this.writer.ascii(str);
        }
        writeInteger(int) {
          this.writeNumber(int >> 0 === int ? int : Math.trunc(int));
        }
        writeUInteger(uint) {
          this.writeInteger(uint < 0 ? -uint : uint);
        }
        writeFloat(float) {
          this.writeNumber(float);
        }
        writeBin(buf) {
          const writer = this.writer;
          const length = buf.length;
          writer.ensureCapacity(38 + 3 + (length << 1));
          const view = writer.view;
          let x = writer.x;
          view.setUint32(x, 577003892);
          x += 4;
          view.setUint32(x, 1631215984);
          x += 4;
          view.setUint32(x, 1886153059);
          x += 4;
          view.setUint32(x, 1635019119);
          x += 4;
          view.setUint32(x, 1848602467);
          x += 4;
          view.setUint32(x, 1952805933);
          x += 4;
          view.setUint32(x, 1937011301);
          x += 4;
          view.setUint32(x, 1634548578);
          x += 4;
          view.setUint32(x, 1634952502);
          x += 4;
          view.setUint16(x, 13356);
          x += 2;
          x = (0, toBase64Bin_1.toBase64Bin)(buf, 0, length, view, x);
          writer.uint8[x++] = 34;
          writer.x = x;
        }
        writeStr(str) {
          const writer = this.writer;
          const length = str.length;
          writer.ensureCapacity(length * 4 + 2);
          if (length < 256) {
            const startX = writer.x;
            let x = startX;
            const uint8 = writer.uint8;
            uint8[x++] = 34;
            for (let i = 0; i < length; i++) {
              const code = str.charCodeAt(i);
              switch (code) {
                case 34:
                // "
                case 92:
                  uint8[x++] = 92;
                  break;
              }
              if (code < 32 || code > 126) {
                writer.x = startX;
                const jsonStr2 = JSON.stringify(str);
                writer.ensureCapacity(jsonStr2.length * 4 + 4);
                writer.utf8(jsonStr2);
                return;
              } else
                uint8[x++] = code;
            }
            uint8[x++] = 34;
            writer.x = x;
            return;
          }
          const jsonStr = JSON.stringify(str);
          writer.ensureCapacity(jsonStr.length * 4 + 4);
          writer.utf8(jsonStr);
        }
        writeAsciiStr(str) {
          const length = str.length;
          const writer = this.writer;
          writer.ensureCapacity(length * 2 + 2);
          const uint8 = writer.uint8;
          let x = writer.x;
          uint8[x++] = 34;
          for (let i = 0; i < length; i++) {
            const code = str.charCodeAt(i);
            switch (code) {
              case 34:
              // "
              case 92:
                uint8[x++] = 92;
                break;
            }
            uint8[x++] = code;
          }
          uint8[x++] = 34;
          writer.x = x;
        }
        writeArr(arr) {
          const writer = this.writer;
          writer.u8(91);
          const length = arr.length;
          const last = length - 1;
          for (let i = 0; i < last; i++) {
            this.writeAny(arr[i]);
            writer.u8(44);
          }
          if (last >= 0)
            this.writeAny(arr[last]);
          writer.u8(93);
        }
        writeArrSeparator() {
          this.writer.u8(44);
        }
        writeObj(obj) {
          const writer = this.writer;
          const keys = Object.keys(obj);
          const length = keys.length;
          if (!length)
            return writer.u16(31613);
          writer.u8(123);
          for (let i = 0; i < length; i++) {
            const key = keys[i];
            const value = obj[key];
            this.writeStr(key);
            writer.u8(58);
            this.writeAny(value);
            writer.u8(44);
          }
          writer.uint8[writer.x - 1] = 125;
        }
        writeObjSeparator() {
          this.writer.u8(44);
        }
        writeObjKeySeparator() {
          this.writer.u8(58);
        }
        // ------------------------------------------------------- Streaming encoding
        writeStartStr() {
          throw new Error("Method not implemented.");
        }
        writeStrChunk(str) {
          throw new Error("Method not implemented.");
        }
        writeEndStr() {
          throw new Error("Method not implemented.");
        }
        writeStartBin() {
          throw new Error("Method not implemented.");
        }
        writeBinChunk(buf) {
          throw new Error("Method not implemented.");
        }
        writeEndBin() {
          throw new Error("Method not implemented.");
        }
        writeStartArr() {
          this.writer.u8(91);
        }
        writeArrChunk(item) {
          throw new Error("Method not implemented.");
        }
        writeEndArr() {
          this.writer.u8(93);
        }
        writeStartObj() {
          this.writer.u8(123);
        }
        writeObjChunk(key, value) {
          throw new Error("Method not implemented.");
        }
        writeEndObj() {
          this.writer.u8(125);
        }
      };
      exports.JsonEncoder = JsonEncoder;
    }
  });

  // node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/base64/lib/createFromBase64Bin.js
  var require_createFromBase64Bin = __commonJS({
    "node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/base64/lib/createFromBase64Bin.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.createFromBase64Bin = void 0;
      var constants_1 = require_constants4();
      var createFromBase64Bin = (chars = constants_1.alphabet, pad = "=") => {
        if (chars.length !== 64)
          throw new Error("chars must be 64 characters long");
        let max = 0;
        for (let i = 0; i < chars.length; i++)
          max = Math.max(max, chars.charCodeAt(i));
        const table = [];
        for (let i = 0; i <= max; i += 1)
          table[i] = -1;
        for (let i = 0; i < chars.length; i++)
          table[chars.charCodeAt(i)] = i;
        const doExpectPadding = pad.length === 1;
        const PAD = doExpectPadding ? pad.charCodeAt(0) : 0;
        return (view, offset, length) => {
          if (!length)
            return new Uint8Array(0);
          let padding = 0;
          if (length % 4 !== 0) {
            padding = 4 - length % 4;
            length += padding;
          } else {
            const end = offset + length;
            const last = end - 1;
            if (view.getUint8(last) === PAD) {
              padding = 1;
              if (length > 1 && view.getUint8(last - 1) === PAD)
                padding = 2;
            }
          }
          if (length % 4 !== 0)
            throw new Error("Base64 string length must be a multiple of 4");
          const mainEnd = offset + length - (padding ? 4 : 0);
          const bufferLength = (length >> 2) * 3 - padding;
          const buf = new Uint8Array(bufferLength);
          let j = 0;
          let i = offset;
          for (; i < mainEnd; i += 4) {
            const word2 = view.getUint32(i);
            const octet02 = word2 >>> 24;
            const octet12 = word2 >>> 16 & 255;
            const octet2 = word2 >>> 8 & 255;
            const octet3 = word2 & 255;
            const sextet02 = table[octet02];
            const sextet12 = table[octet12];
            const sextet2 = table[octet2];
            const sextet3 = table[octet3];
            if (sextet02 < 0 || sextet12 < 0 || sextet2 < 0 || sextet3 < 0)
              throw new Error("INVALID_BASE64_SEQ");
            buf[j] = sextet02 << 2 | sextet12 >> 4;
            buf[j + 1] = sextet12 << 4 | sextet2 >> 2;
            buf[j + 2] = sextet2 << 6 | sextet3;
            j += 3;
          }
          if (!padding)
            return buf;
          if (padding === 1) {
            const word2 = view.getUint16(mainEnd);
            const octet02 = word2 >> 8;
            const octet12 = word2 & 255;
            const octet2 = view.getUint8(mainEnd + 2);
            const sextet02 = table[octet02];
            const sextet12 = table[octet12];
            const sextet2 = table[octet2];
            if (sextet02 < 0 || sextet12 < 0 || sextet2 < 0)
              throw new Error("INVALID_BASE64_SEQ");
            buf[j] = sextet02 << 2 | sextet12 >> 4;
            buf[j + 1] = sextet12 << 4 | sextet2 >> 2;
            return buf;
          }
          const word = view.getUint16(mainEnd);
          const octet0 = word >> 8;
          const octet1 = word & 255;
          const sextet0 = table[octet0];
          const sextet1 = table[octet1];
          if (sextet0 < 0 || sextet1 < 0)
            throw new Error("INVALID_BASE64_SEQ");
          buf[j] = sextet0 << 2 | sextet1 >> 4;
          return buf;
        };
      };
      exports.createFromBase64Bin = createFromBase64Bin;
    }
  });

  // node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/base64/lib/fromBase64Bin.js
  var require_fromBase64Bin = __commonJS({
    "node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/base64/lib/fromBase64Bin.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.fromBase64Bin = void 0;
      var createFromBase64Bin_1 = require_createFromBase64Bin();
      exports.fromBase64Bin = (0, createFromBase64Bin_1.createFromBase64Bin)();
    }
  });

  // node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/json-pack/lib/json/util.js
  var require_util6 = __commonJS({
    "node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/json-pack/lib/json/util.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.findEndingQuote = void 0;
      var findEndingQuote = (uint8, x) => {
        const len = uint8.length;
        let char = uint8[x];
        let prev = 0;
        while (x < len) {
          if (char === 34 && prev !== 92)
            break;
          if (char === 92 && prev === 92)
            prev = 0;
          else
            prev = char;
          char = uint8[++x];
        }
        if (x === len)
          throw new Error("Invalid JSON");
        return x;
      };
      exports.findEndingQuote = findEndingQuote;
    }
  });

  // node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/json-pack/lib/json/JsonDecoder.js
  var require_JsonDecoder = __commonJS({
    "node_modules/@jsonjoy.com/fs-snapshot/node_modules/@jsonjoy.com/json-pack/lib/json/JsonDecoder.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.JsonDecoder = exports.readKey = void 0;
      var decodeUtf8_1 = require_decodeUtf8();
      var Reader_1 = require_Reader();
      var fromBase64Bin_1 = require_fromBase64Bin();
      var util_1 = require_util6();
      var REGEX_REPLACE_ESCAPED_CHARS = /\\(b|f|n|r|t|"|\/|\\)/g;
      var escapedCharReplacer = (char) => {
        switch (char) {
          case "\\b":
            return "\b";
          case "\\f":
            return "\f";
          case "\\n":
            return "\n";
          case "\\r":
            return "\r";
          case "\\t":
            return "	";
          case '\\"':
            return '"';
          case "\\/":
            return "/";
          case "\\\\":
            return "\\";
        }
        return char;
      };
      var hasBinaryPrefix = (u8, x) => u8[x] === 100 && u8[x + 1] === 97 && u8[x + 2] === 116 && u8[x + 3] === 97 && u8[x + 4] === 58 && u8[x + 5] === 97 && u8[x + 6] === 112 && u8[x + 7] === 112 && u8[x + 8] === 108 && u8[x + 9] === 105 && u8[x + 10] === 99 && u8[x + 11] === 97 && u8[x + 12] === 116 && u8[x + 13] === 105 && u8[x + 14] === 111 && u8[x + 15] === 110 && u8[x + 16] === 47 && u8[x + 17] === 111 && u8[x + 18] === 99 && u8[x + 19] === 116 && u8[x + 20] === 101 && u8[x + 21] === 116 && u8[x + 22] === 45 && u8[x + 23] === 115 && u8[x + 24] === 116 && u8[x + 25] === 114 && u8[x + 26] === 101 && u8[x + 27] === 97 && u8[x + 28] === 109 && u8[x + 29] === 59 && u8[x + 30] === 98 && u8[x + 31] === 97 && u8[x + 32] === 115 && u8[x + 33] === 101 && u8[x + 34] === 54 && u8[x + 35] === 52 && u8[x + 36] === 44;
      var isUndefined = (u8, x) => (
        // u8[x++] === 0x22 &&  // "
        // u8[x++] === 0x64 &&  // d
        u8[x++] === 97 && // a
        u8[x++] === 116 && // t
        u8[x++] === 97 && // a
        u8[x++] === 58 && // :
        u8[x++] === 97 && // a
        u8[x++] === 112 && // p
        u8[x++] === 112 && // p
        u8[x++] === 108 && // l
        u8[x++] === 105 && // i
        u8[x++] === 99 && // c
        u8[x++] === 97 && // a
        u8[x++] === 116 && // t
        u8[x++] === 105 && // i
        u8[x++] === 111 && // o
        u8[x++] === 110 && // n
        u8[x++] === 47 && // /
        u8[x++] === 99 && // c
        u8[x++] === 98 && // b
        u8[x++] === 111 && // o
        u8[x++] === 114 && // r
        u8[x++] === 44 && // ,
        u8[x++] === 98 && // b
        u8[x++] === 97 && // a
        u8[x++] === 115 && // s
        u8[x++] === 101 && // e
        u8[x++] === 54 && // 6
        u8[x++] === 52 && // 4
        u8[x++] === 59 && // ;
        u8[x++] === 57 && // 9
        u8[x++] === 119 && // w
        u8[x++] === 61 && // =
        u8[x++] === 61 && // =
        u8[x++] === 34
      );
      var fromCharCode = String.fromCharCode;
      var readKey = (reader) => {
        const buf = reader.uint8;
        const len = buf.length;
        const points = [];
        let x = reader.x;
        let prev = 0;
        while (x < len) {
          let code = buf[x++];
          if ((code & 128) === 0) {
            if (prev === 92) {
              switch (code) {
                case 98:
                  code = 8;
                  break;
                case 102:
                  code = 12;
                  break;
                case 110:
                  code = 10;
                  break;
                case 114:
                  code = 13;
                  break;
                case 116:
                  code = 9;
                  break;
                case 34:
                  code = 34;
                  break;
                case 47:
                  code = 47;
                  break;
                case 92:
                  code = 92;
                  break;
                default:
                  throw new Error("Invalid JSON");
              }
              prev = 0;
            } else {
              if (code === 34)
                break;
              prev = code;
              if (prev === 92)
                continue;
            }
          } else {
            const octet2 = buf[x++] & 63;
            if ((code & 224) === 192) {
              code = (code & 31) << 6 | octet2;
            } else {
              const octet3 = buf[x++] & 63;
              if ((code & 240) === 224) {
                code = (code & 31) << 12 | octet2 << 6 | octet3;
              } else {
                if ((code & 248) === 240) {
                  const octet4 = buf[x++] & 63;
                  let unit = (code & 7) << 18 | octet2 << 12 | octet3 << 6 | octet4;
                  if (unit > 65535) {
                    unit -= 65536;
                    const unit0 = unit >>> 10 & 1023 | 55296;
                    unit = 56320 | unit & 1023;
                    points.push(unit0);
                    code = unit;
                  } else {
                    code = unit;
                  }
                }
              }
            }
          }
          points.push(code);
        }
        reader.x = x;
        return fromCharCode.apply(String, points);
      };
      exports.readKey = readKey;
      var JsonDecoder = class {
        constructor() {
          this.reader = new Reader_1.Reader();
        }
        read(uint8) {
          this.reader.reset(uint8);
          return this.readAny();
        }
        decode(uint8) {
          this.reader.reset(uint8);
          return this.readAny();
        }
        readAny() {
          this.skipWhitespace();
          const reader = this.reader;
          const x = reader.x;
          const uint8 = reader.uint8;
          const char = uint8[x];
          switch (char) {
            case 34: {
              if (uint8[x + 1] === 100) {
                const bin = this.tryReadBin();
                if (bin)
                  return bin;
                if (isUndefined(uint8, x + 2)) {
                  reader.x = x + 35;
                  return void 0;
                }
              }
              return this.readStr();
            }
            case 91:
              return this.readArr();
            case 102:
              return this.readFalse();
            case 110:
              return this.readNull();
            case 116:
              return this.readTrue();
            case 123:
              return this.readObj();
            default:
              if (char >= 48 && char <= 57 || char === 45)
                return this.readNum();
              throw new Error("Invalid JSON");
          }
        }
        skipWhitespace() {
          const reader = this.reader;
          const uint8 = reader.uint8;
          let x = reader.x;
          let char = 0;
          while (true) {
            char = uint8[x];
            switch (char) {
              case 32:
              case 9:
              case 10:
              case 13:
                x++;
                continue;
              default:
                reader.x = x;
                return;
            }
          }
        }
        readNull() {
          if (this.reader.u32() !== 1853189228)
            throw new Error("Invalid JSON");
          return null;
        }
        readTrue() {
          if (this.reader.u32() !== 1953658213)
            throw new Error("Invalid JSON");
          return true;
        }
        readFalse() {
          const reader = this.reader;
          if (reader.u8() !== 102 || reader.u32() !== 1634497381)
            throw new Error("Invalid JSON");
          return false;
        }
        readBool() {
          const reader = this.reader;
          switch (reader.uint8[reader.x]) {
            case 102:
              return this.readFalse();
            case 116:
              return this.readTrue();
            default:
              throw new Error("Invalid JSON");
          }
        }
        readNum() {
          const reader = this.reader;
          const uint8 = reader.uint8;
          let x = reader.x;
          let c = uint8[x++];
          const c1 = c;
          c = uint8[x++];
          if (!c || (c < 45 || c > 57) && c !== 43 && c !== 69 && c !== 101) {
            reader.x = x - 1;
            const num = +fromCharCode(c1);
            if (num !== num)
              throw new Error("Invalid JSON");
            return num;
          }
          const c2 = c;
          c = uint8[x++];
          if (!c || (c < 45 || c > 57) && c !== 43 && c !== 69 && c !== 101) {
            reader.x = x - 1;
            const num = +fromCharCode(c1, c2);
            if (num !== num)
              throw new Error("Invalid JSON");
            return num;
          }
          const c3 = c;
          c = uint8[x++];
          if (!c || (c < 45 || c > 57) && c !== 43 && c !== 69 && c !== 101) {
            reader.x = x - 1;
            const num = +fromCharCode(c1, c2, c3);
            if (num !== num)
              throw new Error("Invalid JSON");
            return num;
          }
          const c4 = c;
          c = uint8[x++];
          if (!c || (c < 45 || c > 57) && c !== 43 && c !== 69 && c !== 101) {
            reader.x = x - 1;
            const num = +fromCharCode(c1, c2, c3, c4);
            if (num !== num)
              throw new Error("Invalid JSON");
            return num;
          }
          const c5 = c;
          c = uint8[x++];
          if (!c || (c < 45 || c > 57) && c !== 43 && c !== 69 && c !== 101) {
            reader.x = x - 1;
            const num = +fromCharCode(c1, c2, c3, c4, c5);
            if (num !== num)
              throw new Error("Invalid JSON");
            return num;
          }
          const c6 = c;
          c = uint8[x++];
          if (!c || (c < 45 || c > 57) && c !== 43 && c !== 69 && c !== 101) {
            reader.x = x - 1;
            const num = +fromCharCode(c1, c2, c3, c4, c5, c6);
            if (num !== num)
              throw new Error("Invalid JSON");
            return num;
          }
          const c7 = c;
          c = uint8[x++];
          if (!c || (c < 45 || c > 57) && c !== 43 && c !== 69 && c !== 101) {
            reader.x = x - 1;
            const num = +fromCharCode(c1, c2, c3, c4, c5, c6, c7);
            if (num !== num)
              throw new Error("Invalid JSON");
            return num;
          }
          const c8 = c;
          c = uint8[x++];
          if (!c || (c < 45 || c > 57) && c !== 43 && c !== 69 && c !== 101) {
            reader.x = x - 1;
            const num = +fromCharCode(c1, c2, c3, c4, c5, c6, c7, c8);
            if (num !== num)
              throw new Error("Invalid JSON");
            return num;
          }
          const c9 = c;
          c = uint8[x++];
          if (!c || (c < 45 || c > 57) && c !== 43 && c !== 69 && c !== 101) {
            reader.x = x - 1;
            const num = +fromCharCode(c1, c2, c3, c4, c5, c6, c7, c8, c9);
            if (num !== num)
              throw new Error("Invalid JSON");
            return num;
          }
          const c10 = c;
          c = uint8[x++];
          if (!c || (c < 45 || c > 57) && c !== 43 && c !== 69 && c !== 101) {
            reader.x = x - 1;
            const num = +fromCharCode(c1, c2, c3, c4, c5, c6, c7, c8, c9, c10);
            if (num !== num)
              throw new Error("Invalid JSON");
            return num;
          }
          const c11 = c;
          c = uint8[x++];
          if (!c || (c < 45 || c > 57) && c !== 43 && c !== 69 && c !== 101) {
            reader.x = x - 1;
            const num = +fromCharCode(c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11);
            if (num !== num)
              throw new Error("Invalid JSON");
            return num;
          }
          const c12 = c;
          c = uint8[x++];
          if (!c || (c < 45 || c > 57) && c !== 43 && c !== 69 && c !== 101) {
            reader.x = x - 1;
            const num = +fromCharCode(c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12);
            if (num !== num)
              throw new Error("Invalid JSON");
            return num;
          }
          const c13 = c;
          c = uint8[x++];
          if (!c || (c < 45 || c > 57) && c !== 43 && c !== 69 && c !== 101) {
            reader.x = x - 1;
            const num = +fromCharCode(c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13);
            if (num !== num)
              throw new Error("Invalid JSON");
            return num;
          }
          const c14 = c;
          c = uint8[x++];
          if (!c || (c < 45 || c > 57) && c !== 43 && c !== 69 && c !== 101) {
            reader.x = x - 1;
            const num = +fromCharCode(c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14);
            if (num !== num)
              throw new Error("Invalid JSON");
            return num;
          }
          const c15 = c;
          c = uint8[x++];
          if (!c || (c < 45 || c > 57) && c !== 43 && c !== 69 && c !== 101) {
            reader.x = x - 1;
            const num = +fromCharCode(c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15);
            if (num !== num)
              throw new Error("Invalid JSON");
            return num;
          }
          const c16 = c;
          c = uint8[x++];
          if (!c || (c < 45 || c > 57) && c !== 43 && c !== 69 && c !== 101) {
            reader.x = x - 1;
            const num = +fromCharCode(c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15, c16);
            if (num !== num)
              throw new Error("Invalid JSON");
            return num;
          }
          const c17 = c;
          c = uint8[x++];
          if (!c || (c < 45 || c > 57) && c !== 43 && c !== 69 && c !== 101) {
            reader.x = x - 1;
            const num = +fromCharCode(c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15, c16, c17);
            if (num !== num)
              throw new Error("Invalid JSON");
            return num;
          }
          const c18 = c;
          c = uint8[x++];
          if (!c || (c < 45 || c > 57) && c !== 43 && c !== 69 && c !== 101) {
            reader.x = x - 1;
            const num = +fromCharCode(c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15, c16, c17, c18);
            if (num !== num)
              throw new Error("Invalid JSON");
            return num;
          }
          const c19 = c;
          c = uint8[x++];
          if (!c || (c < 45 || c > 57) && c !== 43 && c !== 69 && c !== 101) {
            reader.x = x - 1;
            const num = +fromCharCode(c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15, c16, c17, c18, c19);
            if (num !== num)
              throw new Error("Invalid JSON");
            return num;
          }
          const c20 = c;
          c = uint8[x++];
          if (!c || (c < 45 || c > 57) && c !== 43 && c !== 69 && c !== 101) {
            reader.x = x - 1;
            const num = +fromCharCode(c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15, c16, c17, c18, c19, c20);
            if (num !== num)
              throw new Error("Invalid JSON");
            return num;
          }
          const c21 = c;
          c = uint8[x++];
          if (!c || (c < 45 || c > 57) && c !== 43 && c !== 69 && c !== 101) {
            reader.x = x - 1;
            const num = +fromCharCode(c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15, c16, c17, c18, c19, c20, c21);
            if (num !== num)
              throw new Error("Invalid JSON");
            return num;
          }
          const c22 = c;
          c = uint8[x++];
          if (!c || (c < 45 || c > 57) && c !== 43 && c !== 69 && c !== 101) {
            reader.x = x - 1;
            const num = +fromCharCode(c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15, c16, c17, c18, c19, c20, c21, c22);
            if (num !== num)
              throw new Error("Invalid JSON");
            return num;
          }
          const c23 = c;
          c = uint8[x++];
          if (!c || (c < 45 || c > 57) && c !== 43 && c !== 69 && c !== 101) {
            reader.x = x - 1;
            const num = +fromCharCode(c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15, c16, c17, c18, c19, c20, c21, c22, c23);
            if (num !== num)
              throw new Error("Invalid JSON");
            return num;
          }
          const c24 = c;
          c = uint8[x++];
          if (!c || (c < 45 || c > 57) && c !== 43 && c !== 69 && c !== 101) {
            reader.x = x - 1;
            const num = +fromCharCode(c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15, c16, c17, c18, c19, c20, c21, c22, c23, c24);
            if (num !== num)
              throw new Error("Invalid JSON");
            return num;
          }
          throw new Error("Invalid JSON");
        }
        readStr() {
          const reader = this.reader;
          const uint8 = reader.uint8;
          const char = uint8[reader.x++];
          if (char !== 34)
            throw new Error("Invalid JSON");
          const x0 = reader.x;
          const x1 = (0, util_1.findEndingQuote)(uint8, x0);
          let str = (0, decodeUtf8_1.decodeUtf8)(uint8, x0, x1 - x0);
          str = str.replace(REGEX_REPLACE_ESCAPED_CHARS, escapedCharReplacer);
          reader.x = x1 + 1;
          return str;
        }
        tryReadBin() {
          const reader = this.reader;
          const u8 = reader.uint8;
          let x = reader.x;
          if (u8[x++] !== 34)
            return void 0;
          const hasDataUrlPrefix = hasBinaryPrefix(u8, x);
          if (!hasDataUrlPrefix)
            return void 0;
          x += 37;
          const x0 = x;
          x = (0, util_1.findEndingQuote)(u8, x);
          reader.x = x0;
          const bin = (0, fromBase64Bin_1.fromBase64Bin)(reader.view, x0, x - x0);
          reader.x = x + 1;
          return bin;
        }
        readBin() {
          const reader = this.reader;
          const u8 = reader.uint8;
          let x = reader.x;
          if (u8[x++] !== 34)
            throw new Error("Invalid JSON");
          const hasDataUrlPrefix = hasBinaryPrefix(u8, x);
          if (!hasDataUrlPrefix)
            throw new Error("Invalid JSON");
          x += 37;
          const x0 = x;
          x = (0, util_1.findEndingQuote)(u8, x);
          reader.x = x0;
          const bin = (0, fromBase64Bin_1.fromBase64Bin)(reader.view, x0, x - x0);
          reader.x = x + 1;
          return bin;
        }
        readArr() {
          const reader = this.reader;
          if (reader.u8() !== 91)
            throw new Error("Invalid JSON");
          const arr = [];
          const uint8 = reader.uint8;
          let first = true;
          while (true) {
            this.skipWhitespace();
            const char = uint8[reader.x];
            if (char === 93)
              return reader.x++, arr;
            if (char === 44)
              reader.x++;
            else if (!first)
              throw new Error("Invalid JSON");
            this.skipWhitespace();
            arr.push(this.readAny());
            first = false;
          }
        }
        readObj() {
          const reader = this.reader;
          if (reader.u8() !== 123)
            throw new Error("Invalid JSON");
          const obj = {};
          const uint8 = reader.uint8;
          let first = true;
          while (true) {
            this.skipWhitespace();
            let char = uint8[reader.x];
            if (char === 125)
              return reader.x++, obj;
            if (char === 44)
              reader.x++;
            else if (!first)
              throw new Error("Invalid JSON");
            this.skipWhitespace();
            char = uint8[reader.x++];
            if (char !== 34)
              throw new Error("Invalid JSON");
            const key = (0, exports.readKey)(reader);
            if (key === "__proto__")
              throw new Error("Invalid JSON");
            this.skipWhitespace();
            if (reader.u8() !== 58)
              throw new Error("Invalid JSON");
            this.skipWhitespace();
            obj[key] = this.readAny();
            first = false;
          }
        }
      };
      exports.JsonDecoder = JsonDecoder;
    }
  });

  // node_modules/@jsonjoy.com/fs-snapshot/lib/json.js
  var require_json2 = __commonJS({
    "node_modules/@jsonjoy.com/fs-snapshot/lib/json.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.fromJsonSnapshot = exports.toJsonSnapshot = exports.fromJsonSnapshotSync = exports.toJsonSnapshotSync = void 0;
      var JsonEncoder_1 = require_JsonEncoder();
      var JsonDecoder_1 = require_JsonDecoder();
      var sync_1 = require_sync();
      var async_1 = require_async();
      var shared_1 = require_shared();
      var encoder = new JsonEncoder_1.JsonEncoder(shared_1.writer);
      var decoder = new JsonDecoder_1.JsonDecoder();
      var toJsonSnapshotSync = (options) => {
        const snapshot = (0, sync_1.toSnapshotSync)(options);
        return encoder.encode(snapshot);
      };
      exports.toJsonSnapshotSync = toJsonSnapshotSync;
      var fromJsonSnapshotSync = (uint8, options) => {
        const snapshot = decoder.read(uint8);
        (0, sync_1.fromSnapshotSync)(snapshot, options);
      };
      exports.fromJsonSnapshotSync = fromJsonSnapshotSync;
      var toJsonSnapshot = async (options) => {
        const snapshot = await (0, async_1.toSnapshot)(options);
        return encoder.encode(snapshot);
      };
      exports.toJsonSnapshot = toJsonSnapshot;
      var fromJsonSnapshot = async (uint8, options) => {
        const snapshot = decoder.read(uint8);
        await (0, async_1.fromSnapshot)(snapshot, options);
      };
      exports.fromJsonSnapshot = fromJsonSnapshot;
    }
  });

  // node_modules/@jsonjoy.com/fs-snapshot/lib/index.js
  var require_lib7 = __commonJS({
    "node_modules/@jsonjoy.com/fs-snapshot/lib/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_constants3(), exports);
      tslib_1.__exportStar(require_sync(), exports);
      tslib_1.__exportStar(require_binary(), exports);
      tslib_1.__exportStar(require_json2(), exports);
    }
  });

  // node_modules/@jsonjoy.com/fs-node/lib/options.js
  var require_options = __commonJS({
    "node_modules/@jsonjoy.com/fs-node/lib/options.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.getWriteFileOptions = exports.writeFileDefaults = exports.getRealpathOptsAndCb = exports.getRealpathOptions = exports.getStatfsOptsAndCb = exports.getStatfsOptions = exports.getStatOptsAndCb = exports.getStatOptions = exports.getAppendFileOptsAndCb = exports.getAppendFileOpts = exports.getOpendirOptsAndCb = exports.getOpendirOptions = exports.getReaddirOptsAndCb = exports.getReaddirOptions = exports.getReadFileOptions = exports.getRmOptsAndCb = exports.getRmdirOptions = exports.getDefaultOptsAndCb = exports.getDefaultOpts = exports.optsDefaults = exports.getMkdirOptions = void 0;
      exports.getOptions = getOptions;
      exports.optsGenerator = optsGenerator;
      exports.optsAndCbGenerator = optsAndCbGenerator;
      var fs_node_utils_1 = require_lib2();
      var util_1 = require_util3();
      var mkdirDefaults = {
        mode: 511,
        recursive: false
      };
      var getMkdirOptions = (options) => {
        if (typeof options === "number")
          return Object.assign({}, mkdirDefaults, { mode: options });
        return Object.assign({}, mkdirDefaults, options);
      };
      exports.getMkdirOptions = getMkdirOptions;
      var ERRSTR_OPTS = (tipeof) => `Expected options to be either an object or a string, but got ${tipeof} instead`;
      function getOptions(defaults, options) {
        let opts;
        if (!options)
          return defaults;
        else {
          const tipeof = typeof options;
          switch (tipeof) {
            case "string":
              opts = Object.assign({}, defaults, { encoding: options });
              break;
            case "object":
              opts = Object.assign({}, defaults, options);
              break;
            default:
              throw TypeError(ERRSTR_OPTS(tipeof));
          }
        }
        if (opts.encoding !== "buffer")
          (0, fs_node_utils_1.assertEncoding)(opts.encoding);
        return opts;
      }
      function optsGenerator(defaults) {
        return (options) => getOptions(defaults, options);
      }
      function optsAndCbGenerator(getOpts) {
        return (options, callback) => typeof options === "function" ? [getOpts(), options] : [getOpts(options), (0, util_1.validateCallback)(callback)];
      }
      exports.optsDefaults = {
        encoding: "utf8"
      };
      exports.getDefaultOpts = optsGenerator(exports.optsDefaults);
      exports.getDefaultOptsAndCb = optsAndCbGenerator(exports.getDefaultOpts);
      var rmdirDefaults = {
        recursive: false
      };
      var getRmdirOptions = (options) => {
        return Object.assign({}, rmdirDefaults, options);
      };
      exports.getRmdirOptions = getRmdirOptions;
      var getRmOpts = optsGenerator(exports.optsDefaults);
      exports.getRmOptsAndCb = optsAndCbGenerator(getRmOpts);
      var readFileOptsDefaults = {
        flag: "r"
      };
      exports.getReadFileOptions = optsGenerator(readFileOptsDefaults);
      var readdirDefaults = {
        encoding: "utf8",
        recursive: false,
        withFileTypes: false
      };
      exports.getReaddirOptions = optsGenerator(readdirDefaults);
      exports.getReaddirOptsAndCb = optsAndCbGenerator(exports.getReaddirOptions);
      var opendirDefaults = {
        encoding: "utf8",
        bufferSize: 32,
        recursive: false
      };
      exports.getOpendirOptions = optsGenerator(opendirDefaults);
      exports.getOpendirOptsAndCb = optsAndCbGenerator(exports.getOpendirOptions);
      var appendFileDefaults = {
        encoding: "utf8",
        mode: 438,
        flag: fs_node_utils_1.FLAGS[fs_node_utils_1.FLAGS.a]
      };
      exports.getAppendFileOpts = optsGenerator(appendFileDefaults);
      exports.getAppendFileOptsAndCb = optsAndCbGenerator(exports.getAppendFileOpts);
      var statDefaults = {
        bigint: false
      };
      var getStatOptions = (options = {}) => Object.assign({}, statDefaults, options);
      exports.getStatOptions = getStatOptions;
      var getStatOptsAndCb = (options, callback) => typeof options === "function" ? [(0, exports.getStatOptions)(), options] : [(0, exports.getStatOptions)(options), (0, util_1.validateCallback)(callback)];
      exports.getStatOptsAndCb = getStatOptsAndCb;
      var statfsDefaults = {
        bigint: false
      };
      var getStatfsOptions = (options = {}) => Object.assign({}, statfsDefaults, options);
      exports.getStatfsOptions = getStatfsOptions;
      var getStatfsOptsAndCb = (options, callback) => typeof options === "function" ? [(0, exports.getStatfsOptions)(), options] : [(0, exports.getStatfsOptions)(options), (0, util_1.validateCallback)(callback)];
      exports.getStatfsOptsAndCb = getStatfsOptsAndCb;
      var realpathDefaults = exports.optsDefaults;
      exports.getRealpathOptions = optsGenerator(realpathDefaults);
      exports.getRealpathOptsAndCb = optsAndCbGenerator(exports.getRealpathOptions);
      exports.writeFileDefaults = {
        encoding: "utf8",
        mode: 438,
        flag: fs_node_utils_1.FLAGS[fs_node_utils_1.FLAGS.w]
      };
      exports.getWriteFileOptions = optsGenerator(exports.writeFileDefaults);
    }
  });

  // node_modules/@jsonjoy.com/fs-node/lib/Dir.js
  var require_Dir = __commonJS({
    "node_modules/@jsonjoy.com/fs-node/lib/Dir.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Dir = void 0;
      var fs_node_utils_1 = require_lib2();
      var argErrors_1 = require_argErrors();
      var validators_1 = require_validators();
      var Dirent_1 = require_Dirent();
      var util_1 = require_util3();
      var DEFAULT_ENCODING = { encoding: "utf8" };
      var dirClosed = () => (0, argErrors_1.withCode)(new Error("Directory handle was closed"), "ERR_DIR_CLOSED");
      var dirBusy = () => (0, argErrors_1.withCode)(new Error("Cannot do synchronous work on directory handle with concurrent asynchronous operations"), "ERR_DIR_CONCURRENT_OPERATION");
      var Dir = class _Dir {
        /**
         * @todo Node builds a Dir on a directory handle with `read(encoding, bufferSize)` and `close()`;
         *     this one walks a `Link` directly, so `new fs.Dir(someHandle, path)` cannot work. Extend
         *     `Superblock` with directory handles.
         *
         * @todo Get rid of `process` (specifically `process.nextTick`) globals in this file. Replace it
         *     by something, or DI inject the "environment" (such as `process`).
         *
         * @param path The path the directory was opened with, kept verbatim as `dir.path`.
         */
        constructor(handle, path2, options) {
          this.levels = [];
          this.closed = false;
          this.operationQueue = null;
          if (handle === null || handle === void 0)
            throw (0, argErrors_1.withCode)(new TypeError('The "handle" argument must be specified'), "ERR_MISSING_ARGS");
          const type = typeof options;
          const given = options === null || options === void 0 || type === "function" ? DEFAULT_ENCODING : type === "string" ? { encoding: options } : options;
          const opts = { bufferSize: 32, ...given };
          (0, validators_1.validateUint32)(opts.bufferSize, "options.bufferSize", true);
          this.options = opts;
          this._path = path2;
          const parentPath = typeof path2 === "string" ? path2 : path2.toString();
          this.levels.push({ entries: handle.children[Symbol.iterator](), path: path2, parentPath });
        }
        readBase() {
          const levels = this.levels;
          const options = this.options;
          const encoding = options.encoding;
          const recursive = options.recursive;
          while (levels.length) {
            const level = levels[levels.length - 1];
            const { done, value } = level.entries.next();
            if (done) {
              levels.pop();
              continue;
            }
            const name = value[0];
            if (name === "." || name === "..")
              continue;
            const link2 = value[1];
            const dirent = Dirent_1.default.build(link2, encoding, level.parentPath);
            if (recursive && dirent.isDirectory())
              this.descend(level.path, dirent.name, link2);
            return dirent;
          }
          return null;
        }
        // TODO: Node opens the joined path, failing ENOENT on a `hex` or non-ASCII `latin1` name, we follow the link.
        descend(parent, name, link2) {
          const path2 = (0, fs_node_utils_1.pathJoin)(parent, name);
          if (!link2.getNode().canRead())
            throw (0, util_1.createError)("EACCES", "opendir", path2);
          this.levels.push({ entries: link2.children[Symbol.iterator](), path: path2, parentPath: path2 });
        }
        readPromise() {
          return new Promise((resolve2, reject) => {
            this.readImpl((err, entry) => {
              if (err)
                reject(err);
              else
                resolve2(entry ?? null);
            });
          });
        }
        readImpl(callback) {
          if (this.closed)
            throw dirClosed();
          if (callback === void 0)
            return this.readPromise();
          const cb = callback;
          (0, util_1.validateCallback)(cb);
          const queued = this.operationQueue;
          if (queued !== null) {
            queued.push(() => {
              try {
                this.readImpl(cb);
              } catch (err) {
                process.nextTick(cb, err);
              }
            });
            return;
          }
          this.operationQueue = [];
          let entry = null;
          let error = null;
          try {
            entry = this.readBase();
          } catch (err) {
            error = err;
          }
          process.nextTick(() => {
            process.nextTick(() => {
              const queue2 = this.operationQueue;
              this.operationQueue = null;
              if (queue2)
                for (let i = 0; i < queue2.length; i++)
                  queue2[i]();
            });
            if (error)
              cb(error);
            else
              cb(null, entry);
          });
        }
        // --------------------------------------------------------------------- IDir
        get path() {
          if (!(this instanceof _Dir))
            throw (0, argErrors_1.invalidThis)("Dir");
          return this._path;
        }
        close(callback) {
          if (callback === void 0) {
            if (this.closed)
              return Promise.reject(dirClosed());
            return new Promise((resolve2, reject) => {
              this.close((err) => {
                if (err)
                  reject(err);
                else
                  resolve2();
              });
            });
          }
          const cb = callback;
          (0, util_1.validateCallback)(cb);
          if (this.closed) {
            process.nextTick(cb, dirClosed());
            return;
          }
          const queued = this.operationQueue;
          if (queued !== null) {
            queued.push(() => {
              this.close(cb);
            });
            return;
          }
          this.closed = true;
          process.nextTick(cb, null);
        }
        closeSync() {
          if (this.closed)
            throw dirClosed();
          if (this.operationQueue !== null)
            throw dirBusy();
          this.closed = true;
        }
        read(callback) {
          if (arguments.length === 0)
            return this.readPromise();
          return this.readImpl(callback);
        }
        readSync() {
          if (this.closed)
            throw dirClosed();
          if (this.operationQueue !== null)
            throw dirBusy();
          return this.readBase();
        }
        async *entries() {
          try {
            while (true) {
              const entry = await this.read();
              if (entry === null)
                break;
              yield entry;
            }
          } finally {
            await this.close();
          }
        }
        async [Symbol.asyncDispose]() {
          if (this.closed)
            return;
          await this.close();
        }
        [Symbol.dispose]() {
          if (this.closed)
            return;
          this.closeSync();
        }
      };
      exports.Dir = Dir;
      Object.defineProperty(Dir.prototype, Symbol.asyncIterator, {
        enumerable: false,
        writable: true,
        configurable: true,
        value: Dir.prototype.entries
      });
    }
  });

  // node_modules/@jsonjoy.com/fs-node/lib/volume.js
  var require_volume = __commonJS({
    "node_modules/@jsonjoy.com/fs-node/lib/volume.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.FSWatcher = exports.StatWatcher = exports.Volume = void 0;
      exports.pathToSteps = pathToSteps;
      exports.dataToStr = dataToStr;
      exports.toUnixTimestamp = toUnixTimestamp;
      var path_1 = require_path();
      var fs_core_1 = require_lib3();
      var Stats_1 = require_Stats();
      var Dirent_1 = require_Dirent();
      var StatFs_1 = require_StatFs();
      var glob_1 = require_glob();
      var buffer_1 = require_buffer3();
      var setTimeoutUnref_1 = require_setTimeoutUnref();
      var stream_1 = require_stream();
      var fs_node_utils_1 = require_lib2();
      var events_1 = require_events2();
      var FileHandle_1 = require_FileHandle();
      var util_1 = require_util5();
      var FsPromises_1 = require_FsPromises();
      var fs_print_1 = require_lib6();
      var fsSnapshot = require_lib7();
      var fs_node_utils_2 = require_lib2();
      var argErrors_1 = require_argErrors();
      var validators_1 = require_validators();
      var options_1 = require_options();
      var util_2 = require_util3();
      var readWriteArgs_1 = require_readWriteArgs();
      var Dir_1 = require_Dir();
      var cp_1 = require_cp();
      var { O_SYMLINK, F_OK, R_OK, W_OK, X_OK } = fs_node_utils_1.constants;
      var kMinPoolSpace = 128;
      function pathToSteps(path2) {
        return (0, fs_core_1.filenameToSteps)((0, util_2.pathToFilename)(path2));
      }
      function dataToStr(data, encoding = fs_node_utils_1.ENCODING_UTF8) {
        if (buffer_1.Buffer.isBuffer(data))
          return data.toString(encoding);
        else if (data instanceof Uint8Array)
          return (0, buffer_1.bufferFrom)(data).toString(encoding);
        else
          return String(data);
      }
      function toUnixTimestamp(time) {
        if (typeof time === "string" && +time == time) {
          return +time;
        }
        if (time instanceof Date) {
          return time.getTime() / 1e3;
        }
        if (isFinite(time)) {
          if (time < 0) {
            return Date.now() / 1e3;
          }
          return time;
        }
        throw new Error("Cannot parse time: " + time);
      }
      function validateUid(uid) {
        if (typeof uid !== "number")
          throw TypeError(fs_node_utils_2.ERRSTR.UID);
      }
      function validateGid(gid) {
        if (typeof gid !== "number")
          throw TypeError(fs_node_utils_2.ERRSTR.GID);
      }
      var Volume2 = class {
        get promises() {
          if (this.promisesApi === null)
            throw new Error("Promise is not supported in this environment.");
          return this.promisesApi;
        }
        constructor(_core = new fs_core_1.Superblock()) {
          this._core = _core;
          this.promisesApi = new FsPromises_1.FsPromises(this, FileHandle_1.FileHandle);
          this.openSync = (path2, flags, mode = 438) => {
            const modeNum = (0, util_2.modeToNumber)(mode);
            const fileName = (0, util_2.pathToFilename)(path2);
            const flagsNum = (0, util_2.flagsToNumber)(flags);
            return this._core.open(fileName, flagsNum, modeNum, !(flagsNum & O_SYMLINK));
          };
          this.open = (path2, flags, a, b) => {
            let mode = a;
            let callback = b;
            if (typeof a === "function") {
              mode = 438;
              callback = a;
            }
            mode = mode || 438;
            const modeNum = (0, util_2.modeToNumber)(mode);
            const fileName = (0, util_2.pathToFilename)(path2);
            const flagsNum = (0, util_2.flagsToNumber)(flags);
            this.wrapAsync(this._core.open, [fileName, flagsNum, modeNum, !(flagsNum & O_SYMLINK)], callback);
          };
          this.closeSync = (fd) => {
            this._core.close(fd);
          };
          this.close = (fd, callback) => {
            (0, fs_core_1.validateFd)(fd);
            const file = this._core.getFileByFdOrThrow(fd, "close");
            this.wrapAsync(this._core.close, [file.fd], callback);
          };
          this.readv = (fd, buffers, a, b) => {
            (0, validators_1.validateInt32)(fd, "fd", 0);
            const [position, callback] = (0, readWriteArgs_1.getVectorCallbackArgs)(buffers, a, b);
            Promise.resolve().then(() => {
              try {
                if (!buffers.length)
                  throw (0, util_2.createError)("EINVAL", "read");
                callback(null, this._core.readv(fd, buffers, position), buffers);
              } catch (err) {
                callback(err, 0, buffers);
              }
            });
          };
          this.readvSync = (fd, buffers, position) => {
            const seek = (0, readWriteArgs_1.getVectorArgs)(buffers, position);
            (0, fs_core_1.validateFd)(fd);
            if (!buffers.length)
              throw (0, util_2.createError)("EINVAL", "read");
            return this._core.readv(fd, buffers, seek);
          };
          this._readfile = (id, flagsNum, encoding) => {
            let result;
            const isUserFd = typeof id === "number";
            const userOwnsFd = isUserFd && (0, fs_core_1.isFd)(id);
            let fd;
            if (userOwnsFd)
              fd = id;
            else
              fd = this.openSync(id, flagsNum);
            try {
              const file = this._core.getFileByFdOrThrow(fd, "fstat");
              if (file.node.isDirectory())
                throw (0, util_2.createError)("EISDIR", "read");
              const buffer = file.getBuffer();
              const start = userOwnsFd ? Math.min(file.position, buffer.length) : 0;
              file.position = buffer.length;
              result = (0, util_2.bufferToEncoding)(start ? buffer.subarray(start) : buffer, encoding);
            } finally {
              if (!userOwnsFd) {
                this.closeSync(fd);
              }
            }
            return result;
          };
          this.readFileSync = (file, options) => {
            const opts = (0, options_1.getReadFileOptions)(options);
            const flagsNum = (0, util_2.flagsToNumber)(opts.flag);
            return this._readfile(file, flagsNum, opts.encoding);
          };
          this.readFile = (id, a, b) => {
            const [opts, callback] = (0, options_1.optsAndCbGenerator)(options_1.getReadFileOptions)(a, b);
            const flagsNum = (0, util_2.flagsToNumber)(opts.flag);
            this.wrapAsync(this._readfile, [id, flagsNum, opts.encoding], callback);
          };
          this.writeSync = (fd, a, b, c, d) => {
            const [, buf, offset, length, position] = (0, util_2.getWriteSyncArgs)(fd, a, b, c, d);
            return this._write(fd, buf, offset, length, position);
          };
          this.write = (fd, a, b, c, d, e) => {
            const [, , buf, offset, length, position, cb] = (0, util_2.getWriteArgs)(fd, a, b, c, d, e);
            Promise.resolve().then(() => {
              try {
                cb(null, this._write(fd, buf, offset, length, position), a);
              } catch (err) {
                cb(err, 0, a);
              }
            });
          };
          this.writev = (fd, buffers, a, b) => {
            (0, validators_1.validateInt32)(fd, "fd", 0);
            const [position, callback] = (0, readWriteArgs_1.getVectorCallbackArgs)(buffers, a, b);
            if (!buffers.length) {
              queueMicrotask(() => callback(null, 0, buffers));
              return;
            }
            Promise.resolve().then(() => {
              try {
                callback(null, this.writevBase(fd, buffers, position), buffers);
              } catch (err) {
                callback(err, 0, buffers);
              }
            });
          };
          this.writevSync = (fd, buffers, position) => {
            const seek = (0, readWriteArgs_1.getVectorArgs)(buffers, position);
            if (!buffers.length)
              return 0;
            (0, fs_core_1.validateFd)(fd);
            return this.writevBase(fd, buffers, seek);
          };
          this.writeFileSync = (id, data, options) => {
            const opts = (0, options_1.getWriteFileOptions)(options);
            const flagsNum = (0, util_2.flagsToNumber)(opts.flag);
            const modeNum = (0, util_2.modeToNumber)(opts.mode);
            const buf = (0, fs_core_1.dataToBuffer)(data, opts.encoding);
            this._core.writeFile(id, buf, flagsNum, modeNum);
          };
          this.writeFile = (id, data, a, b) => {
            let options = a;
            let callback = b;
            if (typeof a === "function")
              [options, callback] = [options_1.writeFileDefaults, a];
            const cb = (0, util_2.validateCallback)(callback);
            const opts = (0, options_1.getWriteFileOptions)(options);
            const flagsNum = (0, util_2.flagsToNumber)(opts.flag);
            const modeNum = (0, util_2.modeToNumber)(opts.mode);
            const buf = (0, fs_core_1.dataToBuffer)(data, opts.encoding);
            this.wrapAsync(this._core.writeFile, [id, buf, flagsNum, modeNum], cb);
          };
          this.copyFileSync = (src, dest, flags) => {
            const srcFilename = (0, util_2.pathToFilename)(src);
            const destFilename = (0, util_2.pathToFilename)(dest);
            (0, cp_1.copyFileCore)(this._core, srcFilename, destFilename, (0, cp_1.getValidCopyFileMode)(flags));
          };
          this.copyFile = (src, dest, a, b) => {
            const srcFilename = (0, util_2.pathToFilename)(src);
            const destFilename = (0, util_2.pathToFilename)(dest);
            let flags;
            let callback;
            if (typeof a === "function")
              [flags, callback] = [0, a];
            else
              [flags, callback] = [a, b];
            (0, util_2.validateCallback)(callback);
            const flagsNum = (0, cp_1.getValidCopyFileMode)(flags);
            Promise.resolve().then(() => {
              try {
                (0, cp_1.copyFileCore)(this._core, srcFilename, destFilename, flagsNum);
              } catch (error) {
                callback(error);
                return;
              }
              callback(null);
            });
          };
          this.linkSync = (existingPath, newPath) => {
            const existingPathFilename = (0, util_2.pathToFilename)(existingPath);
            const newPathFilename = (0, util_2.pathToFilename)(newPath);
            this._core.link(existingPathFilename, newPathFilename);
          };
          this.link = (existingPath, newPath, callback) => {
            const existingPathFilename = (0, util_2.pathToFilename)(existingPath);
            const newPathFilename = (0, util_2.pathToFilename)(newPath);
            this.wrapAsync(this._core.link, [existingPathFilename, newPathFilename], callback);
          };
          this.unlinkSync = (path2) => {
            const filename = (0, util_2.pathToFilename)(path2);
            this._core.unlink(filename);
          };
          this.unlink = (path2, callback) => {
            const filename = (0, util_2.pathToFilename)(path2);
            this.wrapAsync(this._core.unlink, [filename], callback);
          };
          this.symlinkSync = (target, path2, type) => {
            const targetFilename = (0, util_2.pathToFilename)(target);
            const pathFilename = (0, util_2.pathToFilename)(path2);
            this._core.symlink(targetFilename, pathFilename);
          };
          this.symlink = (target, path2, a, b) => {
            const callback = (0, util_2.validateCallback)(typeof a === "function" ? a : b);
            const targetFilename = (0, util_2.pathToFilename)(target);
            const pathFilename = (0, util_2.pathToFilename)(path2);
            this.wrapAsync(this._core.symlink, [targetFilename, pathFilename], callback);
          };
          this._lstat = (filename, bigint = false, throwIfNoEntry = false) => {
            let link2;
            try {
              link2 = this._core.getLinkOrThrow(filename, "lstat");
            } catch (err) {
              if (err.code === "ENOENT" && !throwIfNoEntry)
                return void 0;
              else
                throw err;
            }
            return Stats_1.default.build(link2.getNode(), bigint);
          };
          this.lstatSync = (path2, options) => {
            const { throwIfNoEntry = true, bigint = false } = (0, options_1.getStatOptions)(options);
            return this._lstat((0, util_2.pathToFilename)(path2), bigint, throwIfNoEntry);
          };
          this.renameSync = (oldPath, newPath) => {
            const oldPathFilename = (0, util_2.pathToFilename)(oldPath);
            const newPathFilename = (0, util_2.pathToFilename)(newPath);
            this._core.rename(oldPathFilename, newPathFilename);
          };
          this.rename = (oldPath, newPath, callback) => {
            const oldPathFilename = (0, util_2.pathToFilename)(oldPath);
            const newPathFilename = (0, util_2.pathToFilename)(newPath);
            this.wrapAsync(this._core.rename, [oldPathFilename, newPathFilename], callback);
          };
          this.existsSync = (path2) => {
            try {
              return this._exists((0, util_2.pathToFilename)(path2)).ok;
            } catch (err) {
              return false;
            }
          };
          this.exists = (path2, callback) => {
            const filename = (0, util_2.pathToFilename)(path2);
            if (typeof callback !== "function")
              throw Error(fs_node_utils_2.ERRSTR.CB);
            Promise.resolve().then(() => {
              try {
                callback(this._exists(filename).ok);
              } catch (err) {
                callback(false);
              }
            });
          };
          this.accessSync = (path2, mode = F_OK) => {
            const filename = (0, util_2.pathToFilename)(path2);
            mode = mode | 0;
            this._access(filename, mode);
          };
          this.access = (path2, a, b) => {
            let mode = F_OK;
            let callback;
            if (typeof a !== "function")
              [mode, callback] = [a | 0, (0, util_2.validateCallback)(b)];
            else
              callback = a;
            const filename = (0, util_2.pathToFilename)(path2);
            this.wrapAsync(this._access, [filename, mode], callback);
          };
          this.appendFileSync = (id, data, options) => {
            const opts = (0, options_1.getAppendFileOpts)(options);
            if (!opts.flag || (0, fs_core_1.isFd)(id))
              opts.flag = "a";
            this.writeFileSync(id, data, opts);
          };
          this.appendFile = (id, data, a, b) => {
            const [opts, callback] = (0, options_1.getAppendFileOptsAndCb)(a, b);
            if (!opts.flag || (0, fs_core_1.isFd)(id))
              opts.flag = "a";
            this.writeFile(id, data, opts, callback);
          };
          this._readdir = (filename, options) => {
            const steps = (0, fs_core_1.filenameToSteps)(filename);
            const link2 = this._core.getResolvedLinkOrThrow(filename, "scandir");
            const node = link2.getNode();
            if (!node.isDirectory())
              throw (0, util_2.createError)("ENOTDIR", "scandir", filename);
            if (!node.canRead())
              throw (0, util_2.createError)("EACCES", "scandir", filename);
            const list2 = [];
            for (const name of link2.children.keys()) {
              const child = link2.getChild(name);
              if (!child || name === "." || name === "..")
                continue;
              list2.push(Dirent_1.default.build(child, options.encoding));
              if (options.recursive && child.children.size) {
                const recurseOptions = { ...options, recursive: true, withFileTypes: true };
                const childList = this._readdir(child.getPath(), recurseOptions);
                list2.push(...childList);
              }
            }
            if (!fs_core_1.isWin && options.encoding !== "buffer")
              list2.sort((a, b) => {
                if (a.name < b.name)
                  return -1;
                if (a.name > b.name)
                  return 1;
                return 0;
              });
            if (options.withFileTypes)
              return list2;
            let filename2 = filename;
            if (fs_core_1.isWin)
              filename2 = filename2.replace(/\\/g, "/");
            return list2.map((dirent) => {
              if (options.recursive) {
                let fullPath = (0, fs_node_utils_2.pathJoin)(dirent.parentPath, dirent.name.toString());
                if (fs_core_1.isWin) {
                  fullPath = fullPath.replace(/\\/g, "/");
                }
                return fullPath.replace(filename2 + path_1.posix.sep, "");
              }
              return dirent.name;
            });
          };
          this.readdirSync = (path2, options) => {
            const opts = (0, options_1.getReaddirOptions)(options);
            const filename = (0, util_2.pathToFilename)(path2);
            return this._readdir(filename, opts);
          };
          this.readdir = (path2, a, b) => {
            const [options, callback] = (0, options_1.getReaddirOptsAndCb)(a, b);
            const filename = (0, util_2.pathToFilename)(path2);
            this.wrapAsync(this._readdir, [filename, options], callback);
          };
          this._readlink = (filename, encoding) => {
            const link2 = this._core.getLinkOrThrow(filename, "readlink");
            const node = link2.getNode();
            if (!node.isSymlink())
              throw (0, util_2.createError)("EINVAL", "readlink", filename);
            return (0, fs_node_utils_1.strToEncoding)(node.symlink, encoding);
          };
          this.readlinkSync = (path2, options) => {
            const opts = (0, options_1.getDefaultOpts)(options);
            const filename = (0, util_2.pathToFilename)(path2);
            return this._readlink(filename, opts.encoding);
          };
          this.readlink = (path2, a, b) => {
            const [opts, callback] = (0, options_1.getDefaultOptsAndCb)(a, b);
            const filename = (0, util_2.pathToFilename)(path2);
            this.wrapAsync(this._readlink, [filename, opts.encoding], callback);
          };
          this._fsync = (fd) => {
            this._core.getFileByFdOrThrow(fd, "fsync");
          };
          this.fsyncSync = (fd) => {
            this._fsync(fd);
          };
          this.fsync = (fd, callback) => {
            this.wrapAsync(this._fsync, [fd], callback);
          };
          this._fdatasync = (fd) => {
            this._core.getFileByFdOrThrow(fd, "fdatasync");
          };
          this.fdatasyncSync = (fd) => {
            this._fdatasync(fd);
          };
          this.fdatasync = (fd, callback) => {
            this.wrapAsync(this._fdatasync, [fd], callback);
          };
          this._ftruncate = (fd, len) => {
            this._core.ftruncate(fd, len);
          };
          this.ftruncateSync = (fd, len) => {
            this._ftruncate(fd, len);
          };
          this.ftruncate = (fd, a, b) => {
            const len = typeof a === "number" ? a : 0;
            const callback = (0, util_2.validateCallback)(typeof a === "number" ? b : a);
            this.wrapAsync(this._ftruncate, [fd, len], callback);
          };
          this._truncate = (path2, len) => {
            const fd = this.openSync(path2, "r+");
            try {
              this.ftruncateSync(fd, len);
            } finally {
              this.closeSync(fd);
            }
          };
          this.truncateSync = (id, len) => {
            if ((0, fs_core_1.isFd)(id))
              return this.ftruncateSync(id, len);
            this._truncate(id, len);
          };
          this.truncate = (id, a, b) => {
            const len = typeof a === "number" ? a : 0;
            const callback = (0, util_2.validateCallback)(typeof a === "number" ? b : a);
            if ((0, fs_core_1.isFd)(id))
              return this.ftruncate(id, len, callback);
            this.wrapAsync(this._truncate, [id, len], callback);
          };
          this._futimes = (fd, atime, mtime) => {
            this._core.futimes(fd, atime, mtime);
          };
          this.futimesSync = (fd, atime, mtime) => {
            this._futimes(fd, toUnixTimestamp(atime), toUnixTimestamp(mtime));
          };
          this.futimes = (fd, atime, mtime, callback) => {
            this.wrapAsync(this._futimes, [fd, toUnixTimestamp(atime), toUnixTimestamp(mtime)], callback);
          };
          this._utimes = (filename, atime, mtime, followSymlinks = true) => {
            this._core.utimes(filename, atime, mtime, followSymlinks);
          };
          this.utimesSync = (path2, atime, mtime) => {
            this._utimes((0, util_2.pathToFilename)(path2), toUnixTimestamp(atime), toUnixTimestamp(mtime), true);
          };
          this.utimes = (path2, atime, mtime, callback) => {
            this.wrapAsync(this._utimes, [(0, util_2.pathToFilename)(path2), toUnixTimestamp(atime), toUnixTimestamp(mtime), true], callback);
          };
          this.lutimesSync = (path2, atime, mtime) => {
            this._utimes((0, util_2.pathToFilename)(path2), toUnixTimestamp(atime), toUnixTimestamp(mtime), false);
          };
          this.lutimes = (path2, atime, mtime, callback) => {
            this.wrapAsync(this._utimes, [(0, util_2.pathToFilename)(path2), toUnixTimestamp(atime), toUnixTimestamp(mtime), false], callback);
          };
          this.mkdirSync = (path2, options) => {
            const opts = (0, options_1.getMkdirOptions)(options);
            const modeNum = (0, util_2.modeToNumber)(opts.mode, 511);
            const filename = (0, util_2.pathToFilename)(path2);
            if (opts.recursive)
              return this._core.mkdirp(filename, modeNum);
            this._core.mkdir(filename, modeNum);
          };
          this.mkdir = (path2, a, b) => {
            const opts = (0, options_1.getMkdirOptions)(a);
            const callback = (0, util_2.validateCallback)(typeof a === "function" ? a : b);
            const modeNum = (0, util_2.modeToNumber)(opts.mode, 511);
            const filename = (0, util_2.pathToFilename)(path2);
            if (opts.recursive)
              this.wrapAsync(this._core.mkdirp, [filename, modeNum], callback);
            else
              this.wrapAsync(this._core.mkdir, [filename, modeNum], callback);
          };
          this._mkdtemp = (prefix, encoding, retry = 5) => {
            const filename = prefix + (0, util_2.genRndStr6)();
            try {
              this._core.mkdir(
                filename,
                511
                /* MODE.DIR */
              );
              return (0, fs_node_utils_1.strToEncoding)(filename, encoding);
            } catch (err) {
              if (err.code === "EEXIST") {
                if (retry > 1)
                  return this._mkdtemp(prefix, encoding, retry - 1);
                else
                  throw Error("Could not create temp dir.");
              } else
                throw err;
            }
          };
          this.mkdtempSync = (prefix, options) => {
            const { encoding } = (0, options_1.getDefaultOpts)(options);
            if (!prefix || typeof prefix !== "string")
              throw new TypeError("filename prefix is required");
            (0, util_2.nullCheck)(prefix);
            return this._mkdtemp(prefix, encoding);
          };
          this.mkdtemp = (prefix, a, b) => {
            const [{ encoding }, callback] = (0, options_1.getDefaultOptsAndCb)(a, b);
            if (!prefix || typeof prefix !== "string")
              throw new TypeError("filename prefix is required");
            if (!(0, util_2.nullCheck)(prefix))
              return;
            this.wrapAsync(this._mkdtemp, [prefix, encoding], callback);
          };
          this.rmdirSync = (path2, options) => {
            const opts = (0, options_1.getRmdirOptions)(options);
            this._core.rmdir((0, util_2.pathToFilename)(path2), opts.recursive);
          };
          this.rmdir = (path2, a, b) => {
            const opts = (0, options_1.getRmdirOptions)(a);
            const callback = (0, util_2.validateCallback)(typeof a === "function" ? a : b);
            this.wrapAsync(this._core.rmdir, [(0, util_2.pathToFilename)(path2), opts.recursive], callback);
          };
          this.rmSync = (path2, options) => {
            this._core.rm((0, util_2.pathToFilename)(path2), options?.force, options?.recursive);
          };
          this.rm = (path2, a, b) => {
            const [opts, callback] = (0, options_1.getRmOptsAndCb)(a, b);
            this.wrapAsync(this._core.rm, [(0, util_2.pathToFilename)(path2), opts?.force, opts?.recursive], callback);
          };
          this._fchmod = (fd, modeNum) => {
            this._core.fchmod(fd, modeNum);
          };
          this.fchmodSync = (fd, mode) => {
            this._fchmod(fd, (0, util_2.modeToNumber)(mode));
          };
          this.fchmod = (fd, mode, callback) => {
            this.wrapAsync(this._fchmod, [fd, (0, util_2.modeToNumber)(mode)], callback);
          };
          this._chmod = (filename, modeNum, followSymlinks = true) => {
            if (followSymlinks) {
              this._core.chmod(filename, modeNum);
            } else {
              this._core.lchmod(filename, modeNum);
            }
          };
          this.chmodSync = (path2, mode) => {
            const modeNum = (0, util_2.modeToNumber)(mode);
            const filename = (0, util_2.pathToFilename)(path2);
            this._chmod(filename, modeNum, true);
          };
          this.chmod = (path2, mode, callback) => {
            const modeNum = (0, util_2.modeToNumber)(mode);
            const filename = (0, util_2.pathToFilename)(path2);
            this.wrapAsync(this._chmod, [filename, modeNum], callback);
          };
          this._lchmod = (filename, modeNum) => {
            this._core.lchmod(filename, modeNum);
          };
          this.lchmodSync = (path2, mode) => {
            const modeNum = (0, util_2.modeToNumber)(mode);
            const filename = (0, util_2.pathToFilename)(path2);
            this._lchmod(filename, modeNum);
          };
          this.lchmod = (path2, mode, callback) => {
            const modeNum = (0, util_2.modeToNumber)(mode);
            const filename = (0, util_2.pathToFilename)(path2);
            this.wrapAsync(this._lchmod, [filename, modeNum], callback);
          };
          this._fchown = (fd, uid, gid) => {
            this._core.fchown(fd, uid, gid);
          };
          this.fchownSync = (fd, uid, gid) => {
            validateUid(uid);
            validateGid(gid);
            this._fchown(fd, uid, gid);
          };
          this.fchown = (fd, uid, gid, callback) => {
            validateUid(uid);
            validateGid(gid);
            this.wrapAsync(this._fchown, [fd, uid, gid], callback);
          };
          this._chown = (filename, uid, gid) => {
            this._core.chown(filename, uid, gid);
          };
          this.chownSync = (path2, uid, gid) => {
            validateUid(uid);
            validateGid(gid);
            this._chown((0, util_2.pathToFilename)(path2), uid, gid);
          };
          this.chown = (path2, uid, gid, callback) => {
            validateUid(uid);
            validateGid(gid);
            this.wrapAsync(this._chown, [(0, util_2.pathToFilename)(path2), uid, gid], callback);
          };
          this._lchown = (filename, uid, gid) => {
            this._core.lchown(filename, uid, gid);
          };
          this.lchownSync = (path2, uid, gid) => {
            validateUid(uid);
            validateGid(gid);
            this._lchown((0, util_2.pathToFilename)(path2), uid, gid);
          };
          this.lchown = (path2, uid, gid, callback) => {
            validateUid(uid);
            validateGid(gid);
            this.wrapAsync(this._lchown, [(0, util_2.pathToFilename)(path2), uid, gid], callback);
          };
          this.statWatchers = {};
          this.cpSync = (src, dest, options) => {
            const opts_ = (0, cp_1.getCpOptions)(options);
            const srcFilename = (0, util_2.pathToFilename)(src);
            const destFilename = (0, util_2.pathToFilename)(dest);
            (0, cp_1.cpSync)(this, srcFilename, destFilename, opts_);
          };
          this.cp = (src, dest, a, b) => {
            let options;
            let callback;
            if (typeof a === "function")
              [options, callback] = [void 0, a];
            else
              [options, callback] = [a, b];
            (0, util_2.validateCallback)(callback);
            const opts_ = (0, cp_1.getCpOptions)(options);
            const srcFilename = (0, util_2.pathToFilename)(src);
            const destFilename = (0, util_2.pathToFilename)(dest);
            (0, cp_1.cpAsync)(this, srcFilename, destFilename, opts_).then(() => callback(null, void 0), (error) => callback(error));
          };
          this.openAsBlob = async (path2, options) => {
            const filename = (0, util_2.pathToFilename)(path2);
            let link2;
            try {
              link2 = this._core.getResolvedLinkOrThrow(filename, "open");
            } catch (error) {
              if (error && typeof error === "object" && error.code === "ENOENT") {
                throw (0, argErrors_1.withNativeCode)(new TypeError("Unable to open file as blob"), "ERR_INVALID_ARG_VALUE");
              }
              throw error;
            }
            const node = link2.getNode();
            const buffer = node.getBuffer();
            const type = options?.type || "";
            return new Blob([buffer], { type });
          };
          this.glob = (pattern, options, callback) => {
            if (typeof options === "function") {
              callback = options;
              options = void 0;
            }
            const cb = (0, util_2.validateCallback)(callback);
            const walk = (0, glob_1.globWalk)(this, pattern, options);
            Promise.resolve().then(() => {
              const results = [];
              for (const match of walk)
                results.push(match);
              return results;
            }).then((results) => cb(null, results), cb);
          };
          this.globSync = (pattern, options) => (0, glob_1.globSync)(this, pattern, options);
          this._opendir = (filename, options, path2, errorPath) => {
            const result = this._core.getResolvedLinkResult(filename, "opendir");
            if (!result.ok)
              throw (0, util_2.createError)(result.err.code, "opendir", errorPath);
            const link2 = result.value;
            const node = link2.getNode();
            if (!node.isDirectory())
              throw (0, util_2.createError)("ENOTDIR", "opendir", errorPath);
            if (!node.canRead())
              throw (0, util_2.createError)("EACCES", "opendir", errorPath);
            return new Dir_1.Dir(link2, path2, options);
          };
          this.opendirSync = (path2, options) => {
            const filename = (0, util_2.pathToFilename)(path2);
            const opts = (0, options_1.getOpendirOptions)(options);
            return this._opendir(filename, opts, path2 instanceof Uint8Array ? (0, buffer_1.bufferFrom)(path2) : filename, "");
          };
          this.opendir = (path2, a, b) => {
            const [options, callback] = (0, options_1.getOpendirOptsAndCb)(a, b);
            const filename = (0, util_2.pathToFilename)(path2);
            const dirPath = path2 instanceof Uint8Array ? (0, buffer_1.bufferFrom)(path2) : filename;
            this.wrapAsync(this._opendir, [filename, options, dirPath, filename], callback);
          };
          const self2 = this;
          this.StatWatcher = class extends StatWatcher {
            constructor() {
              super(self2);
            }
          };
          const _ReadStream = FsReadStream;
          this.ReadStream = class extends _ReadStream {
            constructor(...args) {
              super(self2, ...args);
            }
          };
          const _WriteStream = FsWriteStream;
          this.WriteStream = class extends _WriteStream {
            constructor(...args) {
              super(self2, ...args);
            }
          };
          this.FSWatcher = class extends FSWatcher {
            constructor() {
              super(self2);
            }
          };
          const _realpath = (filename, encoding) => {
            const realLink = this._core.getResolvedLinkOrThrow(filename, "realpath");
            return (0, fs_node_utils_1.strToEncoding)(realLink.getPath() || "/", encoding);
          };
          const realpathImpl = (path2, a, b) => {
            const [opts, callback] = (0, options_1.getRealpathOptsAndCb)(a, b);
            const pathFilename = (0, util_2.pathToFilename)(path2);
            self2.wrapAsync(_realpath, [pathFilename, opts.encoding], callback);
          };
          const realpathSyncImpl = (path2, options) => _realpath((0, util_2.pathToFilename)(path2), (0, options_1.getRealpathOptions)(options).encoding);
          this.realpath = realpathImpl;
          this.realpath.native = realpathImpl;
          this.realpathSync = realpathSyncImpl;
          this.realpathSync.native = realpathSyncImpl;
          this.readSync = function(fd, a, b, c, d) {
            const { buffer, offset, length, position } = (0, readWriteArgs_1.getReadSyncArgs)(arguments.length, a, b, c, d);
            (0, fs_core_1.validateFd)(fd);
            return self2._core.read(fd, buffer, offset, length, position);
          };
          this.read = function(fd, a, b, c, d, e) {
            (0, validators_1.validateInt32)(fd, "fd", 0);
            const { buffer, offset, length, position, callback } = (0, readWriteArgs_1.getReadArgs)(arguments.length, a, b, c, d, e);
            if (length === 0) {
              queueMicrotask(() => callback(null, 0, buffer));
              return;
            }
            Promise.resolve().then(() => {
              try {
                callback(null, self2._core.read(fd, buffer, offset, length, position), buffer);
              } catch (err) {
                callback(err, 0, buffer);
              }
            });
          };
        }
        wrapAsync(method, args, callback) {
          (0, util_2.validateCallback)(callback);
          Promise.resolve().then(() => {
            let result;
            try {
              result = method.apply(this, args);
            } catch (err) {
              callback(err);
              return;
            }
            callback(null, result);
          });
        }
        reset() {
          this._core.reset();
        }
        toJSON(paths, json = {}, isRelative = false, asBuffer = false) {
          return this._core.toJSON(paths, json, isRelative, asBuffer);
        }
        fromJSON(json, cwd2) {
          return this._core.fromJSON(json, cwd2);
        }
        fromNestedJSON(json, cwd2) {
          return this._core.fromNestedJSON(json, cwd2);
        }
        // Legacy interface
        mountSync(mountpoint, json) {
          this._core.fromJSON(json, mountpoint);
        }
        _write(fd, buf, offset, length, position) {
          return this._core.write(fd, buf, offset, length, position);
        }
        writevBase(fd, buffers, position) {
          this._core.getFileByFdOrThrow(fd, "write");
          let p = position;
          let bytesWritten = 0;
          const length = buffers.length;
          for (let i = 0; i < length; i++) {
            const buffer = buffers[i];
            const nodeBuf = buffer_1.Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
            const bytes = this._core.write(fd, nodeBuf, 0, nodeBuf.byteLength, p);
            if (p !== null)
              p += bytes;
            bytesWritten += bytes;
            if (bytes < nodeBuf.byteLength)
              break;
          }
          return bytesWritten;
        }
        lstat(path2, a, b) {
          const [{ throwIfNoEntry = true, bigint = false }, callback] = (0, options_1.getStatOptsAndCb)(a, b);
          this.wrapAsync(this._lstat, [(0, util_2.pathToFilename)(path2), bigint, throwIfNoEntry], callback);
        }
        _stat(filename, bigint = false, throwIfNoEntry = true) {
          const result = this._core.getResolvedLinkResult(filename, "stat");
          if (result.ok) {
            return (0, fs_core_1.Ok)(Stats_1.default.build(result.value.getNode(), bigint));
          }
          if (result.err.code === "ENOENT" && !throwIfNoEntry) {
            return (0, fs_core_1.Ok)(void 0);
          } else {
            return result;
          }
        }
        _statOrThrow(filename, bigint = false, throwIfNoEntry = true) {
          const result = this._stat(filename, bigint, throwIfNoEntry);
          if (result.ok) {
            return result.value;
          } else {
            throw result.err.toError();
          }
        }
        statSync(path2, options) {
          const { bigint = true, throwIfNoEntry = true } = (0, options_1.getStatOptions)(options);
          const result = this._stat((0, util_2.pathToFilename)(path2), bigint, throwIfNoEntry);
          if (result.ok) {
            return result.value;
          } else {
            throw result.err.toError();
          }
        }
        stat(path2, a, b) {
          const [{ bigint = false, throwIfNoEntry = true }, callback] = (0, options_1.getStatOptsAndCb)(a, b);
          this.wrapAsync(this._statOrThrow, [(0, util_2.pathToFilename)(path2), bigint, throwIfNoEntry], callback);
        }
        fstatBase(fd, bigint = false) {
          const file = this._core.getFileByFd(fd);
          if (!file)
            throw (0, util_2.createError)("EBADF", "fstat");
          return Stats_1.default.build(file.node, bigint);
        }
        fstatSync(fd, options) {
          return this.fstatBase(fd, (0, options_1.getStatOptions)(options).bigint);
        }
        fstat(fd, a, b) {
          const [opts, callback] = (0, options_1.getStatOptsAndCb)(a, b);
          this.wrapAsync(this.fstatBase, [fd, opts.bigint], callback);
        }
        _exists(filename) {
          const result = this._stat(filename);
          return result.ok ? (0, fs_core_1.Ok)(true) : result;
        }
        _access(filename, mode) {
          const link2 = this._core.getResolvedLinkOrThrow(filename, "access");
          const node = link2.getNode();
          if (mode === F_OK) {
            return;
          }
          if (mode & R_OK && !node.canRead()) {
            throw (0, util_2.createError)("EACCES", "access", filename);
          }
          if (mode & W_OK && !node.canWrite()) {
            throw (0, util_2.createError)("EACCES", "access", filename);
          }
          if (mode & X_OK && !node.canExecute()) {
            throw (0, util_2.createError)("EACCES", "access", filename);
          }
        }
        watchFile(path2, a, b) {
          const filename = (0, util_2.pathToFilename)(path2);
          let options = a;
          let listener = b;
          if (typeof options === "function") {
            listener = a;
            options = null;
          }
          if (typeof listener !== "function") {
            throw new TypeError('The "listener" argument must be of type function. Received ' + typeof listener);
          }
          let interval = 5007;
          let persistent = true;
          let bigint = false;
          if (options && typeof options === "object") {
            if (options.interval !== void 0) {
              if (typeof options.interval !== "number")
                throw new TypeError('The "options.interval" property must be of type number. Received ' + typeof options.interval);
              if (!Number.isInteger(options.interval) || options.interval < 0 || options.interval > 4294967295)
                throw new RangeError(`The value of "options.interval" is out of range. It must be an integer >= 0 && <= 4294967295. Received ${options.interval}`);
              interval = options.interval;
            }
            if (typeof options.persistent === "boolean")
              persistent = options.persistent;
            if (typeof options.bigint === "boolean")
              bigint = options.bigint;
          }
          let watcher = this.statWatchers[filename];
          if (!watcher) {
            watcher = new this.StatWatcher();
            watcher.start(filename, persistent, interval, bigint);
            this.statWatchers[filename] = watcher;
          }
          watcher.addListener("change", listener);
          return watcher;
        }
        unwatchFile(path2, listener) {
          const filename = (0, util_2.pathToFilename)(path2);
          const watcher = this.statWatchers[filename];
          if (!watcher)
            return;
          if (typeof listener === "function") {
            watcher.removeListener("change", listener);
          } else {
            watcher.removeAllListeners("change");
          }
          if (watcher.listenerCount("change") === 0) {
            watcher.stop();
            delete this.statWatchers[filename];
          }
        }
        createReadStream(path2, options) {
          return new this.ReadStream(path2, options);
        }
        createWriteStream(path2, options) {
          return new this.WriteStream(path2, options);
        }
        watch(path2, options, listener) {
          const filename = (0, util_2.pathToFilename)(path2);
          let givenOptions = options;
          if (typeof options === "function") {
            listener = options;
            givenOptions = null;
          }
          let { persistent, recursive, encoding, signal, throwIfNoEntry, ignore } = (0, options_1.getDefaultOpts)(givenOptions);
          if (persistent === void 0)
            persistent = true;
          if (recursive === void 0)
            recursive = false;
          const watcher = new this.FSWatcher();
          try {
            watcher.start(filename, persistent, recursive, encoding, ignore);
          } catch (err) {
            if (throwIfNoEntry === false && err.code === "ENOENT")
              return watcher;
            throw err;
          }
          if (listener) {
            watcher.addListener("change", listener);
          }
          if (signal) {
            if (signal.aborted) {
              watcher.close();
            } else {
              const onAbort = () => watcher.close();
              signal.addEventListener("abort", onAbort, { once: true });
              watcher.once("close", () => signal.removeEventListener("abort", onAbort));
            }
          }
          return watcher;
        }
        _statfs(filename, bigint = false) {
          this._core.getResolvedLinkOrThrow(filename, "statfs");
          return StatFs_1.default.build(this._core, bigint);
        }
        statfsSync(path2, options) {
          const { bigint = false } = (0, options_1.getStatfsOptions)(options);
          return this._statfs((0, util_2.pathToFilename)(path2), bigint);
        }
        statfs(path2, a, b) {
          const [{ bigint = false }, callback] = (0, options_1.getStatfsOptsAndCb)(a, b);
          this.wrapAsync(this._statfs, [(0, util_2.pathToFilename)(path2), bigint], callback);
        }
        // ---------------------------------------------------------------- Tree View
        toTree(opts = { separator: path_1.sep }) {
          return (0, fs_print_1.toTreeSync)(this, opts);
        }
        // ---------------------------------------------------------------- Snapshots
        toSnapshot(path2 = "/") {
          return fsSnapshot.toSnapshotSync({ fs: this, path: path2 });
        }
        fromSnapshot(snapshot, path2 = "/") {
          return fsSnapshot.fromSnapshotSync(snapshot, { fs: this, path: path2 });
        }
        toBinarySnapshot(path2 = "/") {
          return fsSnapshot.toBinarySnapshotSync({ fs: this, path: path2 });
        }
        fromBinarySnapshot(binary, path2 = "/") {
          return fsSnapshot.fromBinarySnapshotSync(binary, { fs: this, path: path2 });
        }
        toJsonSnapshot(path2 = "/") {
          const uint8 = fsSnapshot.toJsonSnapshotSync({ fs: this, path: path2 });
          return buffer_1.Buffer.from(uint8).toString("utf8");
        }
        fromJsonSnapshot(json, path2 = "/") {
          const uint8 = new Uint8Array(buffer_1.Buffer.from(json, "utf8"));
          return fsSnapshot.fromJsonSnapshotSync(uint8, { fs: this, path: path2 });
        }
      };
      exports.Volume = Volume2;
      Volume2.fromJSON = (json, cwd2, opts) => new Volume2(fs_core_1.Superblock.fromJSON(json, cwd2, opts));
      Volume2.fromNestedJSON = (json, cwd2, opts) => new Volume2(fs_core_1.Superblock.fromNestedJSON(json, cwd2, opts));
      function emitStop(self2) {
        self2.emit("stop");
      }
      function buildZeroStats(bigint) {
        const stats = new Stats_1.default();
        const zero = bigint ? BigInt(0) : 0;
        const epoch = /* @__PURE__ */ new Date(0);
        stats.uid = zero;
        stats.gid = zero;
        stats.rdev = zero;
        stats.blksize = zero;
        stats.ino = zero;
        stats.size = zero;
        stats.blocks = zero;
        stats.atime = epoch;
        stats.mtime = epoch;
        stats.ctime = epoch;
        stats.birthtime = epoch;
        stats.atimeMs = zero;
        stats.mtimeMs = zero;
        stats.ctimeMs = zero;
        stats.birthtimeMs = zero;
        if (bigint) {
          stats.atimeNs = zero;
          stats.mtimeNs = zero;
          stats.ctimeNs = zero;
          stats.birthtimeNs = zero;
        }
        stats.dev = zero;
        stats.mode = zero;
        stats.nlink = zero;
        return stats;
      }
      var StatWatcher = class extends events_1.EventEmitter {
        constructor(vol) {
          super();
          this.bigint = false;
          this.fileExists = false;
          this.stopped = false;
          this.onInterval = () => {
            if (this.stopped)
              return;
            const stats = this.statSafe();
            if (stats) {
              if (!this.fileExists) {
                this.fileExists = true;
                const prev = this.prev;
                this.prev = stats;
                this.emit("change", stats, prev);
              } else if (this.hasChanged(stats)) {
                const prev = this.prev;
                this.prev = stats;
                this.emit("change", stats, prev);
              }
            } else if (this.fileExists) {
              this.fileExists = false;
              this.emit("change", buildZeroStats(this.bigint), this.prev);
            }
            this.loop();
          };
          this.vol = vol;
        }
        loop() {
          clearTimeout(this.timeoutRef);
          this.timeoutRef = this.setTimeout(this.onInterval, this.interval);
        }
        hasChanged(stats) {
          const prev = this.prev;
          return stats.mtimeMs !== prev.mtimeMs || stats.ctimeMs !== prev.ctimeMs || stats.size !== prev.size || stats.ino !== prev.ino || stats.mode !== prev.mode || stats.uid !== prev.uid || stats.gid !== prev.gid || stats.nlink !== prev.nlink;
        }
        statSafe() {
          try {
            return this.bigint ? this.vol.statSync(this.filename, { bigint: true }) : this.vol.statSync(this.filename);
          } catch {
            return null;
          }
        }
        start(path2, persistent = true, interval = 5007, bigint = false) {
          this.filename = (0, util_2.pathToFilename)(path2);
          this.setTimeout = persistent ? setTimeout.bind(typeof globalThis !== "undefined" ? globalThis : global) : setTimeoutUnref_1.default;
          this.interval = interval;
          this.bigint = bigint;
          const stats = this.statSafe();
          if (stats) {
            this.prev = stats;
            this.fileExists = true;
          } else {
            this.prev = buildZeroStats(bigint);
            this.fileExists = false;
            queueMicrotask(() => {
              if (!this.stopped)
                this.emit("change", this.prev, this.prev);
            });
          }
          this.loop();
        }
        stop() {
          this.stopped = true;
          clearTimeout(this.timeoutRef);
          queueMicrotask(() => {
            emitStop.call(this, this);
          });
        }
        /**
         * Keep the event loop alive while the watcher is active. Polling continues
         * either way; this only controls whether the process is kept running.
         */
        ref() {
          this.setTimeout = setTimeout.bind(typeof globalThis !== "undefined" ? globalThis : global);
          const ref = this.timeoutRef;
          if (ref && typeof ref === "object" && typeof ref.ref === "function")
            ref.ref();
          return this;
        }
        /** Let the process exit while the watcher is active. Polling continues. */
        unref() {
          this.setTimeout = setTimeoutUnref_1.default;
          const ref = this.timeoutRef;
          if (ref && typeof ref === "object" && typeof ref.unref === "function")
            ref.unref();
          return this;
        }
      };
      exports.StatWatcher = StatWatcher;
      var pool;
      function allocNewPool(poolSize) {
        pool = (0, buffer_1.bufferAllocUnsafe)(poolSize);
        pool.used = 0;
      }
      (0, util_1.inherits)(FsReadStream, stream_1.Readable);
      exports.ReadStream = FsReadStream;
      function FsReadStream(vol, path2, options) {
        if (!(this instanceof FsReadStream))
          return new FsReadStream(vol, path2, options);
        this._vol = vol;
        options = Object.assign({}, (0, options_1.getOptions)(options, {}));
        if (options.highWaterMark === void 0)
          options.highWaterMark = 64 * 1024;
        stream_1.Readable.call(this, options);
        this.path = (0, util_2.pathToFilename)(path2);
        this._fileHandle = options.fd && typeof options.fd !== "number" ? options.fd : null;
        this.fd = options.fd === void 0 ? null : typeof options.fd !== "number" ? options.fd.fd : options.fd;
        this.flags = options.flags === void 0 ? "r" : options.flags;
        this.mode = options.mode === void 0 ? 438 : options.mode;
        this.start = options.start;
        this.end = options.end;
        this.autoClose = options.autoClose === void 0 ? true : options.autoClose;
        this.pos = void 0;
        this.bytesRead = 0;
        if (this.start !== void 0) {
          if (typeof this.start !== "number") {
            throw new TypeError('"start" option must be a Number');
          }
          if (this.end === void 0) {
            this.end = Infinity;
          } else if (typeof this.end !== "number") {
            throw new TypeError('"end" option must be a Number');
          }
          if (this.start > this.end) {
            throw new Error('"start" option must be <= "end" option');
          }
          this.pos = this.start;
        }
        if (typeof this.fd !== "number")
          this.open();
        this.on("end", function() {
          if (this.autoClose) {
            if (this.destroy)
              this.destroy();
          }
        });
      }
      FsReadStream.prototype.open = function() {
        var self2 = this;
        this._vol.open(this.path, this.flags, this.mode, (er, fd) => {
          if (er) {
            if (self2.autoClose) {
              if (self2.destroy)
                self2.destroy();
            }
            self2.emit("error", er);
            return;
          }
          self2.fd = fd;
          self2.emit("open", fd);
          self2.read();
        });
      };
      FsReadStream.prototype._read = function(n) {
        if (typeof this.fd !== "number") {
          return this.once("open", function() {
            this._read(n);
          });
        }
        if (this.destroyed)
          return;
        if (!pool || pool.length - pool.used < kMinPoolSpace) {
          allocNewPool(this._readableState.highWaterMark);
        }
        var thisPool = pool;
        var toRead = Math.min(pool.length - pool.used, n);
        var start = pool.used;
        if (this.pos !== void 0)
          toRead = Math.min(this.end - this.pos + 1, toRead);
        if (toRead <= 0)
          return this.push(null);
        var self2 = this;
        this._vol.read(this.fd, pool, pool.used, toRead, this.pos, onread);
        if (this.pos !== void 0)
          this.pos += toRead;
        pool.used += toRead;
        function onread(er, bytesRead) {
          if (er) {
            if (self2.autoClose && self2.destroy) {
              self2.destroy();
            }
            self2.emit("error", er);
          } else {
            var b = null;
            if (bytesRead > 0) {
              self2.bytesRead += bytesRead;
              b = thisPool.slice(start, start + bytesRead);
            }
            self2.push(b);
          }
        }
      };
      FsReadStream.prototype._destroy = function(err, cb) {
        this.close((err2) => {
          cb(err || err2);
        });
      };
      FsReadStream.prototype.close = function(cb) {
        if (cb)
          this.once("close", cb);
        if (this.closed || typeof this.fd !== "number") {
          if (typeof this.fd !== "number") {
            this.once("open", closeOnOpen);
            return;
          }
          return queueMicrotask(() => this.emit("close"));
        }
        if (typeof this._readableState?.closed === "boolean") {
          this._readableState.closed = true;
        } else {
          this.closed = true;
        }
        if (this._fileHandle) {
          this._fileHandle.close().then(() => this.emit("close"), (er) => this.emit("error", er));
        } else {
          this._vol.close(this.fd, (er) => {
            if (er)
              this.emit("error", er);
            else
              this.emit("close");
          });
        }
        this.fd = null;
      };
      function closeOnOpen(fd) {
        this.close();
      }
      (0, util_1.inherits)(FsWriteStream, stream_1.Writable);
      exports.WriteStream = FsWriteStream;
      function FsWriteStream(vol, path2, options) {
        if (!(this instanceof FsWriteStream))
          return new FsWriteStream(vol, path2, options);
        this._vol = vol;
        options = Object.assign({}, (0, options_1.getOptions)(options, {}));
        stream_1.Writable.call(this, options);
        this.path = (0, util_2.pathToFilename)(path2);
        this._fileHandle = options.fd && typeof options.fd !== "number" ? options.fd : null;
        this.fd = options.fd === void 0 ? null : typeof options.fd !== "number" ? options.fd.fd : options.fd;
        this.flags = options.flags === void 0 ? "w" : options.flags;
        this.mode = options.mode === void 0 ? 438 : options.mode;
        this.start = options.start;
        this.autoClose = options.autoClose === void 0 ? true : !!options.autoClose;
        this.pos = void 0;
        this.bytesWritten = 0;
        this.pending = true;
        if (this.start !== void 0) {
          if (typeof this.start !== "number") {
            throw new TypeError('"start" option must be a Number');
          }
          if (this.start < 0) {
            throw new Error('"start" must be >= zero');
          }
          this.pos = this.start;
        }
        if (options.encoding)
          this.setDefaultEncoding(options.encoding);
        if (typeof this.fd !== "number")
          this.open();
        this.once("finish", function() {
          if (this.autoClose) {
            this.close();
          }
        });
      }
      FsWriteStream.prototype.open = function() {
        this._vol.open(this.path, this.flags, this.mode, function(er, fd) {
          if (er) {
            if (this.autoClose && this.destroy) {
              this.destroy();
            }
            this.emit("error", er);
            return;
          }
          this.fd = fd;
          this.pending = false;
          this.emit("open", fd);
        }.bind(this));
      };
      FsWriteStream.prototype._write = function(data, encoding, cb) {
        if (!(data instanceof buffer_1.Buffer || data instanceof Uint8Array))
          return this.emit("error", new Error("Invalid data"));
        if (typeof this.fd !== "number") {
          return this.once("open", function() {
            this._write(data, encoding, cb);
          });
        }
        var self2 = this;
        this._vol.write(this.fd, data, 0, data.length, this.pos, (er, bytes) => {
          if (er) {
            if (self2.autoClose && self2.destroy) {
              self2.destroy();
            }
            return cb(er);
          }
          self2.bytesWritten += bytes;
          cb();
        });
        if (this.pos !== void 0)
          this.pos += data.length;
      };
      FsWriteStream.prototype._writev = function(data, cb) {
        if (typeof this.fd !== "number") {
          return this.once("open", function() {
            this._writev(data, cb);
          });
        }
        const self2 = this;
        const len = data.length;
        const chunks = new Array(len);
        var size = 0;
        for (var i = 0; i < len; i++) {
          var chunk = data[i].chunk;
          chunks[i] = chunk;
          size += chunk.length;
        }
        const buf = buffer_1.Buffer.concat(chunks);
        this._vol.write(this.fd, buf, 0, buf.length, this.pos, (er, bytes) => {
          if (er) {
            if (self2.destroy)
              self2.destroy();
            return cb(er);
          }
          self2.bytesWritten += bytes;
          cb();
        });
        if (this.pos !== void 0)
          this.pos += size;
      };
      FsWriteStream.prototype.close = function(cb) {
        if (cb)
          this.once("close", cb);
        if (this.closed || typeof this.fd !== "number") {
          if (typeof this.fd !== "number") {
            this.once("open", closeOnOpen);
            return;
          }
          return queueMicrotask(() => this.emit("close"));
        }
        if (typeof this._writableState?.closed === "boolean") {
          this._writableState.closed = true;
        } else {
          this.closed = true;
        }
        if (this._fileHandle) {
          this._fileHandle.close().then(() => this.emit("close"), (er) => this.emit("error", er));
        } else {
          this._vol.close(this.fd, (er) => {
            if (er)
              this.emit("error", er);
            else
              this.emit("close");
          });
        }
        this.fd = null;
      };
      FsWriteStream.prototype._destroy = FsReadStream.prototype._destroy;
      FsWriteStream.prototype.destroySoon = FsWriteStream.prototype.end;
      var FSWatcher = class extends events_1.EventEmitter {
        constructor(vol) {
          super();
          this._filename = "";
          this._filenameEncoded = "";
          this._recursive = false;
          this._encoding = fs_node_utils_1.ENCODING_UTF8;
          this._closed = false;
          this._onEvent = (event) => {
            switch (event.type) {
              case 0:
              case 1:
                this._emit("rename", event.steps);
                break;
              case 4:
                if (event.oldSteps)
                  this._emit("rename", event.oldSteps);
                this._emit("rename", event.steps);
                break;
              case 2:
              case 3:
                this._emit("change", event.steps);
                break;
            }
          };
          this._persist = () => {
            this._timer = setTimeout(this._persist, 1e6);
          };
          this._vol = vol;
        }
        _emit(type, relativeSteps) {
          const filename = relativeSteps.length ? relativeSteps.join(fs_node_utils_2.pathSep) : this._watcher.link.getName();
          if (this._ignore && this._ignore(filename))
            return;
          this.emit("change", type, (0, fs_node_utils_1.strToEncoding)(filename, this._encoding));
        }
        /**
         * Keep the event loop alive while the watcher is active. All watchers are
         * ref'ed by default (unless started with `persistent: false`). No-op when
         * already ref'ed, closed, or never started.
         */
        ref() {
          if (this._watcher && !this._closed && !this._timer)
            this._persist();
          return this;
        }
        /**
         * Let the process exit while the watcher is active. Events are still
         * delivered. No-op when already unref'ed.
         */
        unref() {
          clearTimeout(this._timer);
          this._timer = void 0;
          return this;
        }
        start(path2, persistent = true, recursive = false, encoding = fs_node_utils_1.ENCODING_UTF8, ignore) {
          this._filename = (0, util_2.pathToFilename)(path2);
          this._steps = (0, fs_core_1.filenameToSteps)(this._filename);
          this._filenameEncoded = (0, fs_node_utils_1.strToEncoding)(this._filename);
          this._recursive = recursive;
          this._encoding = encoding;
          this._ignore = ignore === void 0 ? void 0 : (0, fs_node_utils_1.watchIgnoreToMatcher)(ignore);
          try {
            this._watcher = new fs_core_1.CoreWatcher(this._vol._core, this._filename, { recursive });
          } catch (err) {
            throw (0, util_2.createWatchError)(err.code, this._filename);
          }
          this._link = this._watcher.link;
          this._watcher.changes.listen(this._onEvent);
          if (persistent)
            this._persist();
        }
        close() {
          clearTimeout(this._timer);
          this._timer = void 0;
          if (!this._watcher || this._closed)
            return;
          this._closed = true;
          this._watcher.close();
          queueMicrotask(() => this.emit("close"));
        }
      };
      exports.FSWatcher = FSWatcher;
    }
  });

  // node_modules/@jsonjoy.com/fs-node/lib/index.js
  var require_lib8 = __commonJS({
    "node_modules/@jsonjoy.com/fs-node/lib/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.fsCommonObjectsList = exports.fsSynchronousApiList = exports.fsCallbackApiList = exports.FsPromises = exports.Dir = exports.FileHandle = exports.StatFs = exports.Dirent = exports.Stats = exports.toUnixTimestamp = exports.FSWatcher = exports.StatWatcher = exports.Volume = void 0;
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      var volume_1 = require_volume();
      Object.defineProperty(exports, "Volume", { enumerable: true, get: function() {
        return volume_1.Volume;
      } });
      Object.defineProperty(exports, "StatWatcher", { enumerable: true, get: function() {
        return volume_1.StatWatcher;
      } });
      Object.defineProperty(exports, "FSWatcher", { enumerable: true, get: function() {
        return volume_1.FSWatcher;
      } });
      Object.defineProperty(exports, "toUnixTimestamp", { enumerable: true, get: function() {
        return volume_1.toUnixTimestamp;
      } });
      var Stats_1 = require_Stats();
      Object.defineProperty(exports, "Stats", { enumerable: true, get: function() {
        return Stats_1.default;
      } });
      var Dirent_1 = require_Dirent();
      Object.defineProperty(exports, "Dirent", { enumerable: true, get: function() {
        return Dirent_1.default;
      } });
      var StatFs_1 = require_StatFs();
      Object.defineProperty(exports, "StatFs", { enumerable: true, get: function() {
        return StatFs_1.default;
      } });
      var FileHandle_1 = require_FileHandle();
      Object.defineProperty(exports, "FileHandle", { enumerable: true, get: function() {
        return FileHandle_1.FileHandle;
      } });
      var Dir_1 = require_Dir();
      Object.defineProperty(exports, "Dir", { enumerable: true, get: function() {
        return Dir_1.Dir;
      } });
      var FsPromises_1 = require_FsPromises();
      Object.defineProperty(exports, "FsPromises", { enumerable: true, get: function() {
        return FsPromises_1.FsPromises;
      } });
      tslib_1.__exportStar(require_options(), exports);
      tslib_1.__exportStar(require_util3(), exports);
      tslib_1.__exportStar(require_glob(), exports);
      var fs_node_utils_1 = require_lib2();
      Object.defineProperty(exports, "fsCallbackApiList", { enumerable: true, get: function() {
        return fs_node_utils_1.fsCallbackApiList;
      } });
      Object.defineProperty(exports, "fsSynchronousApiList", { enumerable: true, get: function() {
        return fs_node_utils_1.fsSynchronousApiList;
      } });
      Object.defineProperty(exports, "fsCommonObjectsList", { enumerable: true, get: function() {
        return fs_node_utils_1.fsCommonObjectsList;
      } });
    }
  });

  // node_modules/memfs/lib/index.js
  var require_lib9 = __commonJS({
    "node_modules/memfs/lib/index.js"(exports, module) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.memfs = exports.fs = exports.vol = exports.Volume = void 0;
      exports.createFsFromVolume = createFsFromVolume;
      var fs_node_1 = require_lib8();
      Object.defineProperty(exports, "Volume", { enumerable: true, get: function() {
        return fs_node_1.Volume;
      } });
      var fs_node_utils_1 = require_lib2();
      var { F_OK, R_OK, W_OK, X_OK } = fs_node_utils_1.constants;
      var getGlobalProcess = () => {
        const maybeProcess = typeof globalThis !== "undefined" ? globalThis.process : void 0;
        return maybeProcess ?? {};
      };
      var createProcess = (cwd2, baseProcess = getGlobalProcess()) => ({
        cwd: () => cwd2,
        platform: baseProcess.platform ?? "linux",
        emitWarning: baseProcess.emitWarning?.bind(baseProcess) ?? (() => {
        }),
        env: baseProcess.env ?? {},
        getuid: baseProcess.getuid?.bind(baseProcess),
        getgid: baseProcess.getgid?.bind(baseProcess)
      });
      exports.vol = fs_node_1.Volume.fromNestedJSON({}, "/", { process: createProcess("/") });
      var kStreams = Symbol("streams");
      var streamSlot = (index) => ({
        get() {
          return this[kStreams][index];
        },
        set(value) {
          this[kStreams][index] = value;
        },
        enumerable: true,
        configurable: true
      });
      var streamDescriptors = {
        ReadStream: streamSlot(0),
        WriteStream: streamSlot(1),
        FileReadStream: streamSlot(2),
        FileWriteStream: streamSlot(3)
      };
      function createFsFromVolume(vol) {
        const fs2 = { F_OK, R_OK, W_OK, X_OK, constants: fs_node_utils_1.constants, Stats: fs_node_1.Stats, Dir: fs_node_1.Dir, Dirent: fs_node_1.Dirent };
        for (const method of fs_node_1.fsSynchronousApiList)
          if (typeof vol[method] === "function")
            fs2[method] = vol[method].bind(vol);
        for (const method of fs_node_1.fsCallbackApiList)
          if (typeof vol[method] === "function")
            fs2[method] = vol[method].bind(vol);
        fs2.StatWatcher = vol.StatWatcher;
        fs2.FSWatcher = vol.FSWatcher;
        fs2[kStreams] = [vol.ReadStream, vol.WriteStream, vol.ReadStream, vol.WriteStream];
        Object.defineProperties(fs2, streamDescriptors);
        fs2.promises = vol.promises;
        if (typeof vol.realpath === "function") {
          fs2.realpath = vol.realpath.bind(vol);
          if (typeof vol.realpath.native === "function") {
            fs2.realpath.native = vol.realpath.native.bind(vol);
          }
        }
        if (typeof vol.realpathSync === "function") {
          fs2.realpathSync = vol.realpathSync.bind(vol);
          if (typeof vol.realpathSync.native === "function") {
            fs2.realpathSync.native = vol.realpathSync.native.bind(vol);
          }
        }
        fs2._toUnixTimestamp = fs_node_1.toUnixTimestamp;
        fs2.__vol = vol;
        return fs2;
      }
      exports.fs = createFsFromVolume(exports.vol);
      var memfs = (json = {}, cwdOrOpts = "/") => {
        const opts = typeof cwdOrOpts === "string" ? { cwd: cwdOrOpts } : cwdOrOpts;
        const cwd2 = opts.cwd ?? (opts.process ? void 0 : "/");
        const process3 = opts.process ?? createProcess(cwd2 ?? "/");
        const vol = fs_node_1.Volume.fromNestedJSON(json, cwd2, { process: process3 });
        const fs2 = createFsFromVolume(vol);
        return { fs: fs2, vol };
      };
      exports.memfs = memfs;
      module.exports = { ...module.exports, ...exports.fs };
      module.exports.semantic = true;
    }
  });

  // node_modules/fs-monkey/lib/util/lists.js
  var require_lists = __commonJS({
    "node_modules/fs-monkey/lib/util/lists.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports.fsSyncMethods = exports.fsProps = exports.fsAsyncMethods = void 0;
      var fsProps = exports.fsProps = ["constants", "F_OK", "R_OK", "W_OK", "X_OK", "Stats"];
      var fsSyncMethods = exports.fsSyncMethods = ["renameSync", "ftruncateSync", "truncateSync", "chownSync", "fchownSync", "lchownSync", "chmodSync", "fchmodSync", "lchmodSync", "statSync", "lstatSync", "fstatSync", "linkSync", "symlinkSync", "readlinkSync", "realpathSync", "unlinkSync", "rmdirSync", "mkdirSync", "mkdirpSync", "readdirSync", "closeSync", "openSync", "utimesSync", "futimesSync", "fsyncSync", "writeSync", "readSync", "readFileSync", "writeFileSync", "appendFileSync", "existsSync", "accessSync", "fdatasyncSync", "mkdtempSync", "copyFileSync", "rmSync", "createReadStream", "createWriteStream"];
      var fsAsyncMethods = exports.fsAsyncMethods = ["rename", "ftruncate", "truncate", "chown", "fchown", "lchown", "chmod", "fchmod", "lchmod", "stat", "lstat", "fstat", "link", "symlink", "readlink", "realpath", "unlink", "rmdir", "mkdir", "mkdirp", "readdir", "close", "open", "utimes", "futimes", "fsync", "write", "read", "readFile", "writeFile", "appendFile", "exists", "access", "fdatasync", "mkdtemp", "copyFile", "rm", "watchFile", "unwatchFile", "watch"];
    }
  });

  // node_modules/unionfs/lib/union.js
  var require_union = __commonJS({
    "node_modules/unionfs/lib/union.js"(exports) {
      "use strict";
      var __awaiter2 = exports && exports.__awaiter || function(thisArg, _arguments, P, generator) {
        function adopt(value) {
          return value instanceof P ? value : new P(function(resolve2) {
            resolve2(value);
          });
        }
        return new (P || (P = Promise))(function(resolve2, reject) {
          function fulfilled(value) {
            try {
              step(generator.next(value));
            } catch (e) {
              reject(e);
            }
          }
          function rejected(value) {
            try {
              step(generator["throw"](value));
            } catch (e) {
              reject(e);
            }
          }
          function step(result) {
            result.done ? resolve2(result.value) : adopt(result.value).then(fulfilled, rejected);
          }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
      };
      var __generator2 = exports && exports.__generator || function(thisArg, body) {
        var _ = { label: 0, sent: function() {
          if (t[0] & 1) throw t[1];
          return t[1];
        }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
        return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() {
          return this;
        }), g;
        function verb(n) {
          return function(v) {
            return step([n, v]);
          };
        }
        function step(op) {
          if (f) throw new TypeError("Generator is already executing.");
          while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
              case 0:
              case 1:
                t = op;
                break;
              case 4:
                _.label++;
                return { value: op[1], done: false };
              case 5:
                _.label++;
                y = op[1];
                op = [0];
                continue;
              case 7:
                op = _.ops.pop();
                _.trys.pop();
                continue;
              default:
                if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                  _ = 0;
                  continue;
                }
                if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                  _.label = op[1];
                  break;
                }
                if (op[0] === 6 && _.label < t[1]) {
                  _.label = t[1];
                  t = op;
                  break;
                }
                if (t && _.label < t[2]) {
                  _.label = t[2];
                  _.ops.push(op);
                  break;
                }
                if (t[2]) _.ops.pop();
                _.trys.pop();
                continue;
            }
            op = body.call(thisArg, _);
          } catch (e) {
            op = [6, e];
            y = 0;
          } finally {
            f = t = 0;
          }
          if (op[0] & 5) throw op[1];
          return { value: op[0] ? op[1] : void 0, done: true };
        }
      };
      var __values2 = exports && exports.__values || function(o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m) return m.call(o);
        if (o && typeof o.length === "number") return {
          next: function() {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
          }
        };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
      };
      var __read2 = exports && exports.__read || function(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
          while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        } catch (error) {
          e = { error };
        } finally {
          try {
            if (r && !r.done && (m = i["return"])) m.call(i);
          } finally {
            if (e) throw e.error;
          }
        }
        return ar;
      };
      var __spreadArray2 = exports && exports.__spreadArray || function(to, from, pack) {
        if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
          if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
          }
        }
        return to.concat(ar || Array.prototype.slice.call(from));
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Union = void 0;
      var path_1 = require_path_browserify();
      var stream_1 = require_stream_browserify();
      var _a = require_lists();
      var fsAsyncMethods = _a.fsAsyncMethods;
      var fsSyncMethods = _a.fsSyncMethods;
      var SPECIAL_METHODS = /* @__PURE__ */ new Set([
        "existsSync",
        "readdir",
        "readdirSync",
        "createReadStream",
        "createWriteStream",
        "watch",
        "watchFile",
        "unwatchFile"
      ]);
      var ADDITIONAL_PROPERTIES = ["F_OK", "R_OK", "W_OK", "X_OK", "constants", "Stats", "Dirent"];
      var createFSProxy = function(watchers) {
        return new Proxy({}, {
          get: function(_obj, property) {
            var e_1, _a2;
            var funcCallers = [];
            var prop;
            try {
              for (var watchers_1 = __values2(watchers), watchers_1_1 = watchers_1.next(); !watchers_1_1.done; watchers_1_1 = watchers_1.next()) {
                var watcher = watchers_1_1.value;
                prop = watcher[property];
                if (typeof prop === "function") {
                  funcCallers.push([watcher, prop]);
                }
              }
            } catch (e_1_1) {
              e_1 = { error: e_1_1 };
            } finally {
              try {
                if (watchers_1_1 && !watchers_1_1.done && (_a2 = watchers_1.return)) _a2.call(watchers_1);
              } finally {
                if (e_1) throw e_1.error;
              }
            }
            if (funcCallers.length) {
              return function() {
                var e_2, _a3;
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                  args[_i] = arguments[_i];
                }
                try {
                  for (var funcCallers_1 = __values2(funcCallers), funcCallers_1_1 = funcCallers_1.next(); !funcCallers_1_1.done; funcCallers_1_1 = funcCallers_1.next()) {
                    var _b = __read2(funcCallers_1_1.value, 2), watcher2 = _b[0], func = _b[1];
                    func.apply(watcher2, args);
                  }
                } catch (e_2_1) {
                  e_2 = { error: e_2_1 };
                } finally {
                  try {
                    if (funcCallers_1_1 && !funcCallers_1_1.done && (_a3 = funcCallers_1.return)) _a3.call(funcCallers_1);
                  } finally {
                    if (e_2) throw e_2.error;
                  }
                }
              };
            } else {
              return prop;
            }
          }
        });
      };
      var fsPromisesMethods = [
        "access",
        "copyFile",
        "open",
        "opendir",
        "rename",
        "truncate",
        "rmdir",
        "mkdir",
        "readdir",
        "readlink",
        "symlink",
        "lstat",
        "stat",
        "link",
        "unlink",
        "chmod",
        "lchmod",
        "lchown",
        "chown",
        "utimes",
        "realpath",
        "mkdtemp",
        "writeFile",
        "appendFile",
        "readFile"
      ];
      var Union = (
        /** @class */
        (function() {
          function Union2() {
            var e_3, _a2, e_4, _b, e_5, _c, e_6, _d;
            var _this = this;
            this.fss = [];
            this.ReadStream = stream_1.Readable;
            this.WriteStream = stream_1.Writable;
            this.promises = {};
            this.unwatchFile = function() {
              var e_7, _a3;
              var args = [];
              for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
              }
              try {
                for (var _b2 = __values2(_this.fss), _c2 = _b2.next(); !_c2.done; _c2 = _b2.next()) {
                  var fs2 = _c2.value;
                  try {
                    fs2.unwatchFile.apply(fs2, args);
                  } catch (e) {
                  }
                }
              } catch (e_7_1) {
                e_7 = { error: e_7_1 };
              } finally {
                try {
                  if (_c2 && !_c2.done && (_a3 = _b2.return)) _a3.call(_b2);
                } finally {
                  if (e_7) throw e_7.error;
                }
              }
            };
            this.watch = function() {
              var e_8, _a3;
              var args = [];
              for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
              }
              var watchers = [];
              try {
                for (var _b2 = __values2(_this.fss), _c2 = _b2.next(); !_c2.done; _c2 = _b2.next()) {
                  var fs2 = _c2.value;
                  try {
                    var watcher = fs2.watch.apply(fs2, args);
                    watchers.push(watcher);
                  } catch (e) {
                  }
                }
              } catch (e_8_1) {
                e_8 = { error: e_8_1 };
              } finally {
                try {
                  if (_c2 && !_c2.done && (_a3 = _b2.return)) _a3.call(_b2);
                } finally {
                  if (e_8) throw e_8.error;
                }
              }
              return createFSProxy(watchers);
            };
            this.watchFile = function() {
              var e_9, _a3;
              var args = [];
              for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
              }
              try {
                for (var _b2 = __values2(_this.fss), _c2 = _b2.next(); !_c2.done; _c2 = _b2.next()) {
                  var fs2 = _c2.value;
                  try {
                    fs2.watchFile.apply(fs2, args);
                  } catch (e) {
                  }
                }
              } catch (e_9_1) {
                e_9 = { error: e_9_1 };
              } finally {
                try {
                  if (_c2 && !_c2.done && (_a3 = _b2.return)) _a3.call(_b2);
                } finally {
                  if (e_9) throw e_9.error;
                }
              }
            };
            this.existsSync = function(path2) {
              var e_10, _a3;
              try {
                for (var _b2 = __values2(_this.fss), _c2 = _b2.next(); !_c2.done; _c2 = _b2.next()) {
                  var fs2 = _c2.value;
                  try {
                    if (fs2.existsSync(path2)) {
                      return true;
                    }
                  } catch (e) {
                  }
                }
              } catch (e_10_1) {
                e_10 = { error: e_10_1 };
              } finally {
                try {
                  if (_c2 && !_c2.done && (_a3 = _b2.return)) _a3.call(_b2);
                } finally {
                  if (e_10) throw e_10.error;
                }
              }
              return false;
            };
            this.readdir = function() {
              var args = [];
              for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
              }
              var lastarg = args.length - 1;
              var cb = args[lastarg];
              if (typeof cb !== "function") {
                cb = null;
                lastarg++;
              }
              var numErrors = 0;
              var lastError = null;
              var result = /* @__PURE__ */ new Map();
              var iterate = function(i, error) {
                if (i === void 0) {
                  i = 0;
                }
                if (error) {
                  error.prev = lastError;
                  lastError = error;
                  numErrors++;
                }
                if (i >= _this.fss.length) {
                  if (cb) {
                    if (numErrors < _this.fss.length) {
                      return cb(null, _this.sortedArrayFromReaddirResult(result));
                    }
                    cb(error || Error("No file systems attached."));
                  }
                  return;
                }
                args[lastarg] = function(err, resArg) {
                  var e_11, _a3;
                  if (resArg) {
                    try {
                      for (var resArg_1 = __values2(resArg), resArg_1_1 = resArg_1.next(); !resArg_1_1.done; resArg_1_1 = resArg_1.next()) {
                        var res = resArg_1_1.value;
                        result.set(_this.pathFromReaddirEntry(res), res);
                      }
                    } catch (e_11_1) {
                      e_11 = { error: e_11_1 };
                    } finally {
                      try {
                        if (resArg_1_1 && !resArg_1_1.done && (_a3 = resArg_1.return)) _a3.call(resArg_1);
                      } finally {
                        if (e_11) throw e_11.error;
                      }
                    }
                  }
                  return iterate(i + 1, err);
                };
                var j = _this.fss.length - i - 1;
                var fs2 = _this.fss[j];
                var func = fs2.readdir;
                if (!func)
                  iterate(i + 1, Error("Method not supported: readdir"));
                else
                  func.apply(fs2, args);
              };
              iterate();
            };
            this.readdirSync = function() {
              var e_12, _a3;
              var args = [];
              for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
              }
              var numErrors = 0;
              var lastError = null;
              var result = /* @__PURE__ */ new Map();
              for (var i = _this.fss.length - 1; i >= 0; i--) {
                var fs2 = _this.fss[i];
                try {
                  if (!fs2.readdirSync)
                    throw Error('Method not supported: "readdirSync" with args "'.concat(args, '"'));
                  try {
                    for (var _b2 = (e_12 = void 0, __values2(fs2.readdirSync.apply(fs2, args))), _c2 = _b2.next(); !_c2.done; _c2 = _b2.next()) {
                      var res = _c2.value;
                      result.set(_this.pathFromReaddirEntry(res), res);
                    }
                  } catch (e_12_1) {
                    e_12 = { error: e_12_1 };
                  } finally {
                    try {
                      if (_c2 && !_c2.done && (_a3 = _b2.return)) _a3.call(_b2);
                    } finally {
                      if (e_12) throw e_12.error;
                    }
                  }
                } catch (err) {
                  err.prev = lastError;
                  lastError = err;
                  numErrors++;
                  if (numErrors === _this.fss.length) {
                    throw err;
                  } else {
                  }
                }
              }
              return _this.sortedArrayFromReaddirResult(result);
            };
            this.readdirPromise = function() {
              var args = [];
              for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
              }
              return __awaiter2(_this, void 0, void 0, function() {
                var lastError, result, i, fs2, _a3, _b2, res, e_13_1, err_1;
                var e_13, _c2;
                return __generator2(this, function(_d2) {
                  switch (_d2.label) {
                    case 0:
                      lastError = null;
                      result = /* @__PURE__ */ new Map();
                      i = this.fss.length - 1;
                      _d2.label = 1;
                    case 1:
                      if (!(i >= 0)) return [3, 13];
                      fs2 = this.fss[i];
                      _d2.label = 2;
                    case 2:
                      _d2.trys.push([2, 11, , 12]);
                      if (!fs2.promises || !fs2.promises.readdir)
                        throw Error('Method not supported: "readdirSync" with args "'.concat(args, '"'));
                      _d2.label = 3;
                    case 3:
                      _d2.trys.push([3, 8, 9, 10]);
                      e_13 = void 0;
                      return [4, fs2.promises.readdir.apply(fs2, args)];
                    case 4:
                      _a3 = __values2.apply(void 0, [_d2.sent()]), _b2 = _a3.next();
                      _d2.label = 5;
                    case 5:
                      if (!!_b2.done) return [3, 7];
                      res = _b2.value;
                      result.set(this.pathFromReaddirEntry(res), res);
                      _d2.label = 6;
                    case 6:
                      _b2 = _a3.next();
                      return [3, 5];
                    case 7:
                      return [3, 10];
                    case 8:
                      e_13_1 = _d2.sent();
                      e_13 = { error: e_13_1 };
                      return [3, 10];
                    case 9:
                      try {
                        if (_b2 && !_b2.done && (_c2 = _a3.return)) _c2.call(_a3);
                      } finally {
                        if (e_13) throw e_13.error;
                      }
                      return [
                        7
                        /*endfinally*/
                      ];
                    case 10:
                      return [3, 12];
                    case 11:
                      err_1 = _d2.sent();
                      err_1.prev = lastError;
                      lastError = err_1;
                      if (result.size === 0 && !i) {
                        throw err_1;
                      } else {
                      }
                      return [3, 12];
                    case 12:
                      i--;
                      return [3, 1];
                    case 13:
                      return [2, this.sortedArrayFromReaddirResult(result)];
                  }
                });
              });
            };
            this.pathFromReaddirEntry = function(readdirEntry) {
              if (readdirEntry instanceof Buffer || typeof readdirEntry === "string") {
                return String(readdirEntry);
              }
              return readdirEntry.name;
            };
            this.sortedArrayFromReaddirResult = function(readdirResult) {
              var e_14, _a3;
              var array = [];
              try {
                for (var _b2 = __values2(Array.from(readdirResult.keys()).sort()), _c2 = _b2.next(); !_c2.done; _c2 = _b2.next()) {
                  var key = _c2.value;
                  var value = readdirResult.get(key);
                  if (value !== void 0)
                    array.push(value);
                }
              } catch (e_14_1) {
                e_14 = { error: e_14_1 };
              } finally {
                try {
                  if (_c2 && !_c2.done && (_a3 = _b2.return)) _a3.call(_b2);
                } finally {
                  if (e_14) throw e_14.error;
                }
              }
              return array;
            };
            this.createReadStream = function(path2) {
              var lastError = null;
              for (var i = _this.fss.length - 1; i >= 0; i--) {
                var fs2 = _this.fss[i];
                try {
                  if (!fs2.createReadStream)
                    throw Error('Method not supported: "createReadStream"');
                  if (fs2.existsSync && !fs2.existsSync(path2)) {
                    throw new Error('file "'.concat(path2, '" does not exists'));
                  }
                  var stream = fs2.createReadStream(path2);
                  if (!stream) {
                    throw new Error("no valid stream");
                  }
                  _this.ReadStream = fs2.ReadStream;
                  return stream;
                } catch (err) {
                  lastError = err;
                }
              }
              throw lastError;
            };
            this.createWriteStream = function(path2) {
              var e_15, _a3;
              var lastError = null;
              var fssWithFilePath = [];
              var fssWithParentDir = [];
              for (var i = _this.fss.length - 1; i >= 0; i--) {
                var fs2 = _this.fss[i];
                try {
                  if (!fs2.createWriteStream)
                    throw Error('Method not supported: "createWriteStream"');
                  if (!fs2.statSync((0, path_1.dirname)(path2)).isDirectory()) {
                    throw new Error('path "'.concat((0, path_1.dirname)(path2), '" is not a directory'));
                  }
                  if (fs2.existsSync(path2)) {
                    fssWithFilePath.push(fs2);
                  } else {
                    fssWithParentDir.push(fs2);
                  }
                } catch (err) {
                  lastError = err;
                }
              }
              try {
                for (var _b2 = __values2(__spreadArray2(__spreadArray2([], __read2(fssWithFilePath), false), __read2(fssWithParentDir), false)), _c2 = _b2.next(); !_c2.done; _c2 = _b2.next()) {
                  var fs2 = _c2.value;
                  try {
                    var stream = fs2.createWriteStream(path2);
                    if (!stream) {
                      throw new Error("no valid stream");
                    }
                    _this.WriteStream = fs2.WriteStream;
                    return stream;
                  } catch (err) {
                    lastError = err;
                  }
                }
              } catch (e_15_1) {
                e_15 = { error: e_15_1 };
              } finally {
                try {
                  if (_c2 && !_c2.done && (_a3 = _b2.return)) _a3.call(_b2);
                } finally {
                  if (e_15) throw e_15.error;
                }
              }
              throw lastError;
            };
            var _loop_1 = function(method2) {
              if (!SPECIAL_METHODS.has(method2)) {
                this_1[method2] = function() {
                  var args = [];
                  for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                  }
                  return _this.syncMethod(method2, args);
                };
              }
            };
            var this_1 = this;
            try {
              for (var fsSyncMethods_1 = __values2(fsSyncMethods), fsSyncMethods_1_1 = fsSyncMethods_1.next(); !fsSyncMethods_1_1.done; fsSyncMethods_1_1 = fsSyncMethods_1.next()) {
                var method = fsSyncMethods_1_1.value;
                _loop_1(method);
              }
            } catch (e_3_1) {
              e_3 = { error: e_3_1 };
            } finally {
              try {
                if (fsSyncMethods_1_1 && !fsSyncMethods_1_1.done && (_a2 = fsSyncMethods_1.return)) _a2.call(fsSyncMethods_1);
              } finally {
                if (e_3) throw e_3.error;
              }
            }
            var _loop_2 = function(method2) {
              if (!SPECIAL_METHODS.has(method2)) {
                this_2[method2] = function() {
                  var args = [];
                  for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                  }
                  return _this.asyncMethod(method2, args);
                };
              }
            };
            var this_2 = this;
            try {
              for (var fsAsyncMethods_1 = __values2(fsAsyncMethods), fsAsyncMethods_1_1 = fsAsyncMethods_1.next(); !fsAsyncMethods_1_1.done; fsAsyncMethods_1_1 = fsAsyncMethods_1.next()) {
                var method = fsAsyncMethods_1_1.value;
                _loop_2(method);
              }
            } catch (e_4_1) {
              e_4 = { error: e_4_1 };
            } finally {
              try {
                if (fsAsyncMethods_1_1 && !fsAsyncMethods_1_1.done && (_b = fsAsyncMethods_1.return)) _b.call(fsAsyncMethods_1);
              } finally {
                if (e_4) throw e_4.error;
              }
            }
            var _loop_3 = function(method2) {
              if (method2 === "readdir") {
                this_3.promises[method2] = this_3.readdirPromise;
                return "continue";
              }
              this_3.promises[method2] = function() {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                  args[_i] = arguments[_i];
                }
                return _this.promiseMethod(method2, args);
              };
            };
            var this_3 = this;
            try {
              for (var fsPromisesMethods_1 = __values2(fsPromisesMethods), fsPromisesMethods_1_1 = fsPromisesMethods_1.next(); !fsPromisesMethods_1_1.done; fsPromisesMethods_1_1 = fsPromisesMethods_1.next()) {
                var method = fsPromisesMethods_1_1.value;
                _loop_3(method);
              }
            } catch (e_5_1) {
              e_5 = { error: e_5_1 };
            } finally {
              try {
                if (fsPromisesMethods_1_1 && !fsPromisesMethods_1_1.done && (_c = fsPromisesMethods_1.return)) _c.call(fsPromisesMethods_1);
              } finally {
                if (e_5) throw e_5.error;
              }
            }
            try {
              for (var _e = __values2(SPECIAL_METHODS.values()), _f = _e.next(); !_f.done; _f = _e.next()) {
                var method = _f.value;
                this[method] = this[method].bind(this);
              }
            } catch (e_6_1) {
              e_6 = { error: e_6_1 };
            } finally {
              try {
                if (_f && !_f.done && (_d = _e.return)) _d.call(_e);
              } finally {
                if (e_6) throw e_6.error;
              }
            }
          }
          Union2.prototype.use = function(fs2) {
            var e_16, _a2;
            this.fss.push(fs2);
            try {
              for (var ADDITIONAL_PROPERTIES_1 = __values2(ADDITIONAL_PROPERTIES), ADDITIONAL_PROPERTIES_1_1 = ADDITIONAL_PROPERTIES_1.next(); !ADDITIONAL_PROPERTIES_1_1.done; ADDITIONAL_PROPERTIES_1_1 = ADDITIONAL_PROPERTIES_1.next()) {
                var prop = ADDITIONAL_PROPERTIES_1_1.value;
                this[prop] = fs2[prop];
              }
            } catch (e_16_1) {
              e_16 = { error: e_16_1 };
            } finally {
              try {
                if (ADDITIONAL_PROPERTIES_1_1 && !ADDITIONAL_PROPERTIES_1_1.done && (_a2 = ADDITIONAL_PROPERTIES_1.return)) _a2.call(ADDITIONAL_PROPERTIES_1);
              } finally {
                if (e_16) throw e_16.error;
              }
            }
            return this;
          };
          Union2.prototype.syncMethod = function(method, args) {
            var lastError = null;
            for (var i = this.fss.length - 1; i >= 0; i--) {
              var fs2 = this.fss[i];
              try {
                if (!fs2[method])
                  throw Error('Method not supported: "'.concat(method, '" with args "').concat(args, '"'));
                return fs2[method].apply(fs2, args);
              } catch (err) {
                err.prev = lastError;
                lastError = err;
                if (!i) {
                  throw err;
                } else {
                }
              }
            }
          };
          Union2.prototype.asyncMethod = function(method, args) {
            var _this = this;
            var lastarg = args.length - 1;
            var cb = args[lastarg];
            if (typeof cb !== "function") {
              cb = null;
              lastarg++;
            }
            var lastError = null;
            var iterate = function(i, err) {
              if (i === void 0) {
                i = 0;
              }
              if (err) {
                err.prev = lastError;
                lastError = err;
              }
              if (i >= _this.fss.length) {
                if (cb)
                  cb(err || Error("No file systems attached."));
                return;
              }
              args[lastarg] = function(err2) {
                if (err2)
                  return iterate(i + 1, err2);
                if (cb)
                  cb.apply(cb, arguments);
              };
              var j = _this.fss.length - i - 1;
              var fs2 = _this.fss[j];
              var func = fs2[method];
              if (!func)
                iterate(i + 1, Error("Method not supported: " + method));
              else
                func.apply(fs2, args);
            };
            iterate();
          };
          Union2.prototype.promiseMethod = function(method, args) {
            return __awaiter2(this, void 0, void 0, function() {
              var lastError, i, theFs, promises, err_2;
              return __generator2(this, function(_a2) {
                switch (_a2.label) {
                  case 0:
                    lastError = null;
                    i = this.fss.length - 1;
                    _a2.label = 1;
                  case 1:
                    if (!(i >= 0)) return [3, 6];
                    theFs = this.fss[i];
                    promises = theFs.promises;
                    _a2.label = 2;
                  case 2:
                    _a2.trys.push([2, 4, , 5]);
                    if (!promises || !promises[method]) {
                      throw Error('Promise of method not supported: "'.concat(String(method), '" with args "').concat(args, '"'));
                    }
                    return [4, promises[method].apply(promises, args)];
                  case 3:
                    return [2, _a2.sent()];
                  case 4:
                    err_2 = _a2.sent();
                    err_2.prev = lastError;
                    lastError = err_2;
                    if (!i) {
                      throw err_2;
                    } else {
                    }
                    return [3, 5];
                  case 5:
                    i--;
                    return [3, 1];
                  case 6:
                    return [
                      2
                      /*return*/
                    ];
                }
              });
            });
          };
          return Union2;
        })()
      );
      exports.Union = Union;
    }
  });

  // node_modules/unionfs/lib/index.js
  var require_lib10 = __commonJS({
    "node_modules/unionfs/lib/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.ufs = exports.Union = void 0;
      var union_1 = require_union();
      exports.Union = union_1.Union;
      exports.ufs = new union_1.Union();
      exports.default = exports.ufs;
    }
  });

  // node_modules/linkfs/lib/index.js
  var require_lib11 = __commonJS({
    "node_modules/linkfs/lib/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var path_1 = require_path_browserify();
      exports.props = [
        "constants",
        "F_OK",
        "R_OK",
        "W_OK",
        "X_OK",
        "Stats"
      ];
      exports.rewritableMethods = [
        "accessSync",
        "access",
        "appendFileSync",
        "appendFile",
        "chmodSync",
        "chmod",
        "chownSync",
        "chown",
        "createReadStream",
        "createWriteStream",
        "existsSync",
        "exists",
        "lchmodSync",
        "lchmod",
        "lchownSync",
        "lchown",
        "linkSync",
        "link",
        "lstatSync",
        "lstat",
        "mkdirSync",
        "mkdir",
        "mkdtempSync",
        "mkdtemp",
        "openSync",
        "open",
        "readdirSync",
        "readdir",
        "readFileSync",
        "readFile",
        "readlinkSync",
        "readlink",
        "realpathSync",
        "realpath",
        "renameSync",
        "rename",
        "rmdirSync",
        "rmdir",
        "statSync",
        "stat",
        "symlinkSync",
        "symlink",
        "truncateSync",
        "truncate",
        "unlinkSync",
        "unlink",
        "unwatchFile",
        "utimesSync",
        "utimes",
        "watch",
        "watchFile",
        "writeFileSync",
        "writeFile"
      ];
      exports.proxyableMethods = [
        "ftruncateSync",
        "fchownSync",
        "fchmodSync",
        "fstatSync",
        "closeSync",
        "futimesSync",
        "fsyncSync",
        "writeSync",
        "readSync",
        "fdatasyncSync",
        "ftruncate",
        "fchown",
        "fchmod",
        "fstat",
        "close",
        "futimes",
        "fsync",
        "write",
        "read",
        "fdatasync",
        "_toUnixTimestamp"
      ];
      function link2(fs2, rewrites) {
        if (!(rewrites instanceof Array))
          throw TypeError("rewrites must be a list of 2-tuples");
        if (typeof rewrites[0] === "string")
          rewrites = [rewrites];
        var rews = [];
        for (var _i = 0, _a = rewrites; _i < _a.length; _i++) {
          var _b = _a[_i], from = _b[0], to = _b[1];
          rews.push([path_1.resolve(from), path_1.resolve(to)]);
        }
        var lfs = {};
        for (var _c = 0, props_1 = exports.props; _c < props_1.length; _c++) {
          var prop = props_1[_c];
          lfs[prop] = fs2[prop];
        }
        var _loop_1 = function(method2) {
          var func2 = fs2[method2];
          if (typeof func2 !== "function")
            return "continue";
          lfs[method2] = function() {
            var args = [];
            for (var _i2 = 0; _i2 < arguments.length; _i2++) {
              args[_i2] = arguments[_i2];
            }
            var path2 = args[0];
            if (typeof path2 !== "string" && !Buffer.isBuffer(path2)) {
              if (!(init_url(), __toCommonJS(url_exports)).URL || !(path2 instanceof (init_url(), __toCommonJS(url_exports)).URL))
                return func2.apply(fs2, args);
            }
            var filename = path_1.resolve(String(path2));
            var _loop_2 = function(from3, to3) {
              if (filename.indexOf(from3) === 0) {
                var rootRegex = /(?:^[a-zA-Z]:\\$)|(?:^\/$)/;
                var isRoot = from3.match(rootRegex);
                var baseRegex = "^(" + from3.replace(/\\/g, "\\\\") + ")";
                if (isRoot) {
                  var regex = new RegExp(baseRegex);
                  filename = filename.replace(regex, function() {
                    return to3 + path_1.sep;
                  });
                } else {
                  var regex = new RegExp(baseRegex + "(\\\\|/|$)");
                  filename = filename.replace(regex, function(match, p1, p2) {
                    return to3 + p2;
                  });
                }
              }
            };
            for (var _a2 = 0, rews_1 = rews; _a2 < rews_1.length; _a2++) {
              var _b2 = rews_1[_a2], from2 = _b2[0], to2 = _b2[1];
              _loop_2(from2, to2);
            }
            args[0] = filename;
            return func2.apply(fs2, args);
          };
        };
        for (var _d = 0, rewritableMethods_1 = exports.rewritableMethods; _d < rewritableMethods_1.length; _d++) {
          var method = rewritableMethods_1[_d];
          _loop_1(method);
        }
        for (var _e = 0, proxyableMethods_1 = exports.proxyableMethods; _e < proxyableMethods_1.length; _e++) {
          var method = proxyableMethods_1[_e];
          var func = fs2[method];
          if (typeof func !== "function")
            continue;
          lfs[method] = func.bind(fs2);
        }
        return lfs;
      }
      exports.link = link2;
    }
  });

  // src/index.js
  var import_buffer = __toESM(require_buffer(), 1);
  var import_memfs = __toESM(require_lib9(), 1);
  var import_unionfs = __toESM(require_lib10(), 1);
  var import_linkfs = __toESM(require_lib11(), 1);
  var import_path = __toESM(require_path_browserify(), 1);
  if (!globalThis.Buffer) globalThis.Buffer = import_buffer.Buffer;
  var MUTATING = /* @__PURE__ */ new Set([
    "open",
    "openSync",
    "write",
    "writeSync",
    "writev",
    "writevSync",
    "writeFile",
    "writeFileSync",
    "appendFile",
    "appendFileSync",
    "mkdir",
    "mkdirSync",
    "mkdtemp",
    "mkdtempSync",
    "rm",
    "rmSync",
    "rmdir",
    "rmdirSync",
    "unlink",
    "unlinkSync",
    "rename",
    "renameSync",
    "copyFile",
    "copyFileSync",
    "symlink",
    "symlinkSync",
    "link",
    "linkSync",
    "truncate",
    "truncateSync",
    "ftruncate",
    "ftruncateSync",
    "chmod",
    "chmodSync",
    "lchmod",
    "lchmodSync",
    "chown",
    "chownSync",
    "lchown",
    "lchownSync",
    "utimes",
    "utimesSync",
    "lutimes",
    "lutimesSync",
    "fchmod",
    "fchmodSync",
    "fchown",
    "fchownSync",
    "futimes",
    "futimesSync",
    "createWriteStream"
  ]);
  function readOnly(volume) {
    const deny = () => {
      const err = new Error("EPERM: operation not permitted, base image is read-only");
      err.code = "EPERM";
      throw err;
    };
    return new Proxy(volume, {
      get(target, key) {
        if (typeof key === "string" && MUTATING.has(key)) return deny;
        return Reflect.get(target, key);
      }
    });
  }
  var base = readOnly(import_memfs.Volume.fromJSON(globalThis.__fernbox_image ?? {}));
  var writable = new import_memfs.Volume();
  import_unionfs.ufs.use(base).use(writable);
  var REDIRECTS = ["/tmp", "/var/tmp"].map((p) => [p, `/writable${p}`]);
  for (const [, target] of REDIRECTS) {
    writable.mkdirSync(target, { recursive: true });
  }
  var fs = (0, import_linkfs.link)(import_unionfs.ufs, REDIRECTS);
  function write(target, data) {
    const resolved = resolveRedirect(target);
    const dir = import_path.default.posix.dirname(resolved);
    if (dir !== "/" && !writable.existsSync(dir)) {
      writable.mkdirSync(dir, { recursive: true });
    }
    writable.writeFileSync(resolved, data);
    return byteLength(data);
  }
  function resolveRedirect(target) {
    for (const [from, to] of REDIRECTS) {
      if (target === from) return to;
      if (target.startsWith(`${from}/`)) return `${to}${target.slice(from.length)}`;
    }
    return target;
  }
  function byteLength(text) {
    let n = 0;
    for (const ch of text) {
      const c = ch.codePointAt(0);
      n += c < 128 ? 1 : c < 2048 ? 2 : c < 65536 ? 3 : 4;
    }
    return n;
  }
  function read(target) {
    try {
      return fs.readFileSync(target, "utf8");
    } catch (err) {
      if (err?.code === "ENOENT") return null;
      throw err;
    }
  }
  function list() {
    const out = [];
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        const p = dir === "/" ? `/${name}` : `${dir}/${name}`;
        out.push(p);
        if (fs.statSync(p).isDirectory()) walk(p);
      }
    };
    walk("/");
    return out.join("\n");
  }
  globalThis.__fernbox = {
    fsRead: (p) => read(p),
    fsWrite: (p, data) => write(p, data),
    fsList: () => list(),
    // The network layer is split along the boundary between what is virtual and
    // what is real. The hosts table is filesystem state, so it is read here, in
    // the virtual fs, fresh on every call — a write to /etc/hosts changes what
    // the next fetch resolves. The connection is Rust, on the other side of
    // __fernbox_net, because a socket must never exist in this context.
    httpFetch: (url, optionsJson) => __fernbox_net.fetch(read("/etc/hosts") ?? "", url, optionsJson)
  };
  globalThis.__fernbox_secret = "SYSTEM_CONTEXT_CANARY";
})();
