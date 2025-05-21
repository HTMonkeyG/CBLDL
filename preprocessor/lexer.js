const FileSlice = require("./slice.js");

class PreprocessToken {
  static Type = {
    TOKEN: 0,
    WORD: 1,
    HASH: 2,
    STRING: 3
  };

  /**
   * @param {number} type 
   * @param {string} content 
   * @param {number} begin 
   * @param {number} end 
   * @param {FileSlice} fileSlice 
   * @param {number} line 
   * @param {number} column 
   * @param {boolean} first 
   */
  constructor(type, content, begin, end, fileSlice, line, column, first) {
    /** Token type. */
    this.type = type;

    /** Token string. */
    this.content = content;

    /** Begin position in file. */
    this.begin = begin;
    /** End position in file. */
    this.end = end;

    /** File name. */
    this.fileName = fileSlice.file;
    /** FileSlice object the token from. */
    this.fileSlice = fileSlice;
    /** Line number in the complete file. */
    this.line = line;
    /** Column number in the line. */
    this.column = column;
    /** The first token in the line. */
    this.first = !!first;
  }

  toString() {
    return `<${this.content}> L${this.line} P${this.begin}-${this.end}`
  }
}

class PreprocessLexer {
  static getLineOf(lexer, line) {
    return lexer.original.split("\n")[line]
  }

  /**
   * @param {FileSlice|string} input 
   */
  constructor(input) {
    if (!(input instanceof FileSlice))
      input = FileSlice.fromFile("", input, 0);

    this.original = input;
    this.currentFile = input;
    // Convert input to an char array, in order to support unicode.
    this.string = Array.from(this.currentFile.content);
    this.line = this.column = this.columnEnd = 0;
    this.cursor = -1;
    this.readingVaniCmd = 0;
    this.peek = " ";
    this.begin = 0;
    this.isFirstInLine = 1;
    this.look = void 0;
  }

  buildToken(type, content) {
    var r = new PreprocessToken(
      type,
      content,
      this.begin,
      this.begin + content.length,
      this.currentFile,
      this.line + this.currentFile.parentLine,
      this.column,
      this.isFirstInLine
    );
    // Once you build a token from this line, the next token(s) won't be the
    // first token in the line.
    this.isFirstInLine = 0;
    this.look = r;
    return r
  }

  done() {
    return this.cursor >= this.string.length && !this.currentFile.next
  }

  isUnquotedStringStart() {
    return /[\p{ID_Start}]/u.test(this.peek)
  }

  isUnquotedString() {
    return /[\p{ID_Continue}]/u.test(this.peek)
  }

  isWhitespace() {
    return /[\u0009\u000B\u000C\uFEFF\p{Space_Separator}]/u.test(this.peek)
  }

  readch(c) {
    if (this.cursor >= this.string.length && this.currentFile.next) {
      // Switch to next file.
      this.currentFile = this.currentFile.next;
      this.cursor = -1;
      this.line = this.column = this.columnEnd = 0;
      this.peek = " ";
      this.string = Array.from(this.currentFile.content);
    }

    if (!this.done()) {
      this.cursor++;
      this.columnEnd++;
      this.peek = this.string[this.cursor];
      if (this.peek != c)
        return false;
      this.peek = " ";
      return true
    }
  }

  isch(c) {
    if (this.peek != c)
      return false;
    this.peek = " ";
    return true
  }

  skipWhitespace() {
    for (; !this.done(); this.readch()) {
      if (this.isWhitespace())
        continue;
      else if (this.peek == "\n") {
        this.line++;
        // It will consider "\n" as the first element in the line because of
        // the trailing this.readch() function, so we need to set the column
        // counter to -1, set the character after "\n" as the first character.
        this.columnEnd = this.column = -1;
        this.isFirstInLine = 1
      } else
        return;
    }
  }

  /**
   * Skip current line.
   */
  skipLine() {
    while (!this.peek != "\n")
      this.readch();
  }

