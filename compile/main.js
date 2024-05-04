/**
 * HLCL Compiler
 * For CBLDL Specification v1.0
 * By HTMonkeyG
 * Bilibili & GitHub: HTMonkeyG
 * 
 * Reference: 
 *   Alfred V. Aho, Ravi Sethi, Jeffrey D. Ullman.
 *   Compilers: Principles, Techniques, and Tools. 2nd ed.
 */

"use strict";

const Tag = {
  AND: 256,
  BASIC: 257,
  BREAK: 258,
  DO: 259,
  ELSE: 260,
  EQ: 261,
  FALSE: 262,
  GE: 263,
  ID: 264,
  IF: 265,
  INDEX: 266,
  LE: 267,
  MINUS: 268,
  NE: 269,
  NUM: 270,
  OR: 271,
  TEMP: 273,
  TRUE: 274,
  WHILE: 275,
  VANICMD: 276,
  STRING: 277,
  SELECTOR: 278,
  CHAIN: 279,
  PULSE: 280,
  REPEATING: 281,
  MODULE: 282,
  GS: 283,
  AE: 284,
  EXECUTE: 285,
  DELAYH: 286,
  VANICMDHEAD: 287,
  VANICMDBODY: 288,
  VANICMDTAIL: 289,
  LF: 0xFFFE,
  EOF: 0xFFFF
};

const ExprTag = {
  EXPR: 0x8000,
  ARITH: 0x8001,
  GS: 0x8002,
  SELECTOR: 0x8003,
  CONST: 0x8004,
  UNARY: 0x8005,
  REF: 0x8006,
  VANICMD: 0x8008,
  ASSIGN: 0x8009,
  ASSICOMP: 0x800A,
  PREF: 0x800B,
  POSTF: 0x800C,
  REL: 0x800D,
  NOT: 0x800E,
  OR: 0x800E,
  AND: 0x800F
};

const Mode = { CP: 0, CR: 1, M: 2, DECL: 3 };

class Token { constructor(t) { this.tag = t; this.uid = Token.uid++ } toString() { return this.tag } static uid = 0; static EOF = new Token(Tag.EOF) }
class NumericLiteral extends Token { constructor(v) { super(Tag.NUM); this.value = v } toString() { return this.value.toString() } }
class StringLiteral extends Token { constructor(v) { super(Tag.STRING); this.value = v } toString() { return '"' + this.value + '"' } }
class VaniCmdLiteral extends Token { constructor(v, t) { super(t ? t : Tag.VANICMD); this.cmd = v } toString() { return this.cmd } }
class SelectorLiteral extends Token { constructor(v) { super(Tag.SELECTOR); this.value = v } toString() { return this.value } }
class HashTable { constructor() { this.KV = {} } put(k, v) { this.KV[k] = v; } get(k) { return this.KV[k] } }

class Word extends Token {
  constructor(s, t) { super(t); this.lexeme = s }
  toString() { return this.lexeme }
  static and = new Word("&&", Tag.AND);
  static or = new Word("||", Tag.OR);
  static eq = new Word("==", Tag.EQ);
  static ne = new Word("!=", Tag.NE);
  static le = new Word("<=", Tag.LE);
  static ge = new Word(">=", Tag.GE);
  static gs = new Word("->", Tag.GS);
  static ae = new Word("=>", Tag.AE);
  static minus = new Word("minus", Tag.MINUS);
  static True = new Word("true", Tag.TRUE);
  static False = new Word("false", Tag.FALSE);
  static temp = new Word("t", Tag.TEMP);
}

class Type extends Word {
  constructor(s, tag, w) {
    super(s, tag);
    this.width = w;
  }

  static Int = new Type("int", Tag.BASIC, 4);
  static Bool = new Type("bool", Tag.BASIC, 1);
  static String = new Type("string", Tag.BASIC, 0);
  static Vector = new Type("vec", Tag.BASIC, 0);
  static Selector = new Type("sel", Tag.BASIC, 0);

  static numeric(p) {
    if (p == Type.Int || p == Type.Vector) return !0;
    else return !1
  }

  // 类型转换
  static max(p1, p2) {
    if (p1 == p2) return p1;
    else if (p1 == Type.Int && p2 == Type.Vector) return Type.Int;
    else if (p2 == Type.Int && p1 == Type.Vector) return Type.Int;
    else if (p1 == Type.Selector && p2 == Type.Vector) return Type.Int;
    else if (p2 == Type.Selector && p1 == Type.Vector) return Type.Int;
    else if (p1 == Type.Int && p2 == Type.Selector) return Type.Int;
    else if (p2 == Type.Int && p1 == Type.Selector) return Type.Int;
    else return void 0;
  }

  // 类型转换
  static toBoolean(x) {
    if (x.type == Type.Int || x.type == Type.Vector || x.type == Type.Selector)
      return new Rel(Word.ne, x, new Constant(new NumericLiteral(0)))
    else return x;
  }
}

