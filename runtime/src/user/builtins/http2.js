// The `http2` builtin: present so a dependency that imports it at load time
// keeps running, empty behind the import because HTTP/2 is a framing the
// sandbox's gate does not speak. The shapes are here; a call that would open a
// session refuses by name.
export function unsupported(name) {
  const err = new Error(
    `ERR_HTTP2_UNSUPPORTED: http2.${name} is not available; the sandbox serves HTTP/1.1`,
  );
  err.code = "ERR_HTTP2_UNSUPPORTED";
  return err;
}

const refuse = (name) => () => {
  throw unsupported(name);
};

export const createServer = refuse("createServer");
export const createSecureServer = refuse("createSecureServer");
export const connect = refuse("connect");

// Node's marker for headers a caller marks as sensitive; code that sets it on
// a header object only needs the symbol to exist.
export const sensitiveHeaders = Symbol("nodejs.http2.sensitiveHeaders");

export const constants = {
  NGHTTP2_HEADER_STATUS: ":status",
  NGHTTP2_HEADER_METHOD: ":method",
  NGHTTP2_HEADER_PATH: ":path",
  NGHTTP2_HEADER_AUTHORITY: ":authority",
  NGHTTP2_HEADER_SCHEME: ":scheme",
  NGHTTP2_NO_ERROR: 0,
  NGHTTP2_PROTOCOL_ERROR: 1,
  NGHTTP2_INTERNAL_ERROR: 2,
  NGHTTP2_FLOW_CONTROL_ERROR: 3,
  NGHTTP2_SETTINGS_TIMEOUT: 4,
  NGHTTP2_STREAM_CLOSED: 5,
  NGHTTP2_CANCEL: 8,
  NGHTTP2_REFUSED_STREAM: 7,
  NGHTTP2_ENHANCE_YOUR_CALM: 11,
};

export class Http2ServerRequest {
  constructor() {
    throw unsupported("Http2ServerRequest");
  }
}

export class Http2ServerResponse {
  constructor() {
    throw unsupported("Http2ServerResponse");
  }
}

export default {
  createServer,
  createSecureServer,
  connect,
  sensitiveHeaders,
  constants,
  Http2ServerRequest,
  Http2ServerResponse,
};