  /**
   * Scan next token.
   * @returns {PreprocessToken}
   */
  scan() {
    this.skipWhitespace();
    if (this.done())
      return void 0;

    // Start reading, record current cursor.
    this.begin = this.cursor;
    this.column = this.columnEnd;

    // Read tokens.
    switch (this.peek) {
      case '&':
        if (this.readch('&'))
          return this.buildToken(0, "&&");
        return this.buildToken(0, '&');
      case '|':
        if (this.readch('|'))
          return this.buildToken(0, "||");
        return this.buildToken(0, '|');
      case '=':
        if (this.readch('='))
          return this.buildToken(0, "==");
        if (this.isch('>'))
          return this.buildToken(0, "=>");
        return this.buildToken(0, '=');
      case '!':
        if (this.readch('='))
          return this.buildToken(0, "!=");
        return this.buildToken(0, '!');
      case '<':
        if (this.readch('='))
          return this.buildToken(0, "<=");
        return this.buildToken(0, '<');
      case '>':
        if (this.readch('='))
          return this.buildToken(0, ">=");
        return this.buildToken(0, '>');
      case '-':
        if (this.readch('>'))
          return this.buildToken(0, "->");
        else if (this.isch('-'))
          return this.buildToken(0, "--");
        else if (this.isch('='))
          return this.buildToken(0, "-=");
        return this.buildToken(0, '-');
      case '+':
        if (this.readch('+'))
          return this.buildToken(0, "++");
        else if (this.isch('='))
          return this.buildToken(0, "+=");
        return this.buildToken(0, '+');
      case '*':
        if (this.readch('='))
          return this.buildToken(0, "*=");
        return this.buildToken(0, '*');
      case '/':
        if (this.readch('='))
          return this.buildToken(0, "/=");
        return this.buildToken(0, '/');
      case '%':
        if (this.readch('='))
          return this.buildToken(0, "%=");
        return this.buildToken(0, '%');
    }
    // Read identifier.
    if (this.isUnquotedStringStart()) {
      var b = this.readStringUnquoted();
      return this.buildToken(1, b);
    }
    // Read number.
    if (/\d/.test(this.peek))
      return this.buildToken(0, this.readNumber());
    // Read connector `##` in macro or preprocessor statement.
    if (this.peek == "#") {
      if (this.readch("#"))
        return this.buildToken(0, "##");
      return this.buildToken(2, "#" + this.readStringUnquoted())
    }
    // Read vanilla Minecraft command literal.
    if (this.peek == "`" && !this.readingVaniCmd)
      return this.buildToken(0, this.readVaniCmd());
    if (this.peek == "}" && this.readingVaniCmd)
      return this.buildToken(0, this.readVaniCmd());
    // Read string literal.
    if (this.peek == '"')
      return this.buildToken(3, "\"" + this.readStringUntil('"') + "\"");
    // Read selector literal.
    if (this.peek == '@')
      return this.buildToken(0, "@" + this.readStringUnquoted());
    if (this.done())
      return Token.EOF;
    // Unknown token.
    var t = this.buildToken(0, this.peek);
    this.peek = " ";
    return t
  }

  /**
   * Implements JS iterator.
   * @returns
   */
  next() {
    var d = this.done();
    return {
      value: this.scan(),
      done: d
    }
  }

  readNumber() {
    var o = "";
    do {
      o += this.peek;
      this.readch()
    } while (/\d/.test(this.peek))
    if (this.peek != ".")
      return o;
    o += ".";
    for (; !this.done();) {
      this.readch();
      if (!/\d/.test(this.peek))
        break;
      o += this.peek;
    }
    return o
  }

  readStringUntil(terminator) {
    var result = ""
      , escaped = false;
    while (!this.done()) {
      this.readch();
      if (escaped) {
        if (this.peek == "n")
          result += "\n";
        else
          result += peek;
        escaped = false;
      } else if (this.peek == "\\")
        escaped = true;
      else if (this.peek == terminator)
        return this.readch(), result;
      else
        result += this.peek;
    }
  }

  readStringUnquoted() {
    var result = "";
    if (!this.isUnquotedStringStart())
      return "";
    result += this.peek;
    while (!this.done()) {
      this.readch();
      if (!this.isUnquotedString())
        break;
      result += this.peek;
    }
    return result
  }

  readVaniCmd() {
    var result = ""
      , escaped = !1;
    result += this.readingVaniCmd ? "}" : "`";
    this.readingVaniCmd = true;
    while (!this.done()) {
      this.readch();
      if (escaped) {
        if (this.peek == "n")
          result += "\n";
        else
          result += this.peek;
        escaped = !1;
      } else if (this.peek == "\\")
        escaped = !0;
      else if (this.peek == "$") {
        this.readch();
        if (this.peek == "{") {
          this.readch();
          return result + "${";
        }
        result += "$" + this.peek;
      } else if (this.peek == "`") {
        this.readch();
        this.readingVaniCmd = false;
        return result + "`";
      } else
        result += this.peek;
    }
  }
}

exports.PreprocessLexer = PreprocessLexer;
exports.PreprocessToken = PreprocessToken;