var Lexer = function () {
  function readNext() {
    if (ptr > str.length) throw new Error("String Ends");
    return str[ptr++]
  }
  function canRead() { return ptr <= str.length }
  function reserve(w) { words.put(w.lexeme, w) }
  function readch(c) {
    peek = readNext();
    if (peek != c) return !1;
    peek = " ";
    return !0
  }
  function isch(c) { if (peek != c) return !1; peek = " "; return !0 }
  function scan() {
    // 跳过空白
    for (; canRead(); readch()) {
      if (peek === ' ' || peek === "\t") continue;
      else if (peek === "\n") line += 1;
      else break;
    }

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
      w = new Word(b, Tag.ID);
      words.put(b, w);
      return w
    }
    if (/\d/.test(peek)) return readNumber();
    if (peek == "`" && !readingVaniCmd) {
      var t = readVaniCmd();
      if (!readingVaniCmd)
        return new VaniCmdLiteral(t);
      else
        return new VaniCmdLiteral(t, Tag.VANICMDHEAD);
    }
    if (peek == "}" && readingVaniCmd) {
      var t = readVaniCmd();
      if (!readingVaniCmd)
        return new VaniCmdLiteral(t, Tag.VANICMDTAIL);
      else
        return new VaniCmdLiteral(t, Tag.VANICMDBODY);
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
    return /[a-zA-Z_\u4e00-\u9fa5]/.test(peek)
  }

  function readStringUnquoted() {
    var result = "";
    if (!isUnquotedStringStart()) return "";
    result += peek;
    while (canRead()) {
      readch();
      if (!/[a-zA-Z0-9_\u4e00-\u9fa5]/.test(peek)) break;
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

  var words = new HashTable()
    , str = ""
    , ptr = 0
    , peek = " "
    , line = 1
    , readingVaniCmd = !1;
  function init(s) {
    words = new HashTable(),
      str = s,
      ptr = 0,
      peek = " ",
      line = 1;
    /* Reserved words */
    reserve(new Word("if", Tag.IF));
    reserve(new Word("else", Tag.ELSE));
    reserve(new Word("while", Tag.WHILE));
    reserve(new Word("do", Tag.DO));
    reserve(new Word("break", Tag.BREAK));
    reserve(new Word("chain", Tag.CHAIN));
    reserve(new Word("pulse", Tag.PULSE));
    reserve(new Word("repeating", Tag.REPEATING));
    reserve(new Word("module", Tag.MODULE));
    reserve(new Word("execute", Tag.EXECUTE));
    reserve(new Word("delayh", Tag.DELAYH));
    reserve(Word.False);
    reserve(Word.True);
    reserve(Type.Int);
    reserve(Type.Bool);
    reserve(Type.String);
    reserve(Type.Selector);
    reserve(Type.Vector);
  }

  return {
    scan: scan,
    init: init,
    getLine() { return line }
  }
}();

class Env {
  constructor(n) {
    this.table = new HashTable();
    this.prev = n;
  }

  put(w, i) { this.table.put(w.uid, i) }

  get(w) {
    for (var i = this; i != void 0; i = i.prev) {
      var found = i.table.get(w.uid);
      if (found != void 0) return found;
    }
    return void 0
  }
}

class CB {
  constructor(cmd) { this.cmd = cmd; this.rsctl = !0; this.condition = !0; this.type = 0 }
  setCondition(t) { this.condition = t }
  setRedstone(t) { this.redstone = t }
  setType(t) { this.type = t }
  static commandblocks = [];
  static scb = "bkstage";
  static emit(c) { CB.commandblocks.push(c) }
  static emitCmd(c) { return new CB(c) }
  static emitScb(e1, o1, op, e2, o2) {
    var t = "";
    // scb ply op <dest> <obj1> <op> <victim> <obj2>
    if (e2 && o2) t = `scb ply op ${e1} ${o1} ${op} ${e2} ${o2}`;
    // seb ply <add|set> <victim> <obj>
    else if (e2) t = `scb ply ${op} ${e1} ${o1} ${e2}`;
    CB.commandblocks.push(new CB(t))
  }
}
class CBSubChain extends Array {
  constructor() { }
}
class TACBaseBlock extends Array {
  constructor(id) { super(); this.chain = []; this.id = id }
  gen() {
    for (var k of this)
      if (k.type == "assign" || k.type == "assigncomp") k.gen();
    this.chain = CB.commandblocks;
    CB.commandblocks = [];
  }
}
class TAC extends Array { constructor(m) { super(); this.mode = m } }
class TACInst { constructor(t) { this.type = t; this.lastWrite = []; this.lastRead = [] } }
class TACLabel extends TACInst { constructor(n) { super("label"); this.label = n; this.onUse = []; this.baseblock = null } mark(i) { this.onUse.push(i) } }
class TACDelayH extends TACInst { constructor(t) { super("delayh"); this.delay = t } }
class TACGoto extends TACInst { constructor(l, c, t) { super(void 0); if (c == 1) this.type = "if", this.expr = t, this.label = l; else if (c == 2) this.type = "iffalse", this.expr = t, this.label = l; else this.type = "goto", this.label = l; } }
class TACVanilla extends TACInst {
  constructor(c) { super("vanilla"); this.cmd = c }
  gen(c) { c.push(CB.emitCmd(this.cmd)) }
}
class TACAssign extends TACInst {
  constructor(i, e, o) { super(void 0); if (o) this.type = "assigncomp", this.id = i, this.expr = e, this.op = o; else this.type = "assign", this.id = i, this.expr = e; }
  gen(c) {
    function assignReg(v) { if (!v.reg && v.tag == ExprTag.REF) RegisterAssign.getReg(v); }
    var x1 = this.id, x2 = this.expr;
    if (this.type == "assign") {
      var x21, x22;
      switch (x2.tag) {
        case ExprTag.CONST: case ExprTag.GS:
          assignReg(x1);
          console.log(`SET ${x1} ${x2}`);
          break;
        case ExprTag.REF:
          if (x2.lastRead == Inst) RegisterAssign.releaseReg(x2);
          assignReg(x1);
          x1.reg != x2.reg && console.log(`OP ${x1} = ${x2}`);
          break;
        case ExprTag.SELECTOR:
          assignReg(x1);
          console.log(`SET ${x1} 0`);
          console.log(`VANI \`execute ${x2} ~~~ scb ply add ${x1} 1\``);
          break;
        case ExprTag.ARITH:
          assignReg(x1);
          x21 = x2.expr1, x22 = x2.expr2;
          if (x21.tag == ExprTag.REF)
            x1.reg != x21.reg && console.log(`OP ${x1} = ${x21}`);
          else if (x21.tag == ExprTag.CONST)
            console.log(`SET ${x1} ${x21.op}`);
          else if (x21.tag == ExprTag.GS)
            console.log(`OP ${x1} = ${x2}`);
          if ((x22.tag & ~0x01) == ExprTag.REF)
            console.log(`OP ${x1} ${x2.op.tag}= ${x22}`);
          else if (x22.tag == ExprTag.CONST)
            console.log(`OP ${x1} ${x2.op.tag}= ${x22.op}`);
          if (x21.lastRead == this) RegisterAssign.releaseReg(x21);
          if (x22.lastRead == this) RegisterAssign.releaseReg(x22);
          break;
        case "++":
          assignReg(x1);
          console.log(`ADD ${x1} 1`);
          break;
        case "--":
          assignReg(x1);
          console.log(`ADD ${x1} -1`);
          break;
      }
    }
    else if (this.type == "assigncomp") {
      if (x1.tag == ExprTag.SELECTOR && x2.tag == ExprTag.CONST) {
        if (this.op.tag == '+=')
          console.log(`VANI \`tag ${x1} add ${x2}\``);
        else if (this.op.tag == '-=')
          console.log(`VANI \`tag ${x1} remove ${x2}\``);
      } else if (x1.tag == ExprTag.REF || x1.tag == ExprTag.GS) {
        assignReg(x1);
        console.log(`OP ${x1} ${this.op} ${x2}`);
        if (x2.lastRead == this) RegisterAssign.releaseReg(x2);
        if (x2.lastRead == this) RegisterAssign.releaseReg(x2);
      }
    }
  }
}

/** Abstract Syntax Tree Node */
class ASTNode {
  constructor() { this.lexline = Lexer.getLine(); this.labels = 0; }
  static labels = 0;
  /** Throw an error */
  error(s) { throw new Error("Near line " + this.lexline + ": " + s) }
  /** 
   * Assign a new label.
   * @returns {TACLabel} Label
   */
  newlabel() { return new TACLabel(++ASTNode.labels) }
  /** 
   * Gen a label as TAC.
   * @param {TACLabel} i - Label 
   */
  emitlabel(i) { Parser.appendObj(i) }
  emit(s) { Parser.append("\t" + s + "\n") }
  /**
   * Gen an if-goto.
   * @param {Expr} t - Condition
   * @param {TACLabel} l - Label 
   */
  emitif(t, l) { var i = new TACGoto(l, 1, t); l.mark(i); Parser.appendObj(i) }
  /**
   * Gen a direct goto.
   * @param {TACLabel} l - Label 
   */
  emitgoto(l) { var i = new TACGoto(l); l.mark(i); Parser.appendObj(i) }
  /**
   * Gen an iffalse-goto.
   * @param {Expr} t - Condition
   * @param {TACLabel} l - Label 
   */
  emitiffalse(t, l) { var i = new TACGoto(l, 2, t); l.mark(i); Parser.appendObj(i) }
  /** 
   * Gen a TAC operation.
   * @param {Id | GetScore} i - Condition
   * @param {Expr} e - Expression
   */
  emitassign(i, e) { Parser.appendObj(new TACAssign(i, e)) }
  /** 
   * Gen a TAC assigncomp.
   * @param {Id | GetScore} i - Condition
   * @param {Token} o - Operator
   * @param {Expr} e - Expression
   */
  emitassigncomp(i, o, e) { Parser.appendObj(new TACAssign(i, e, o)) }
  /** 
   * Gen a vanilla command.
   * @param {VanillaCmdNoTag} c - Command
   */
  emitvanilla(c) { Parser.appendObj(new TACVanilla(c)) }
  /** 
   * Gen a delay hard.
   * @param {NumericLiteral} t - Delay time
   */
  emitdelayh(t) { Parser.appendObj(new TACDelayH(t)) }
}

/** Statement implement. @extends Stmt */
class Stmt extends ASTNode {
  constructor() { super(); this.after = 0; this.useLabel = 0 }
  static Null = new Stmt();
  static Enclosing = Stmt.Null;
  /** 
   * Gen as a stmt.
   * @param {TACLabel} b - Label of this statement
   * @param {TACLabel} a - Label of next statement
   */
  gen(b, a) {/* Empty placeholder for child class */ }
}

/** If statement. @extends Stmt */
class If extends Stmt {
  /** 
   * @param {Expr} x - Condition expression
   * @param {Stmt} s - Statement
   */
  constructor(x, s) {
    super();
    this.useLabel = 1;
    this.expr = x;
    this.stmt = s;
    if (x.type != Type.Bool && x.type != Type.Selector) this.expr = Type.toBoolean(x);
  }
  gen(b, a) {
    var label = this.newlabel(); // stmt代码标号
    this.expr.jumping(0, a);     // 为真时控制流穿越, 否则转向a
    this.emitlabel(label);
    this.stmt.gen(label, a)
  }
}

/** If-Else statement. @extends Stmt */
class Else extends Stmt {
  /** 
   * @param {Expr} x - Condition expression
   * @param {Stmt} s1 - If statement
   * @param {Stmt} s2 - Else statement
   */
  constructor(x, s1, s2) {
    super();
    this.useLabel = 1;
    this.expr = x;
    this.stmt1 = s1;
    this.stmt2 = s2;
    if (x.type != Type.Bool && x.type != Type.Selector) this.expr = Type.toBoolean(x);
  }
  gen(b, a) {
    var label1 = this.newlabel()  // Label of stmt1
      , label2 = this.newlabel(); // Label of stmt2
    this.expr.jumping(0, label2); // Control flow cross to stmt1 when expr == true
    this.emitlabel(label1);
    this.stmt1.gen(label1, a)
    this.emitgoto(a);
    this.emitlabel(label2);
    this.stmt2.gen(label2, a)
  }
}

/** While statement. @extends Stmt */
class While extends Stmt {
  constructor() { super(); this.expr = null; this.stmt = null; this.useLabel = 1; }
  /** 
   * Initiate while node.
   * @param {Expr} x - Condition expression
   * @param {Stmt} s - Statement
   */
  init(x, s) {
    this.expr = x;
    this.stmt = s;
    if (x.type != Type.Bool && x.type != Type.Selector) this.expr = Type.toBoolean(x);
  }
  gen(b, a) {
    this.after = a;
    this.expr.jumping(0, a);
    var label = this.newlabel();
    this.emitlabel(label);
    this.stmt.gen(label, b);
    this.emitgoto(b)
  }
}

/** Do-While statement. @extends Stmt */
class Do extends Stmt {
  constructor() { super(); this.expr = void 0; this.stmt = void 0; this.useLabel = 1; }
  /** 
   * Initiate Do-While node.
   * @param {Stmt} s - Statement
   * @param {Expr} x - Condition expression
   */
  init(s, x) {
    this.expr = x;
    this.stmt = s;
    if (x.type != Type.Bool && x.type != Type.Selector) this.expr = Type.toBoolean(x);
  }
  gen(b, a) {
    this.after = a;
    var label = this.newlabel();
    this.stmt.gen(b, label);
    this.emitlabel(label);
    this.expr.jumping(b, 0);
  }
}

/** 
 * Statement sequence.
 * @extends Stmt 
 * Seq -> Stmt
 *      | Stmt Seq
 */
class Seq extends Stmt {
  /** 
   * @param {Stmt} s1 - Statement1
   * @param {Stmt} s2 - Statement2
   */
  constructor(s1, s2) {
    super();
    this.stmt1 = s1;
    this.stmt2 = s2;
  }

  gen(b, a) {
    if (this.stmt1 == Stmt.Null) this.stmt2.gen(b, a);
    else if (this.stmt2 == Stmt.Null) this.stmt1.gen(b, a);
    else {
      var label = this.newlabel();
      this.stmt1.gen(b, label);
      this.emitlabel(label);
      this.stmt2.gen(label, a);
    }
  }
}

/** Break statement. @extends Stmt */
class Break extends Stmt {
  constructor() {
    super();
    if (Stmt.Enclosing == Stmt.Null) this.error("Unenclosed break");
    this.stmt = Stmt.Enclosing;
  }

  gen(b, a) { this.emitgoto(this.stmt.after) }
}

/** Delay hard statement. @extends Stmt */
class DelayH extends Stmt { constructor(tok) { super(); this.delay = tok } gen(b, a) { this.emitdelayh(this.delay) } }

/** Expression implement. @extends Stmt */
class Expr extends Stmt {
  /**
   * Create a expression AST node.
   * @param {Token} t - Token representing the expression
   * @param {Type} p - Type of the expression
   */
  constructor(t, p) { super(); this.op = t; this.type = p; this.tag = ExprTag.EXPR }
  /** Gen as an inline expr, or as the right-hand-side of a TAC */
  genRightSide() { return this }
  /** Gen as a term in TAC, or an address */
  reduce() { return this }
  /**
   * Gen as a conditioned goto.
   * @param {TACLabel} t - Label of true
   * @param {TACLabel} f - Lable of false
   */
  jumping(t, f) { this.emitjumps(this, t, f) }
  /**
   * Gen as a conditioned goto.
   * @param {Expr} test - Condition
   * @param {TACLabel} t - Label of true
   * @param {TACLabel} f - Lable of false
   */
  emitjumps(test, t, f) {
    if (t != 0 && f != 0) {
      this.emitif(test, t);
      this.emitgoto(f)
    }
    else if (t != 0) this.emitif(test, t);
    else if (f != 0) this.emitiffalse(test, f);
    else; // t & f directly cross, no instruction generating.
  }
  toString() { return this.op.toString() }
}

/** Identifier implement. @extends Expr */
class Id extends Expr {
  /**
   * @param {Token} id - Token of the identifier
   * @param {Type} p - Type of the identifier
   * @param {Number} b - UID of the identifier
   */
  constructor(id, p, b) {
    super(id, p);
    this.offset = b;
    this.tag = ExprTag.REF;
    this.lastRead = null;
    this.lastWrite = null;
    this.value = null;
    this.reg = null
  }
  /* offset represents UID */
  toString(s) { if (!s) return this.reg.toString(); else return this.op.toString() }
  genRightSide() { if (this.type == Type.Int) return this; else return this.value }
  reduce() { if (this.type == Type.Int) return this; else return this.value }
}

/** Temp variable implement. @extends Expr */
class Temp extends Expr {
  /**
   * @param {Type} p - Type of temp
   */
  constructor(p) {
    super(Word.temp, p);
    this.number = ++Temp.count;
    this.tag = ExprTag.REF;
    this.lastRead = null;
    this.lastWrite = null;
    this.reg = null
  }
  toString(s) { if (!s) return this.reg.toString(); else return "t" + this.number }
}

/** Expression with an operator. @extends Expr */
class Op extends Expr {
  /**
   * @param {Token} tok - Token of the operator
   * @param {Type} p - Type of the expression
   */
  constructor(tok, p) { super(tok, p) }
  reduce() {
    var x = this.genRightSide()
      , t = new Temp(this.type);
    this.emitassign(t, x);
    return t
  }
}

/** Arith expression implement. @extends Op */
class Arith extends Op {
  /**
   * @param {Token} tok - Token of the operator
   * @param {Expr} x1 - Expression in the left side of operator
   * @param {Expr} x2 - Expression in the right side of operator
   */
  constructor(tok, x1, x2) {
    super(tok, void 0);
    this.expr1 = x1;
    this.expr2 = x2;
    this.type = Type.max(x1.type, x2.type);
    this.tag = ExprTag.ARITH;
    if (this.type == void 0) this.error("Type mismatch")
  }
  genRightSide() { return new Arith(this.op, this.expr1.reduce(), this.expr2.reduce()) }
  toString() { return this.expr1.toString() + " " + this.op.toString() + " " + this.expr2.toString() }
}

/** 
 * GetScore expression implement.
 * The usage of scoreboard in HLCL.
 * @extends Op
 */
class GetScore extends Op {
  /**
   * @param {Token} tok - Token of the operator
   * @param {Expr} x1 - Target
   * @param {Expr} x2 - Scoreboard object
   */
  constructor(tok, x1, x2) {
    super(tok, void 0);
    this.target = x1;
    this.scb = x2;
    this.type = Type.Vector;
    this.tag = ExprTag.GS;
    if (x1.type != Type.String && x1.type != Type.Selector) this.error("Type error: Target must be a string or selector, received: " + x1.type.lexeme);
    if (x2.type != Type.String) this.error("Type error: Scoreboard must be a string, recieved: " + x2.type.lexeme);
  }
  genRightSide() { return new GetScore(this.op, this.target.reduce(this.tag), this.scb.reduce()) }
  toString() { return this.target.toString() + " " + this.scb.toString() }
  /**
   * @param {Boolean} a - Only CompoundAssign uses this param.
   * 
   * When param a == ExprTag.ASSICOMP, then reduce() acts the same as genRightSide()
   */
  reduce(a) {
    var x = this.genRightSide()
      , t;
    if (a == ExprTag.ASSICOMP)
      return x
    else {
      t = new Temp(Type.Int);
      this.emitassign(t, x);
      return t
    }
  }
}

/** Unary expression implement. @extends Op */
class Unary extends Op {
  /**
   * @param {Token} tok - Token of the operator
   * @param {Expr} x - Expression
   */
  constructor(tok, x) {
    super(tok, void 0);
    this.expr = x;
    this.type = Type.max(Type.Int, x.type);
    this.tag = ExprTag.UNARY;
    if (this.type == void 0) this.error("Type mismatch")
  }
  genRightSide() {
    if (this.op == Word.minus)
      return new Arith(new Token('*'), new Constant(new NumericLiteral(-1)), this.expr.reduce());
    else
      return new Unary(this.op, this.expr.reduce())
  }
  toString() { return this.op.toString() + " " + this.expr.toString() }
}

/** Constant implement @extends Expr */
class Constant extends Expr {
  /**
   * @param {Token} a - Token of the constant
   * @param {Type} b - Type
   */
  constructor(a, b) {
    if (b) super(a, b);
    else super(a, Type.Int);
    this.tag = ExprTag.CONST
  }
  static True = new Constant(Word.True, Type.Bool);
  static False = new Constant(Word.False, Type.Bool);
  jumping(t, f) {
    if (this == Constant.True && t != 0) this.emitgoto(t);
    if (this == Constant.False && f != 0) this.emitgoto(f);
  }
  reduce(a) {
    if (this.type == Type.Int && !a) {
      var x = this.genRightSide()
        , t = new Temp(Type.Int);
      this.emitassign(t, x);
      return t
    } else return this
  }
}

/** Assignment implement. @extends Expr */
class AssignExpr extends Expr {
  /**
   * @param {Token} i - Identifier to be assigned
   * @param {Expr} x - Right-hand-side expression
   */
  constructor(i, x) {
    super(void 0, x.type);
    this.id = i;
    this.expr = x;
    if (this.check(i.type, x.type) == void 0) this.error("Type mismatch")
    this.tag = ExprTag.ASSIGN
  }
  /** Type check */
  check(l, r) {
    if (l == r) return r;
    else if (l == Type.Int && r == Type.Selector) return Type.Int;
    else if (l == Type.Vector && r == Type.Selector) return Type.Vector;
    else if (l == Type.Vector && r == Type.Int) return Type.Vector;
    else if (r == Type.Vector && l == Type.Int) return Type.Int;
    else if (l == Type.Selector && r == Type.String) return Type.Selector;
    else return void 0
  }
  gen() { this.genRightSide() }
  genRightSide() {
    if (this.id.type == Type.Int || this.id.tag == ExprTag.GS) {
      this.emitassign(this.id, this.expr.genRightSide());
      return this.id
    } else {
      return this.id.value = this.expr.genRightSide();
    }
  }
  toString() { return this.id.toString() + " = " + this.expr.toString() }
  reduce() { return this.genRightSide() }
}

/** Compound assignment implement. @extends AssignExpr */
class CompoundAssignExpr extends AssignExpr {
  /**
   * @param {Token} i - Identifier to be assigned
   * @param {Expr} x - Right-hand-side expression
   * @param {Token} op - Operator
   */
  constructor(i, x, op) { super(i, x); this.op = op; this.tag = ExprTag.ASSICOMP }
  genRightSide() {
    var x;
    if (this.id.type == Type.Selector && this.expr.type == Type.String) {
      x = this.expr.genRightSide();
      this.emitassigncomp(this.id, this.op, x);
      return x
    } else {
      this.emitassigncomp(this.id, this.op, this.expr.reduce(this.tag));
      return this.id
    }
  }
}

/** Prefix expression implement. @extends CompoundAssignExpr */
class Prefix extends CompoundAssignExpr {
  /**
   * @param {Token} i - Identifier to be assigned
   * @param {Token} op - Operator
   */
  constructor(i, op) {
    super(i, i, op);
    if (i.op.tag != Tag.ID)
      this.error("Invalid left-hand side expression in prefix operation");
    this.tag = ExprTag.PREF
  }
  genRightSide() { this.emitassign(this.id, this.op); return this.id }
}

/** 
 * Postfix expression implement.
 * Statement i++ behaves the same as ++i:
 * add 1 to i, then return the value of i
 * @extends CompoundAssignExpr
 */
class Postfix extends CompoundAssignExpr {
  /**
   * @param {Token} i - Identifier to be assigned
   * @param {Token} op - Operator
   */
  constructor(i, op) {
    super(i, i, op);
    if (i.op.tag != Tag.ID && i.op.tag != Tag.GS)
      this.error("Invalid left-hand side expression in postfix operation");
    this.tag = ExprTag.POSTF
  }
  genRightSide() { this.emitassign(this.id, this.op); return this.id }
}

/** Selector implement. @extends Expr */
class Selector extends Expr {
  /**
   * @param {Token} tok - Token of selector
   */
  constructor(tok) { super(tok, Type.Selector); this.sel = tok; this.tag = ExprTag.SELECTOR }
  /**
   * @param {Boolean} a - Only GetScore uses this param.
   * 
   * When param a == ExprTag.GS, then reduce() acts the same as genRightSide()
   */
  reduce(a) {
    if (a == ExprTag.GS) return this
    else {
      var t = new Temp(Type.Int);
      this.emitassign(t, this);
      return t
    }
  }
  jumping(t, f) { this.emitjumps(this, t, f) }
  toString() { return this.sel.toString() }
}

/** Logical expression implement. @extends Expr */
class Logical extends Expr {
  /**
   * @param {Token} tok - Token of operator
   * @param {Expr} x1 - Expression in the left side of operator
   * @param {Expr} x2 - Expression in the right side of operator
   */
  constructor(tok, x1, x2) {
    super(tok, void 0);
    this.expr1 = x1;
    this.expr2 = x2;
    this.type = this.check(x1.type, x2.type);
    if (this.type == void 0) this.error("Type error")
  }
  check(p1, p2) {
    if (p1 == Type.Bool && p2 == Type.Bool) return Type.Bool;
    else return void 0;
  }
  genRightSide() {
    var f = this.newlabel()
      , a = this.newlabel()
      , temp = new Temp(this.type);
    this.jumping(0, f);
    this.emitassign(temp, Constant.True);
    this.emitgoto(a);
    this.emitlabel(f);
    this.emit(temp, Constant.False);
    this.emitlabel(a);
    return temp
  }
  gen() { this.genRightSide() }
  toString() { return this.expr1.toString() + " " + this.op.toString() + " " + this.expr2.toString() }
}

/** Logical or implement. @extends Logical */
class Or extends Logical {
  /**
   * @param {Token} tok - Token of operator
   * @param {Expr} x1 - Expression in the left side of operator
   * @param {Expr} x2 - Expression in the right side of operator
   */
  constructor(tok, x1, x2) { super(tok, x1, x2); this.tag = ExprTag.OR }
  jumping(t, f) {
    var label = t != 0 ? t : this.newlabel();
    this.expr1.jumping(label, 0);
    this.expr2.jumping(t, f);
    if (t == 0) this.emitlabel(label)
  }
}

/** Logical and implement. @extends Logical */
class And extends Logical {
  /**
   * @param {Token} tok - Token of operator
   * @param {Expr} x1 - Expression in the left side of operator
   * @param {Expr} x2 - Expression in the right side of operator
   */
  constructor(tok, x1, x2) { super(tok, x1, x2); this.tag = ExprTag.AND }
  jumping(t, f) {
    var label = f != 0 ? f : this.newlabel();
    this.expr1.jumping(0, label);
    this.expr2.jumping(t, f);
    if (f == 0) this.emitlabel(label)
  }
}

/** Logical not implement. @extends Logical */
class Not extends Logical {
  /**
   * @param {Token} tok - Token of operator
   * @param {Expr} x2 - Expression
   */
  constructor(tok, x2) { super(tok, x2, x2); this.tag = ExprTag.NOT }
  jumping(t, f) { this.expr2.jumping(f, t); }
  toString() { return this.op.toString() + " " + this.expr2.toString() }
}

/** Comparison expression implement. @extends Logical */
class Rel extends Logical {
  /**
   * @param {Token} tok - Token of operator
   * @param {Expr} x1 - Expression in the left side of operator
   * @param {Expr} x2 - Expression in the right side of operator
   */
  constructor(tok, x1, x2) { super(tok, x1, x2); this.tag = ExprTag.REL }
  check(p1, p2) {
    if (p1 == p2) return Type.Bool;
    else if (p1 == Type.Selector && p2 == Type.Int) return Type.Bool;
    else if (p2 == Type.Selector && p1 == Type.Int) return Type.Bool;
    else return void 0
  }
  jumping(t, f) {
    var x1 = this.expr1.reduce(this.tag), x2 = this.expr2.reduce(this.tag);
    if (this.expr1.tag == ExprTag.CONST)
      this.emitjumps(new Rel(Rel.move(this.op), x2, x1), t, f);
    else this.emitjumps(new Rel(this.op, x1, x2), t, f);
  }
  static move(t) {
    switch (t.tag) {
      case "<":
        return new Token(">");
      case ">":
        return new Token("<");
      case "<=":
        return new Token(">=");
      case ">=":
        return new Token("<=");
    }
    return t
  }
}

/**
 * Vanilla command implement. 
 * Produces direct access to vanilla command in MCBE.
 * @extends Expr 
 */
class VanillaCmdNoTag extends Expr {
  /**
   * @param {Token} tok - Token of vanilla command
   */
  constructor(tok) { super(tok, Type.Bool); this.cmd = tok; this.tag = ExprTag.VANICMD }
  gen() { this.emitvanilla(this.cmd.toString()) }
  toString() { return this.cmd.toString() }
  genRightSide() {
    var f = this.newlabel()
      , a = this.newlabel()
      , temp = new Temp(this.type);
    this.jumping(0, f);
    this.emitassign(temp, Constant.True);
    this.emitgoto(a);
    this.emitlabel(f);
    this.emitassign(temp, Constant.False);
    this.emitlabel(a);
    return temp
  }
  reduce() { return this.genRightSide() }
}

/**
 * Tagged vanilla command.
 * Involve expressions in vanilla command
 * @extends Expr 
 */
class VanillaCmdTag extends Expr {
  /**
   * @param {Expr} x - Expression in this segment
   * @param {Token} tok - Token of this segment
   * @param {VanillaCmdTag} next - Next segment
   */
  constructor(x, tok, next) {
    super(tok, Type.Bool);
    this.expr = x;
    this.next = next;
    this.tag = ExprTag.VANICMD
  }
  gen() { this.emitvanilla(this.toAddr()) }
  jumping(t, f) { this.emitjumps(this.toAddr(), t, f) }
  toString() {
    var r = "";
    if (this.expr)
      r += this.expr.toString();
    r += this.op.toString();
    if (this.next)
      r += this.next.toString();
    return r
  }
  genRightSide() {
    var f = this.newlabel()
      , a = this.newlabel()
      , temp = new Temp(this.type);
    this.jumping(0, f);
    this.emitassign(temp, Constant.True);
    this.emitgoto(a);
    this.emitlabel(f);
    this.emitassign(temp, Constant.False);
    this.emitlabel(a);
    return temp
  }
  /** Reduce all expressions the vanilla cmd contains */
  toAddr() {
    var x, t;
    if (this.expr) x = this.expr.reduce(this.tag);
    t = this.next ? this.next.toAddr() : void 0;
    return new VanillaCmdTag(x, this.op, t)
  }
  reduce() { return this.genRightSide() }
}

class Parser {
  constructor(str) {
    Lexer.init(str);
    this.look = void 0; // 向前看词法单元
    this.used = 0; // 用于声明变量的存储位置
    this.top = new Env(void 0); // 当前或顶层符号表
    this.done = !1;
    Parser.result = "";
    Parser.resultObj = void 0;
    Parser.modules = [];
    this.move();
  }

  static append(a) { Parser.result += a }
  static appendObj(a) { Parser.resultObj.push(a) }
  move() { this.look = Lexer.scan(); }
  error(s) { throw new Error("Near line " + Lexer.getLine() + ": " + s) }
  match(t) { if (this.look.tag == t) this.move(); else this.error("Syntax error: Unexpected " + this.look.tag) }
  errorUnexp() { this.error("Syntax error: Unexpected " + this.look.tag) }

  program() {
    if (this.done) return;
    while (this.look.tag != Tag.EOF) {
      var s = this.toplevel()
        , begin = s.newlabel()
        , after = s.newlabel();
      s.emitlabel(begin);
      s.gen(begin, after);
      s.emitlabel(after);
      // Remove unused label and
      // Cut into base blocks
      var r = new TAC(Parser.resultObj.mode), c = 1, d = 0, e = 0, f = null;
      // c: label counter, d: baseblock counter, 
      // e: counter of inst except label in current bb
      // f: current bb's first label
      for (var a of Parser.resultObj) {
        var rd = (r[d] ? r[d] : (r[d] = new TACBaseBlock(d)));
        if (a.type == "label")
          /* If label is used */
          a.onUse.length && (
            (e ? (
              /* And if this isn't a new baseblock */
              /* i.e. there's other inst except label */
              a.label = c++, e = 0, a.baseblock = r[++d] = new TACBaseBlock(d)
              /* Then create a new baseblock */
              /* And push this label in it */
            ).push(a) : (
              /* If this is a new baseblock */
              /* i.e. no inst except label */
              a.label = c++, (a.baseblock = rd).push(a)
              /* Just add the label into the baseblock */
            ))
          );
        else if (a.type == "if" || a.type == "iffalse" || a.type == "goto") rd.push(a), d++, e = 0, f = null;
        else rd.push(a), e++, f = null;
      }
      Parser.modules.push(r);
    }
  }

  toplevel() {
    switch (this.look.tag) {
      case Tag.CHAIN:
        this.move();
        if (this.look.tag == Tag.PULSE) {
          this.move();
          Parser.resultObj = new TAC(Mode.CP);
          return this.Block(Mode.CP);
        } else if (this.look.tag == Tag.REPEATING) {
          this.move();
          Parser.resultObj = new TAC(Mode.CR);
          return this.CRBlock(Mode.CR);
        } else if (this.look.tag == "{") {
          Parser.resultObj = new TAC(Mode.CP);
          return this.Block(Mode.CP);
        } else this.errorUnexp();
      case Tag.MODULE:
        this.move();
        if (this.look.tag == "{") {
          Parser.resultObj = new TAC(Mode.M);
          return this.Block(Mode.M);
        } else this.errorUnexp();
      /*case Tag.BASIC:
        Parser.resultObj = new TAC(Mode.DECL);
        return this.decl();*/
      default:
        this.errorUnexp();
    }
  }

  decl() {
    // D -> type ID [= E]
    var p = this.type();
    var tok = this.look;
    this.match(Tag.ID);
    var id = new Id(tok, p, this.used);
    this.top.put(tok, id);
    this.used++;
    if (this.look.tag == ';') {
      this.match(";");
      if (p != Type.Int && p != Type.Bool)
        this.error("Invalid constant declaration: Constant must have an initial value.")
      return new AssignExpr(id, new Constant(new NumericLiteral(0)));
    }
    this.match("=");
    var stmt = new AssignExpr(id, this.assign());
    this.match(";");
    return stmt
  }

  type() { var p = this.look; this.match(Tag.BASIC); return p; }

  Block(m) {
    this.match("{");
    var savedEnv = this.top;
    this.top = new Env(this.top);
    var s = this.Stmts(m);
    this.match("}");
    this.top = savedEnv;
    return s
  }

  Stmts(m) {
    var f = [this.CPStmt, this.CRStmt, this.MStmt];
    if (this.look.tag == '}') return Stmt.Null;
    else if (this.look.tag == Tag.EOF) return Stmt.Null;
    else return new Seq(f[m].call(this), this.Stmts(m))
  }

  CPStmt() {
    var x, s1, s2;
    switch (this.look.tag) {
      case ';':
        this.move();
        return Stmt.Null;
      case Tag.IF:
        this.match(Tag.IF), this.match("("), x = this.assign(), this.match(")");
        s1 = this.CPStmt();
        if (this.look.tag != Tag.ELSE) return new If(x, s1);
        this.match(Tag.ELSE);
        s2 = this.CPStmt();
        return new Else(x, s1, s2);
      case "{":
        return this.Block(Mode.CP);
      case Tag.BASIC:
        return this.decl();
      case Tag.VANICMD: case Tag.ID: case Tag.NUM: case Tag.STRING: case Tag.SELECTOR: case "++": case "--":
        x = this.assign();
        this.match(';');
        return x;
      default:
        this.errorUnexp()
    }
  }

  CPStmt() {
    var x, s1, s2;
    switch (this.look.tag) {
      case ';':
        this.move();
        return Stmt.Null;
      case Tag.IF:
        this.match(Tag.IF), this.match("("), x = this.assign(), this.match(")");
        s1 = this.CPStmt();
        if (this.look.tag != Tag.ELSE) return new If(x, s1);
        this.match(Tag.ELSE);
        s2 = this.CPStmt();
        return new Else(x, s1, s2);
      case "{":
        return this.Block(Mode.CP);
      case Tag.BASIC:
        return this.decl();
      case Tag.VANICMD: case Tag.VANICMDHEAD: case Tag.ID: case Tag.NUM: case Tag.STRING: case Tag.SELECTOR: case "++": case "--":
        x = this.assign();
        this.match(';');
        return x;
      case Tag.DELAYH:
        this.match(Tag.DELAYH); x = this.look; this.match(Tag.NUM); this.match(';')
        return new DelayH(x);
      default:
        this.errorUnexp()
    }
  }

  MStmt() {
    var x, s1, s2, savedStmt;
    switch (this.look.tag) {
      case ';':
        this.move();
        return Stmt.Null;
      case Tag.IF:
        this.match(Tag.IF), this.match("("), x = this.assign(), this.match(")");
        s1 = this.MStmt();
        if (this.look.tag != Tag.ELSE) return new If(x, s1);
        this.match(Tag.ELSE);
        s2 = this.MStmt();
        return new Else(x, s1, s2);
      case Tag.WHILE:
        var whilenode = new While();
        savedStmt = Stmt.Enclosing, Stmt.Enclosing = whilenode;
        this.match(Tag.WHILE), this.match("("), x = this.assign(), this.match(")");
        s1 = this.MStmt();
        whilenode.init(x, s1);
        Stmt.Enclosing = savedStmt;
        return whilenode;
      case Tag.DO:
        var donode = new Do();
        savedStmt = Stmt.Enclosing, Stmt.Enclosing = donode;
        this.match(Tag.DO);
        s1 = this.MStmt();
        this.match(Tag.WHILE), this.match("("), x = this.assign(), this.match(")"), this.match(";");
        donode.init(s1, x);
        Stmt.Enclosing = savedStmt;
        return donode;
      case Tag.BREAK:
        this.match(Tag.BREAK), this.match(";");
        return new Break();
      case "{":
        return this.MBlock();
      case Tag.BASIC:
        return this.decl();
      case Tag.VANICMD: case Tag.VANICMDHEAD: case Tag.ID: case Tag.NUM: case Tag.STRING: case Tag.SELECTOR: case "++": case "--":
        x = this.assign();
        this.match(';');
        return x;
      default:
        this.errorUnexp()
    }
  }

  assign() {
    var x = this.logicalOr(), tok = this.look;
    switch (tok.tag) {
      case "=":
        if (x.op.tag == Tag.ID || x.op.tag == Tag.GS) {
          this.match("=");
          return new AssignExpr(x, this.assign());
        } else this.error("Syntax error: Invalid left-hand side in assignment")
      case "*=": case "/=": case "%=":
        if (x.op.tag != Tag.ID && x.op.tag != Tag.GS)
          this.error("Syntax error: Invalid left-hand side in assignment")
      case "+=": case "-=":
        if (x.op.tag == Tag.ID || x.op.tag == Tag.GS || x.op.tag == Tag.SELECTOR) {
          this.move();
          return new CompoundAssignExpr(x, this.assign(), tok);
        } else this.error("Syntax error: Invalid left-hand side in assignment")
      default:
        return x;
    }
  }

  logicalOr() { var x = this.logicalAnd(); while (this.look.tag == Tag.OR) { var tok = this.look; this.move(); x = new Or(tok, x, this.logicalAnd()) } return x }
  logicalAnd() { var x = this.equality(); while (this.look.tag == Tag.AND) { var tok = this.look; this.move(); x = new And(tok, x, this.equality()) } return x }
  equality() { var x = this.relational(); while (this.look.tag == Tag.EQ || this.look.tag == Tag.NE) { var tok = this.look; this.move(); x = new Rel(tok, x, this.relational()) } return x }
  relational() { var x = this.additive(); switch (this.look.tag) { case '<': case Tag.LE: case Tag.GE: case '>': var tok = this.look; this.move(); return new Rel(tok, x, this.additive()); default: return x } }
  additive() { var x = this.multiplicative(); while (this.look.tag == "+" || this.look.tag == "-") { var tok = this.look; this.move(); x = new Arith(tok, x, this.multiplicative()) } return x }
  multiplicative() { var x = this.unary(); while (this.look.tag == "*" || this.look.tag == "/" || this.look.tag == "%") { var tok = this.look; this.move(); x = new Arith(tok, x, this.unary()) } return x }

  unary() {
    var tok = this.look;
    if (this.look.tag == "-") {
      this.move(); return new Unary(Word.minus, this.unary())
    } else if (this.look.tag == "!") {
      this.move(); return new Not(tok, this.unary())
    } else if (this.look.tag == "++" || this.look.tag == "--") {
      this.move();
      if (this.look.tag == Tag.ID) return new Prefix(this.unary(), tok);
      else this.error("Invalid left-hand side expression in prefix operation");
    }
    else return this.postfix();
  }

  postfix() {
    var x = this.getScore(), tok;
    if (this.look.tag == "++" || this.look.tag == "--") {
      tok = this.look; this.move();
      if (x.op.tag == Tag.ID || x.op.tag == Tag.GS) return new Postfix(x, tok);
      else this.error("Invalid left-hand side expression in postfix operation");
    } else return x;
  }

  getScore() {
    var x = this.primary();
    if (this.look.tag == Tag.GS) {
      this.move();
      return new GetScore(Word.gs, x, this.primary())
    } else return x
  }

  primary() {
    var x = void 0;
    switch (this.look.tag) {
      case '(':
        this.move(), x = this.assign(), this.match(')');
        return x;
      case Tag.NUM:
        x = new Constant(this.look, Type.Int);
        this.move();
        return x;
      case Tag.TRUE:
        x = Constant.True;
        this.move();
        return x;
      case Tag.FALSE:
        x = Constant.False;
        this.move();
        return x;
      case Tag.ID:
        x = this.look.toString();
        var id = this.top.get(this.look);
        if (id == void 0) this.error(x + " undeclared");
        this.move();
        return id;
      case Tag.VANICMD:
        x = this.look;
        this.move();
        return new VanillaCmdNoTag(x);
      case Tag.VANICMDHEAD:
        x = this.look;
        this.move();
        return new VanillaCmdTag(void 0, x, this.vaniCmdTag());
      case Tag.STRING:
        x = this.look;
        this.move();
        return new Constant(x, Type.String);
      case Tag.SELECTOR:
        x = this.look;
        this.move();
        return new Selector(x);
      default:
        this.errorUnexp();
        return x;
    }
  }

  vaniCmdTag() {
    var x = this.assign(), t = this.look;
    this.move();
    if (t.tag == Tag.VANICMDBODY)
      return new VanillaCmdTag(x, t, this.vaniCmdTag());
    if (t.tag == Tag.VANICMDTAIL)
      return new VanillaCmdTag(x, t, void 0);
    this.errorUnexp();
  }
}

function Generator(W) {
  var regDesc = [], varDesc = [], scb = "bkstage";
  function getReg(v) {
    if (v.tag == Tag.TEMP) { }
    if (v.tag == Tag.ID) {
    }
  }
  function CP(M) {
    for (let i = 0; i < M.length; i++) {
      var BB = M[i];
      for (let j = 0; j < BB.length; j++) {
        /* Calculate lastRead and lastWrite */
        var Inst = BB[j], x1, x2;
        switch (Inst.type) {
          case "assign": case "assigncomp":
            x1 = Inst.id;
            if (x1.tag == ExprTag.REF) x1.lastWrite = Inst;
          case "if": case "iffalse":
            x2 = Inst.expr;
            if (x2.tag == ExprTag.REF) x2.lastRead = Inst;
            else if (x2.tag == ExprTag.UNARY && x2.expr.tag == ExprTag.REF) x2.expr.lastRead = Inst;
            else if (x2.tag == ExprTag.ARITH || x2.tag == ExprTag.REL) {
              if (x2.expr1.tag == ExprTag.REF) x2.expr1.lastRead = Inst;
              if (x2.expr2.tag == ExprTag.REF) x2.expr2.lastRead = Inst;
            }
        }
      }
    }
  }
}

var varDesc = [], $DefaultScb = "bkstage";

var RegisterAssign = function () {
  var regDesc = [];
  return {
    getReg: function (v) {
      if (v.reg) return;
      for (let i = 0; i < regDesc.length; i++) {
        if (regDesc[i].var == null) {
          regDesc[i].var = v;
          v.reg = regDesc[i];
          return;
        }
      }
      regDesc.push({
        var: v,
        number: regDesc.length,
        toString: function () { return "R" + this.number + " " + $DefaultScb }
      });
      v.reg = regDesc[regDesc.length - 1];
    },
    releaseReg: function (v) {
      regDesc[v.reg.number].var = null;
      v.reg = null;
    },
    init: function () { regDesc = [] }
  }
}();

function CP(M) {
  for (let i = 0; i < M.length; i++) {
    var BB = M[i];
    for (let j = 0; j < BB.length; j++) {
      /* Calculate lastRead and lastWrite */
      var Inst = BB[j], x1, x2;
      switch (Inst.type) {
        case "assign": case "assigncomp":
          x1 = Inst.id;
          if (x1.tag == ExprTag.REF) x1.lastWrite = Inst;
        case "if": case "iffalse":
          x2 = Inst.expr;
          if (x2.tag == ExprTag.REF) x2.lastRead = Inst;
          else if (x2.tag == ExprTag.UNARY && x2.expr.tag == ExprTag.REF) x2.expr.lastRead = Inst;
          else if (x2.tag == ExprTag.ARITH || x2.tag == ExprTag.REL) {
            if (x2.expr1.tag == ExprTag.REF) x2.expr1.lastRead = Inst;
            if (x2.expr2.tag == ExprTag.REF) x2.expr2.lastRead = Inst;
          }
      }
    }
  }

  var state = new Temp(Type.Int);
  for (let i = 0; i < M.length; i++) {
    var BB = M[i];
    for (let j = 0; j < BB.length; j++) {
      var Inst = BB[j], Chain = BB.chain, x1, x2;
      switch (Inst.type) {
        case "vanilla":
          console.log(`VANI \`${Inst.cmd.toString()}\``);
          Inst.gen(Chain);
          break;
        case "assign": case "assigncomp":
          Inst.gen(Chain);
          break;
        case "if":
          switch (Inst.expr.tag) {
            case ExprTag.VANICMD:
              console.log(`VANI \`${Inst.cmd.toString()}\``);
              break;
          }
          break;
      }
    }
  }
}

var temp1 = {};

function run() {
  var str = document.getElementById("input").value;
  Token.uid = 0;
  ASTNode.labels = 0;
  Temp.count = 0;
  var parse = new Parser(str);
  parse.program();
  console.log(temp1 = Parser.modules);
}