// The `url` builtin: the legacy `parse`/`format`/`resolve` surface frameworks
// such as Express reach through `parseurl`, plus `URL` and `URLSearchParams`,
// which Node also exposes as globals.
//
// The legacy functions come from the browserify `url` polyfill; the WHATWG
// classes come from `whatwg-url`, because the legacy package has no `URL` at
// all and the isolate has no Web APIs of its own. Same classes as the globals
// `index.js` installs, so a URL built here and one an app builds are the same.
import url from "url";
import { URL, URLSearchParams } from "whatwg-url";

export const parse = url.parse;
export const format = url.format;
export const resolve = url.resolve;
export { URL, URLSearchParams };

// Node calls this `urlToHttpOptions`; it is what request-building code uses to
// turn a URL into host/port/path options.
export function urlToHttpOptions(input) {
  const options = {
    protocol: input.protocol,
    hostname: input.hostname.startsWith("[") ? input.hostname.slice(1, -1) : input.hostname,
    hash: input.hash,
    search: input.search,
    pathname: input.pathname,
    path: `${input.pathname ?? ""}${input.search ?? ""}`,
    href: input.href,
  };
  if (input.port) options.port = Number(input.port);
  if (input.username || input.password) {
    options.auth = `${decodeURIComponent(input.username)}:${decodeURIComponent(input.password)}`;
  }
  return options;
}

export default {
  parse,
  format,
  resolve,
  URL,
  URLSearchParams,
  urlToHttpOptions,
};
