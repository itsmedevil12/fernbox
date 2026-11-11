// `worker_threads`: the main-thread shapes, and a refusal for the rest.
//
// A run has exactly one thread. Libraries load this module to decide whether
// they are already on a worker (`isMainThread`); pino does that for its
// transport stream. Nothing here can start a second thread — the isolate is
// the run — so constructing a `Worker` is refused with a precise code rather
// than pretending a thread started.
export const isMainThread = true;
export const parentPort = null;
export const workerData = null;
export const threadId = 0;
export const SHARE_ENV = Symbol("worker_threads.SHARE_ENV");

function unsupported(what) {
  const err = new Error(`${what} is not available in the sandbox: a run has one thread`);
  err.code = "ERR_WORKER_UNSUPPORTED";
  return err;
}

export class Worker {
  constructor() {
    throw unsupported("worker_threads.Worker");
  }
}

export class MessageChannel {
  constructor() {
    throw unsupported("worker_threads.MessageChannel");
  }
}

export class MessagePort {
  constructor() {
    throw unsupported("worker_threads.MessagePort");
  }
}

export class BroadcastChannel {
  constructor() {
    throw unsupported("worker_threads.BroadcastChannel");
  }
}

export function receiveMessageOnPort() {
  return undefined;
}

export function getEnvironmentData() {
  return undefined;
}

export function setEnvironmentData() {}

export default {
  isMainThread,
  parentPort,
  workerData,
  threadId,
  SHARE_ENV,
  Worker,
  MessageChannel,
  MessagePort,
  BroadcastChannel,
  receiveMessageOnPort,
  getEnvironmentData,
  setEnvironmentData,
};
