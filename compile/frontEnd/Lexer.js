import {
  Token,
  NumericLiteral,
  SelectorLiteral,
  StringLiteral,
  VaniCmdLiteral,
  Word,
  Type,
  ExecuteSubcommand
} from "./Token.js";
import { TokenTag } from "../utils/Enums.js";

/**
 * Lexer analyzer
 * @param {String} s - Input program string 
 */
function Lexer(s) {
  function readNext() {
    if (ptr > str.length) throw new Error("String Ends");
    return str[ptr++]
  }
  function canRead() { return ptr <= str.length }
  function reserve(w) { words.set(w.lexeme, w) }
  function readch(c) {
    peek = readNext();
    if (peek != c) return !1;
    peek = " ";
    return !0
  }
  function isch(c) { if (peek != c) return !1; peek = " "; return !0 }
  function skipWhitespace() {
    for (; canRead(); readch()) {
      if (peek === ' ' || peek === "\t") continue;
      else if (peek === "\n") line += 1;
      else break;
    }
  }
  function scan() {
    skipWhitespace();
    if (!canRead()) return Token.EOF;

    switch (peek) {
      case '&':
        if (readch('&')) return Word.and;
        else return new Token('&');
      case '|':
        if (readch('|')) return Word.or;
        else return new Token('|');
      case '=':
        if (readch('=')) return Word.eq;
        if (isch('>')) return Word.ae;
        else return new Token('=');
      case '!':
        if (readch('=')) return Word.ne;
        else return new Token('!');
      case '<':
        if (readch('=')) return Word.le;
        else return new Token('<');
      case '>':
        if (readch('=')) return Word.ge;
        else return new Token('>');
      case '-':
        if (readch('>')) return Word.gs;
        else if (isch('-')) return new Token("--");
        else if (isch('=')) return new Token("-=");
        else return new Token('-');
      case '+':
        if (readch('+')) return new Token("++");
        else if (isch('=')) return new Token("+=");
        else return new Token('+');
      case '*':
        if (readch('=')) return new Token("*=");
        else return new Token('*');
      case '/':
        if (readch('=')) return new Token("/=");
        else return new Token('/');
      case '%':
        if (readch('=')) return new Token("%=");
        else return new Token('%');
    }
    if (isUnquotedStringStart()) {
      var b = readStringUnquoted();
      var w = words.get(b);
      if (w != void 0) return w;
      w = new Word(b, TokenTag.ID);
      words.set(b, w);
      return w
    }
    if (/\d/.test(peek)) return readNumber();
    if (peek == "`" && !readingVaniCmd) {
      var t = readVaniCmd();
      if (!readingVaniCmd)
        return new VaniCmdLiteral(t);
      else
        return new VaniCmdLiteral(t, TokenTag.VANICMDHEAD);
    }
    if (peek == "}" && readingVaniCmd) {
      var t = readVaniCmd();
      if (!readingVaniCmd)
        return new VaniCmdLiteral(t, TokenTag.VANICMDTAIL);
      else
        return new VaniCmdLiteral(t, TokenTag.VANICMDBODY);
    }
    if (peek == '"') return new StringLiteral(readStringUntil('"'));
    if (peek == '@') return readSelector();
    if (!canRead()) return Token.EOF;
    var t = new Token(peek);
    peek = " ";
    return t
  }

  function readNumber() {
    var v = 0;
    do {
      v = 10 * v + Number(peek);
      readch()
    } while (/\d/.test(peek))
    if (peek != ".") return new NumericLiteral(v);
    var x = v, d = 10;
    for (; canRead();) {
      readch();
      if (!/\d/.test(peek)) break;
      x += Number(peek) / d;
      d *= 10;
    }
    return new NumericLiteral(x)
  }

  function readStringUntil(terminator) {
    var result = ""
      , escaped = false;
    while (canRead()) {
      readch();
      if (escaped) {
        if (peek == "n") {
          result += "\n";
        } else {
          result += peek;
        }
        escaped = false;
      } else if (peek == "\\") {
        escaped = true;
      } else if (peek == terminator) {
        readch();
        return result;
      } else {
        result += peek;
      }
    }
  }

  function isUnquotedStringStart() {
    //return /[a-z$A-Z_\u4e00-\u9fa5]/.test(peek)
    //return !/[\ ~`!@#%\^&\*\(\)\-=+\|\\'":;\?\/\.><,\[\]\}\{0-9]/.test(peek)
    //return !/[\ -#%-@\[-\^`\{-\~]/.test(peek)
    return /[\p{ID_Start}]/u.test(peek)
  }

  function isUnquotedString() {
    //return /[a-z0-9$A-Z_\u4e00-\u9fa5]/.test(peek)
    //return !/[\ ~`!@#%\^&\*\(\)\-=+\|\\'":;\?\/\.><,\[\]\}\{]/.test(peek)
    //return !/[\ -#%-\/:-@\[-\^`\{-\~]/.test(peek)
    return /[\p{ID_Continue}]/u.test(peek)
  }

  function readStringUnquoted() {
    var result = "";
    if (!isUnquotedStringStart()) return "";
    result += peek;
    while (canRead()) {
      readch();
      if (!isUnquotedString()) break;
      result += peek;
    }
    return result
  }

  function readSelector() {
    var v = "@", s;
    if (peek == '@') {
      readch();
      v += s = readStringUnquoted();
    }

    if (!s)
      return new Token('@');

    if (peek != "[") return new SelectorLiteral(v);
    else {
      v += "[" + readStringUntil("]") + "]";
      return new SelectorLiteral(v);
    }
  }

  function readVaniCmd() {
    var result = ""
      , escaped = !1;
    readingVaniCmd = !0;
    while (canRead()) {
      readch();
      if (escaped) {
        if (peek == "n")
          result += "\n";
        else
          result += peek;
        escaped = !1;
      } else if (peek == "\\")
        escaped = !0;
      else if (peek == "$") {
        readch();
        if (peek == "{") {
          readch();
          return result;
        }
        result += "$" + peek;
      } else if (peek == "`") {
        readch();
        readingVaniCmd = !1;
        return result;
      } else
        result += peek;
    }
  }

  var words = new Map()
    , str = s.replace(/\r\n?/g, "\n").replace(/(\/\*(.|\r?\n)*\*\/)|(\/\/.*\r?\n)/g, "") // Ignore comments
    , ptr = 0
    , peek = " "
    , line = 1
    , readingVaniCmd = !1;

  /* Reserved words */
  reserve(ExecuteSubcommand.If);
  reserve(new Word("else", TokenTag.ELSE));
  reserve(new Word("while", TokenTag.WHILE));
  reserve(new Word("do", TokenTag.DO));
  reserve(new Word("break", TokenTag.BREAK));
  reserve(new Word("chain", TokenTag.CHAIN));
  reserve(new Word("pulse", TokenTag.PULSE));
  reserve(new Word("repeating", TokenTag.REPEATING));
  reserve(new Word("module", TokenTag.MODULE));
  reserve(new Word("execute", TokenTag.EXECUTE));
  reserve(new Word("delayh", TokenTag.DELAYH));
  reserve(new Word("initial", TokenTag.INITIAL));
  reserve(new Word("delete", TokenTag.DELETE));
  reserve(Word.False);
  reserve(Word.True);
  reserve(Type.Const);
  reserve(Type.Var);
  reserve(ExecuteSubcommand.Align);
  reserve(ExecuteSubcommand.As);
  reserve(ExecuteSubcommand.At);
  reserve(ExecuteSubcommand.In);
  reserve(ExecuteSubcommand.Positioned);
  reserve(ExecuteSubcommand.Unless);
  reserve(ExecuteSubcommand.Anchored);
  reserve(ExecuteSubcommand.Facing);
  reserve(ExecuteSubcommand.Rotated);

  this.scan = scan;
  this.getLine = function () { return line };
}

export { Lexer };