// The `querystring` builtin, from querystring-es3. Express's query middleware
// prefers `qs`, but dependencies still import this one.
import querystring from "querystring";

export const parse = querystring.parse;
export const stringify = querystring.stringify;
export const escape = querystring.escape;
export const unescape = querystring.unescape;

export default querystring;
