const pl = require("path")
  , { PreprocessLexer, PreprocessToken } = require("./lexer.js")
  , { PreprocessContext, BuiltinPreprocessError } = require("./errors.js")
  , FileInterface = require("./file.js")
  , FileSlice = require("./slice.js");

/**
 * Discard comments and replace them with an equal number of blank lines.
 * @param {FileSlice} file - Input file.
 */
function discardComment(file) {
  var input = file.content
    , state = 0
    , line = ""
    , cursor = 0
    , result = "";

  // Normalize line feed to LF.
  input = input.replace(/\r\n/g, "\n");
  // Replace single line comments.
  input = input.replace(/\/\/.*\r?\n/g, "\n");

  // Replace block comments to empty lines.
  while (cursor < input.length) {
    if (!state && input[cursor] == "/" && input[cursor + 1] == "*") {
      state = 1;
      line = "";
      cursor++;
    } else if (state == 1) {
      if (input[cursor] == "\n")
        line += "\n";
      else if (input[cursor] == "*" && input[cursor + 1] == "/") {
        state = 0;
        result += line;
        cursor++;
      }
    } else if (!state)
      result += input[cursor];
    cursor++;
  }

  file.content = result;

  return file
}

/**
 * Process `#include` statement, combine the included files to a single
 * `FileSlice` object.
 * @param {FileSlice} input - Input content processed by `discardComment()`.
 * @param {string[]} paths - Include paths.
 * @param {FileInterface} fileInterface - File accessor.
 * @param {number} nesting - Nesting count.
 * @returns
 */
function processInclude(input, paths, fileInterface, nesting) {
  function move() {
    look = lexer.scan()
  }

  function lookForFile(f) {
    // Find given file through FileInterface.
    for (var p of paths) {
      p = pl.join(p, f);
      if (!fileInterface.existSync(p))
        continue;
      return p
    }
    return void 0
  }

  function seek(f) {
    for (; ; f = f.next)
      if (!f.next)
        return f
  }

  var lexer = new PreprocessLexer(input)
    // The processed FileSlice chain.
    , result = FileSlice.copy(input)
    // The FileSlice contains the remain part of input file.
    , remain = result
    , errors = []
    , look, last, filePath, foundFile, file
    , combineResult, e;

  nesting = nesting || 0;
  paths.unshift("./");
  for (move(); look; move()) {
    // Preprocess statement must be the first token of a line.
    if (look.type != PreprocessToken.Type.HASH || look.content != "#include" || !look.first)
      continue;

    // Restore the `#include` token, and scan next one.
    last = look;
    move();

    // File name and `#include` must in the same line.
    if (look.type != PreprocessToken.Type.STRING) {
      // Encountered unexpected token, skip current line.
      errors.push(BuiltinPreprocessError.UNEXPECTED.create(new PreprocessContext(look, lexer), look));
      lexer.skipLine();
      continue
    } else if (look.line != last.line) {
      errors.push(BuiltinPreprocessError.UNEXPECTED_LF.create(new PreprocessContext(look, lexer)));
      continue
    }

    // Remove the quotes.
    filePath = look.content.slice(1, look.content.length - 1);
    // Find the included file in the paths.
    foundFile = lookForFile(filePath);

    if (nesting > 15) {
      // If nesting overflowed, instantly stop processing.
      errors.push(BuiltinPreprocessError.NESTING_OVF.create(new PreprocessContext(last, lexer)));
      break
    }
    if (!foundFile) {
      // If file not found, skip this `#include`.
      errors.push(BuiltinPreprocessError.NOT_FOUND.create(new PreprocessContext(look, lexer), filePath));
      continue
    }

    // Replace `#include` statement with the given file.
    remain.clear(look.line - remain.parentLine);
    file = discardComment(FileSlice.fromFile(filePath, fileInterface.readFileSync(foundFile)));
    combineResult = processInclude(file, paths, nesting + 1);

    // Insert the included file to the input.
    remain.insert(
      // Insert after the empty line replaced `#include`.
      look.line + 1 - remain.parentLine,
      combineResult.value
    );
    errors = errors.concat(combineResult.errors);
    e = combineResult.errors.at(-1);
    if (e && e.type == BuiltinPreprocessError.NESTING_OVF)
      // If the nesting overflow is firstly thrown in the file just processed,
      // it will be the last error in the array. We need to instantly stop
      // processing when the overflow is encountered.
      break;
    // After the insert operation, the remain part will be pushed to the last
    // FileSlice in the chain. So we need to seek to the remain part.
    remain = seek(remain);
  }

  return {
    value: result,
    errors: errors
  }
}

class PreprocessParser {
  static processInclude = processInclude;
  static discardComment = discardComment;

  /**
   * @param {FileSlice} fileSlice 
   * @param {string[]} includePaths 
   * @param {FileInterface} fileInterface 
   */
  constructor(fileSlice, includePaths, fileInterface) {
    var combined = processInclude(discardComment(fileSlice), includePaths, fileInterface);

    this.input = combined.value;
    this.lexer = new PreprocessLexer(this.input);
    this.look = null;
    this.includes = [];
    this.errors = combined.errors;
    this.warnings = [];
    this.macros = new Map();

    this.move();
  }

  move() {
    this.look = this.lexer.scan();
  }

  match(t) {
    if (this.look.content == t)
      this.move();
    else
      throw new PreprocessError("Unexpected token.");
  }

  parse() {
    this.processInclude();
  }
}

module.exports = PreprocessParser;