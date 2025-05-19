class PreprocessToken {
  static Type = {
    Token: 0,
    Word: 1,
    Hash: 2,
    String: 3
  };

  constructor(type, content, begin, end, line) {
    this.type = type;
    this.content = content;
    this.begin = begin;
    this.end = end;
    this.line = line;
  }

  toString() {
    return `<${this.content}> L${this.line} P${this.begin}-${this.end}`
  }
}

class PreprocessLexer {
  static getLineOf(lexer, line) {
    return lexer.original.split("\n")[line - 1]
  }

  constructor(input) {
    this.original = input;
    // Convert input to an char array, in order to support unicode.
    this.input = Array.from(input);
    this.line = this.offsetInLine = 0;
    this.cursor = -1;
    this.readingVaniCmd = 0;
    this.peek = " ";
    this.begin = 0;
    this.isFirstInLine = 1;
  }

  buildToken(type, content) {
    return new PreprocessToken(type, content, this.begin, this.begin + content.length, this.line)
  }

  done() {
    return this.cursor >= this.input.length
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
    if (!this.done()) {
      this.cursor++;
      this.peek = this.input[this.cursor];
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
      else if (this.peek == "\n")
        this.line++, this.offsetInLine = 0, this.isFirstInLine = 1;
      else
        return;
    }
  }

  /**
   * Scan next token.
   * @returns 
   */
  scan() {
    this.skipWhitespace();
    if (this.done())
      return void 0;

    // Start reading, record current cursor.
    this.begin = this.cursor;

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
      return this.buildToken(this.isFirstInLine ? 2 : 0, "#" + this.readStringUnquoted())
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
    this.isFirstInLine = 0;
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