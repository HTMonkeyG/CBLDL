const { PreprocessToken, PreprocessLexer } = require("./lexer");

class PreprocessContext {
  /**
   * @param {PreprocessToken} token 
   * @param {PreprocessLexer} lexer 
   */
  constructor(token, lexer) {
    this.token = token;
    this.lexer = lexer;

    this.slice = token.fileSlice;
    this.fileName = token.fileName;
    this.lineNumber = token.line;
    this.columnNumber = token.column;
  }

  getFileLineCol() {
    var r = "";
    r += `${this.fileName}:`;
    r += `${this.lineNumber + 1}:${this.columnNumber + 1}:`;
    return r
  }

  getContext(indent) {
    var r;
    indent = indent || 0;
    r = "".padEnd(indent, " ");
    r += this.slice.getParentLine(this.lineNumber - this.slice.parentLine);
    r += "\n" + "".padEnd(this.columnNumber + indent, " ");
    r += "^".padEnd(this.token.end - this.token.begin, "~");
    return r
  }

  toString() {

  }
}

class PreprocessError extends Error {
  constructor(msg, context, type) {
    super("error: " + msg);
    this.context = context;
    this.type = type;
  }
}

class PreprocessWarning extends Error {
  constructor(msg, context, type) {
    super("warning: " + msg);
    this.context = context;
    this.type = type;
  }
}

class SimplePreprocessErrorBuilder {
  /**
   * @param {Function} construct 
   * @param {string} message 
   */
  constructor(construct, message) {
    this.construct = construct;
    this.message = message;
  }

  create(context) {
    var r = ""
      , s = "";
    if (!(context instanceof PreprocessContext))
      context = null;
    else {
      r = context.getFileLineCol();
      s = context.getContext(1)
    }
    return new this.construct(r + " " + this.message + "\n" + s, context, this)
  }
}

class DynamicPreprocessErrorBuilder {
  /**
   * @param {Function} construct 
   * @param {string} message 
   */
  constructor(construct, message) {
    this.construct = construct;
    this.message = message;
  }

  create(context, ...arg) {
    var r, s;
    if (!(context instanceof PreprocessContext))
      context = null;
    else {
      r = context.getFileLineCol();
      s = context.getContext(1)
    }
    return new this.construct(r + " " + this.message(...arg) + "\n" + s, context, this)
  }
}

const BuiltinPreprocessError = Object.freeze({
  UNEXPECTED: new DynamicPreprocessErrorBuilder(PreprocessError, token => "unexpected \"" + token.content + "\"."),
  UNEXPECTED_LF: new SimplePreprocessErrorBuilder(PreprocessError, "unexpected line feeding."),
  NOT_FOUND: new DynamicPreprocessErrorBuilder(PreprocessError, file => "file \"" + file + "\" not found."),
  NESTING_OVF: new SimplePreprocessErrorBuilder(PreprocessError, "include nesting overflow.")
});

exports.PreprocessContext = PreprocessContext;
exports.PreprocessError = PreprocessError;
exports.PreprocessWarning = PreprocessWarning;
exports.SimplePreprocessErrorBuilder = SimplePreprocessErrorBuilder;
exports.DynamicPreprocessErrorBuilder = DynamicPreprocessErrorBuilder;
exports.BuiltinPreprocessError = BuiltinPreprocessError;
