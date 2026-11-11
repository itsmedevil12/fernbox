// The `zlib` builtin: present, but without an inflator behind it.
//
// `body-parser` requires this module at load time and only calls it when a
// request arrives with `Content-Encoding`; the same is true of most middleware.
// Shipping pako to satisfy that would add a large amount of boot-time code for
// a path that is already bounded by the gate's body cap, so the calls refuse
// with a named error instead of pretending.
export const constants = {
  Z_NO_FLUSH: 0,
  Z_PARTIAL_FLUSH: 1,
  Z_SYNC_FLUSH: 2,
  Z_FULL_FLUSH: 3,
  Z_FINISH: 4,
  Z_BLOCK: 5,
  Z_DEFAULT_COMPRESSION: -1,
  Z_DEFAULT_STRATEGY: 0,
  Z_FILTERED: 1,
  Z_HUFFMAN_ONLY: 2,
  Z_RLE: 3,
  Z_FIXED: 4,
};

function unsupported(name) {
  const err = new Error(`ERR_ZLIB_UNSUPPORTED: zlib.${name} is not available in the sandbox`);
  err.code = "ERR_ZLIB_UNSUPPORTED";
  return err;
}

const refuse = (name) => () => {
  throw unsupported(name);
};

export const inflate = refuse("inflate");
export const inflateSync = refuse("inflateSync");
export const deflate = refuse("deflate");
export const deflateSync = refuse("deflateSync");
export const gzip = refuse("gzip");
export const gzipSync = refuse("gzipSync");
export const gunzip = refuse("gunzip");
export const gunzipSync = refuse("gunzipSync");
export const brotliCompress = refuse("brotliCompress");
export const brotliDecompress = refuse("brotliDecompress");
export const createGunzip = refuse("createGunzip");
export const createInflate = refuse("createInflate");
export const createGzip = refuse("createGzip");
export const createDeflate = refuse("createDeflate");
export const createBrotliDecompress = refuse("createBrotliDecompress");
export const createBrotliCompress = refuse("createBrotliCompress");

export default {
  constants,
  inflate,
  inflateSync,
  deflate,
  deflateSync,
  gzip,
  gzipSync,
  gunzip,
  gunzipSync,
  brotliCompress,
  brotliDecompress,
  createGunzip,
  createInflate,
  createGzip,
  createDeflate,
  createBrotliDecompress,
  createBrotliCompress,
};
