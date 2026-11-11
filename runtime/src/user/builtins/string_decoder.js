// The `string_decoder` builtin. `raw-body` and stream consumers instantiate
// StringDecoder to turn body chunks back into text.
import stringDecoder from "string_decoder";

export const StringDecoder = stringDecoder.StringDecoder;

export default stringDecoder;
