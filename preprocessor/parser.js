const fs = require("fs")
  , pl = require("path")
  , { PreprocessLexer, PreprocessToken } = require("./lexer.js")
  , { PreprocessWarning, PreprocessError } = require("./exceptions.js")
  , FileSlice = require("./slice.js");

class Include {
  constructor(file, content, parentLine) {
    this.file = file || "";
    this.content = content || "";
    this.parentLine = parentLine || 0;
    this.includes = [];
  }

  gen() {
    var r = this.content.split("\n");
    for (var i = this.includes.length - 1; i >= 0; i--)
      r[this.includes[i].parentLine] = this.includes[i].gen();
    return r.join("\n")
  }
}

/**
 * Discard comments and replace them with an equal number of blank lines.
 * @param {string} input - Input content.
 */
function discardComment(input) {
  var state = 0
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

  return result
}

/**
 * Process `#include` statement.
 * @param {FileSlice} input - Input content processed by `discardComment()`.
 * @param {string[]} paths - Include paths.
 * @param {number} nesting - Nesting count.
 * @returns {FileSlice}
 */
function processInclude(input, paths, nesting) {
  function move() {
    look = lexer.scan()
  }

  function lookForFile(f) {
    for (var p of paths) {
      p = pl.join(p, f);
      if (!fs.existsSync(p) || fs.statSync(p).isDirectory())
        continue;
      return p
    }
    return void 0
  }

  var lexer = new PreprocessLexer(input)
    , result = FileSlice.copy(input)
    , look, last, filePath, file;

  nesting = nesting || 0;
  if (nesting > 128)
    throw new PreprocessError("Nesting overflow.");
  paths.unshift("./");
  move();
  while (look) {
    if (look.type == PreprocessToken.Type.Hash && look.content == "#include") {
      last = look;
      move();
      // File name and `#include` must in the same line.
      if (look.type == PreprocessToken.Type.String && look.line == last.line) {
        // Remove the quotes.
        filePath = look.content.slice(1, look.content.length - 1);
        // Find the included file in the paths.
        filePath = lookForFile(filePath);
        if (!filePath)
          throw new PreprocessError("File not found.");

        // Replace `#include` statement with the given file.
        result.clear(look.line);
        file = FileSlice.fromFile(
          filePath,
          discardComment(fs.readFileSync(filePath, "utf-8")),
          0
        );
        result.insert(
          look.line,
          processInclude(file, paths, nesting + 1)
        )
      } else
        throw new PreprocessError("Unexpected token.");
    }
    move();
  }
  return result
}

class PreprocessParser {
  constructor(input) {
    this.input = discardComment(input);
    this.lexer = new PreprocessLexer(this.input);
    this.look = null;
    this.includes = [];
    this.warnings = [];
    this.defines = new Map();

    this.move();
  }

  move() {
    this.look = this.lexer.scan();
  }

  match(t) {
    if (this.look.content == t)
      this.move();
    else
      throw new Error();
  }

  parse() {
    this.processInclude();
  }

  processInclude() {

  }
}

console.log(
  processInclude(
    FileSlice.fromFile(
      "./preprocessor/test/a.hlcl",
      discardComment(fs.readFileSync("./preprocessor/test/a.hlcl", "utf-8")),
      0
    )
    , ["./preprocessor/test"]
  ) + ""
)

module.exports = PreprocessParser;