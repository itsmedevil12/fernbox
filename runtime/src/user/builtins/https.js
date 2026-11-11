// The `https` builtin: the http module's shape with TLS refused at the door.
//
// There is no TLS transport in the sandbox. The gate's listening socket is
// plain HTTP, and the fetch chokepoint speaks HTTP to virtual hosts; a TLS
// server here would either lie about its protocol or fail at the first
// handshake. So the module exists, because dependency trees require it by
// name, and the calls that would need a handshake refuse with a named error.
import * as http from "./http.js";

function unsupported(name) {
  const err = new Error(
    `ERR_TLS_UNSUPPORTED: https.${name} needs TLS, and the sandbox's transport is plain HTTP`,
  );
  err.code = "ERR_TLS_UNSUPPORTED";
  return err;
}

export class Agent extends http.Agent {
  constructor(options = {}) {
    super(options);
    this.protocol = "https:";
  }
}

export const globalAgent = new Agent({ keepAlive: true });

export class Server extends http.Server {
  constructor() {
    throw unsupported("createServer");
  }
}

export function createServer() {
  throw unsupported("createServer");
}

export function request() {
  throw unsupported("request");
}

export function get() {
  throw unsupported("get");
}

export const STATUS_CODES = http.STATUS_CODES;
export const METHODS = http.METHODS;

export default {
  Agent,
  globalAgent,
  Server,
  createServer,
  request,
  get,
  STATUS_CODES,
  METHODS,
};
