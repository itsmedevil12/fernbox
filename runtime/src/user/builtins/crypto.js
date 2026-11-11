// The `crypto` builtin: hashes and HMACs, which is what web middleware uses
// (ETags, cookie signing). The full crypto-browserify bundle would pull in
// public-key code a request path never runs, at a large boot cost, so the hash
// primitives are imported directly.
//
// There is no entropy source in the sandbox: `randomBytes` refuses instead of
// quietly returning Math.random, because a predictable session secret is worse
// than a clear error.
import createHashImpl from "create-hash";
import createHmacImpl from "create-hmac";

export function createHash(algorithm, options) {
  return createHashImpl(algorithm, options);
}

export function createHmac(algorithm, key, options) {
  return createHmacImpl(algorithm, key, options);
}

export function getHashes() {
  return ["md5", "rmd160", "sha1", "sha224", "sha256", "sha384", "sha512"];
}

function noEntropy(function_) {
  const err = new Error(
    `ERR_CRYPTO_NO_ENTROPY: ${function_} needs a secure random source, and the sandbox has none`,
  );
  err.code = "ERR_CRYPTO_NO_ENTROPY";
  return err;
}

export function randomBytes(size, callback) {
  if (typeof callback === "function") {
    const err = noEntropy("crypto.randomBytes");
    process.nextTick(() => callback(err));
    return undefined;
  }
  throw noEntropy("crypto.randomBytes");
}

export function randomFillSync() {
  throw noEntropy("crypto.randomFillSync");
}

export function randomUUID() {
  throw noEntropy("crypto.randomUUID");
}

export function timingSafeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    const err = new Error("Input buffers must have the same byte length");
    err.code = "ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH";
    throw err;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export const constants = {};
export const webcrypto = undefined;

export default {
  createHash,
  createHmac,
  getHashes,
  randomBytes,
  randomFillSync,
  randomUUID,
  timingSafeEqual,
  constants,
};
