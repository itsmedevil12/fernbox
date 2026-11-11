// The `tls` builtin: present so a dependency can require it, honest about
// having nothing behind it. TLS needs a real socket, and the sandbox has none.
import events from "events";

const { EventEmitter } = events;

export class TLSSocket extends EventEmitter {
  constructor(socket) {
    super();
    this._socket = socket;
    this.encrypted = true;
    this.authorized = false;
    this.authorizationError = new Error("TLS is not available in the sandbox");
    this.remoteAddress = socket?.remoteAddress;
    this.remotePort = socket?.remotePort;
  }

  getPeerCertificate() {
    return {};
  }

  destroy(error) {
    this._socket?.destroy?.(error);
    return this;
  }
}

function unsupported(name) {
  const err = new Error(`ERR_TLS_UNSUPPORTED: tls.${name} cannot be used in the sandbox`);
  err.code = "ERR_TLS_UNSUPPORTED";
  return err;
}

export function createServer() {
  throw unsupported("createServer");
}

export function connect() {
  throw unsupported("connect");
}

export const createConnection = connect;

export function createSecureContext() {
  return {};
}

export default { TLSSocket, createServer, connect, createConnection, createSecureContext };
