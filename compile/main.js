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

  EOF: 0xFFFF,
  LF: 0xFFFE,
  EXPR: 0xFFFD,
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
  DELAYH: 286
};

const Mode = { CP: 0, CR: 1, M: 2, DECL: 3 };

class Token { constructor(t) { this.tag = t; this.uid = Token.uid++ } toString() { return this.tag } static uid = 0; static EOF = new Token(Tag.EOF) }
class NumericLiteral extends Token { constructor(v) { super(Tag.NUM); this.value = v } toString() { return this.value.toString() } }
class StringLiteral extends Token { constructor(v) { super(Tag.STRING); this.value = v } toString() { return '"' + this.value + '"' } }
class VaniCmdLiteral extends Token { constructor(v) { super(Tag.VANICMD); this.cmd = v } toString() { return "`" + this.cmd + "`" } }
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
  static ex = new Word("=>", Tag.AE);
  static minus = new Word("minus", Tag.MINUS);
  static True = new Word("true", Tag.TRUE);
  static False = new Word("false", Tag.FALSE);
  static temp = new Word("t", Tag.TEMP);
}

class Lexer {
  constructor(str) {
    this.words = new HashTable();
    this.str = str;
    this.ptr = 0;
    this.peek = " ";
    this.line = 1;
    /* Reserved words */
    this.reserve(new Word("if", Tag.IF));
    this.reserve(new Word("else", Tag.ELSE));
    this.reserve(new Word("while", Tag.WHILE));
    this.reserve(new Word("do", Tag.DO));
    this.reserve(new Word("break", Tag.BREAK));
    this.reserve(new Word("chain", Tag.CHAIN));
    this.reserve(new Word("pulse", Tag.PULSE));
    this.reserve(new Word("repeating", Tag.REPEATING));
    this.reserve(new Word("module", Tag.MODULE));
    this.reserve(new Word("execute", Tag.EXECUTE));
    this.reserve(new Word("delayh", Tag.DELAYH));
    this.reserve(Word.False);
    this.reserve(Word.True);
    this.reserve(Type.Int);
    this.reserve(Type.Bool);
    this.reserve(Type.String);
    this.reserve(Type.Selector);
    this.reserve(Type.Vector);
  }
  readNext() {
    if (this.ptr > this.str.length) throw new Error("String Ends");
    return this.str[this.ptr++]
  }
  canRead() { return this.ptr <= this.str.length }
  reserve(w) { this.words.put(w.lexeme, w) }
  readch(c) {
    this.peek = this.readNext();
    if (this.peek != c) return !1;
    this.peek = " ";
    return !0
  }
  isch(c) { if (this.peek != c) return !1; this.peek = " "; return !0 }
  scan() {
    // 跳过空白
    for (; this.canRead(); this.readch()) {
      if (this.peek === ' ' || this.peek === "\t") continue;
      else if (this.peek === "\n") this.line += 1;
      else break;
    }

    if (!this.canRead()) return Token.EOF;
    var t = this.ptr;
    switch (this.peek) {
      case '&':
        if (this.readch('&')) return Word.and;
        else return new Token('&');
      case '|':
        if (this.readch('|')) return Word.or;
        else return new Token('|');
      case '=':
        if (this.readch('=')) return Word.eq;
        if (this.isch('>')) return Word.ex;
        else return new Token('=');
      case '!':
        if (this.readch('=')) return Word.ne;
        else return new Token('!');
      case '<':
        if (this.readch('=')) return Word.le;
        else return new Token('<');
      case '>':
        if (this.readch('=')) return Word.ge;
        else return new Token('>');
      case '-':
        if (this.readch('>')) return Word.gs;
        else if (this.isch('-')) return new Token("--");
        else if (this.isch('=')) return new Token("-=");
        else return new Token('-');
      case '+':
        if (this.readch('+')) return new Token("++");
        else if (this.isch('=')) return new Token("+=");
        else return new Token('+');
      case '*':
        if (this.readch('=')) return new Token("*=");
        else return new Token('*');
      case '/':
        if (this.readch('=')) return new Token("/=");
        else return new Token('/');
      case '%':
        if (this.readch('=')) return new Token("%=");
        else return new Token('%');
    }
    if (this.isUnquotedStringStart()) {
      var b = this.readStringUnquoted();
      var w = this.words.get(b);
      if (w != void 0) return w;
      w = new Word(b, Tag.ID);
      this.words.put(b, w);
      return w
    }
    if (/\d/.test(this.peek)) return this.readNumber();
    if (this.peek == "`") return new VaniCmdLiteral(this.readStringUntil("`"));
    if (this.peek == '"') return new StringLiteral(this.readStringUntil('"'));
    if (this.peek == '@') return this.readSelector();
    if (!this.canRead()) return Token.EOF;
    var t = new Token(this.peek);
    this.peek = " ";
    return t
  }

  readNumber() {
    var v = 0;
    do {
      v = 10 * v + Number(this.peek);
      this.readch()
    } while (/\d/.test(this.peek))
    if (this.peek != ".") return new NumericLiteral(v);
    var x = v, d = 10;
    for (; this.canRead();) {
      this.readch();
      if (!/\d/.test(this.peek)) break;
      x += Number(this.peek) / d;
      d *= 10;
    }
    return new NumericLiteral(x)
  }

  readStringUntil(terminator) {
    var result = ""
      , escaped = false;
    while (this.canRead()) {
      this.readch();
      if (escaped) {
        if (this.peek == terminator || this.peek == "\\") {
          result += this.peek;
        } else if (this.peek == "n") {
          result += "\n";
        } else {
          result += this.peek;
        }
        escaped = false;
      } else if (this.peek == "\\") {
        escaped = true;
      } else if (this.peek == terminator) {
        this.readch();
        return result;
      } else {
        result += this.peek;
      }
    }
  }

  isUnquotedStringStart() {
    return /[a-zA-Z_\u4e00-\u9fa5]/.test(this.peek)
  }

  readStringUnquoted() {
    var result = "";
    if (!this.isUnquotedStringStart()) return "";
    result += this.peek;
    while (this.canRead()) {
      this.readch();
      if (!/[a-zA-Z0-9_\u4e00-\u9fa5]/.test(this.peek)) break;
      result += this.peek;
    }
    return result
  }

  readSelector() {
    var v = "@", s;
    if (this.peek == '@') {
      this.readch();
      v += s = this.readStringUnquoted();
    }

    if (!s)
      return new Token('@');

    if (this.peek != "[") return new SelectorLiteral(v);
    else {
      v += "[" + this.readStringUntil("]") + "]";
      return new SelectorLiteral(v);
    }
  }
}

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
    else return void 0;
  }

  // 类型转换
  static toBoolean(x) {
    if (x.type == Type.Int || x.type == Type.Vector || x.type == Type.Selector)
      return new Rel(Word.ne, x, new Constant(new NumericLiteral(0)))
    else return x;
  }
}

function genScb(e1, o1, op, e2, o2) {
  // scb ply op <dest> <obj1> <op> <victim> <obj2>
  if (e2 && o2) return `scb ply op ${e1} ${o1} ${op} ${e2} ${o2}`;
  // seb ply <add|set> <victim> <obj>
  else if (e2) return `scb ply ${op} ${e1} ${o1} ${e2}`;
}
class CB { constructor(cmd) { this.cmd = cmd; } }
class TACBaseBlock extends Array { constructor() { super() } }
class TAC extends Array { constructor(m) { super(); this.mode = m } }
class TACLabel { constructor(n) { this.type = "label"; this.label = n; this.onUse = 0 } mark() { this.onUse++ } }
class TACDelayH { constructor(t) { this.type = "delayh"; this.delay = t } }
class TACGoto { constructor(l, c, t) { if (c == 1) this.type = "if", this.expr = t, this.label = l; else if (c == 2) this.type = "iffalse", this.expr = t, this.label = l; else this.type = "goto", this.label = l; } }
class TACVanilla { constructor(c) { this.cmd = c } gen() { return new CB(this.cmd) } }
class TACAssign {
  constructor(i, e, o) { if (o) this.type = "assigncomp", this.id = i, this.expr = e, this.op = o; else this.type = "assign", this.id = i, this.expr = e; }
  getIdTag() { return this.id.op.tag }
  getExprTag() { return this.expr.op.tag }
  gen() {
    // assign
    if (this.type == "assign") {
      var s = "", t = "", it = this.getIdTag(), et = this.getExprTag();
      if ((it == Tag.ID || it == Tag.TEMP) && this.id.type == Type.Int) t = this.id.toString(), s = this.scb;
      if (it == Tag.GS) t = this.id.target.toString(), s = this.id.scb.toString();
      switch (et) {
        case Tag.NUM:
          return new CB(genScb(t, s, "set", this.expr.toString()));
        case Tag.SELECTOR:
          t = `scb ply set ${v} 0\nexe ${k.expr.toString()} ~~~ scb ply add ${k.id.toString()} ${this.scb} 1`;
          break;
        case Tag.GS:
          return new CB(genScb(t, s, "=", this.expr.target.toString(), this.expr.scb.toString()));
        case Tag.ID: case Tag.TEMP:
          return new CB(genScb(t, s, "=", this.expr.toString(), this.scb));
        default:
          t = `scb ply op ${v} = ${k.expr.expr1.toString()} ${this.scb}\nscb ply op ${k.id.toString()} ${this.scb} ${et}= ${k.expr.expr2.toString()} ${this.scb}`;
          break;
      }
    } else { // assigncomp


    }
  }
}

/** Abstract Syntax Tree Node */
class ASTNode {
  constructor() { this.lexline = Lexer.line; this.labels = 0; }
  static labels = 0;
  /** Throw an error */
  error(s) { throw new Error("Near line " + Lexer.line + ": " + s) }
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
  emitif(t, l) { l.mark(); Parser.appendObj(new TACGoto(l, 1, t)) }
  /**
   * Gen a direct goto.
   * @param {TACLabel} l - Label 
   */
  emitgoto(l) { l.mark(); Parser.appendObj(new TACGoto(l)) }
  /**
   * Gen an iffalse-goto.
   * @param {Expr} t - Condition
   * @param {TACLabel} l - Label 
   */
  emitiffalse(t, l) { l.mark(); Parser.appendObj(new TACGoto(l, 2, t)) }
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
   * @param {VanillaCmd} c - Command
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
  constructor(t, p) { super(); this.op = t; this.type = p; this.tag = Tag.EXPR }
  /** Gen as an inline expr, or as the right-hand-side of a TAC */
  genRightSide() { return this }
  /** Gen as a term in TAC, or an address */
  reduce() { return this }
  /**
   * Gen as a conditioned goto.
   * @param {TACLabel} t - Label of true
   * @param {TACLabel} f - Lable of false
   */
  jumping(t, f) { this.emitjumps(this.toAddr(), t, f) }
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
  /** Gen as the right-hand-side in TAC */
  toAddr() { return this }
}

/** Identifier implement. @extends Expr */
class Id extends Expr {
  /**
   * @param {Token} id - Token of the identifier
   * @param {Type} p - Type of the identifier
   * @param {Number} b - UID of the identifier
   */
  constructor(id, p, b) { super(id, p); this.offset = b }/* offset为相对地址 */
}

/** Expression with an operator. @extends Expr */
class Op extends Expr {
  /**
   * @param {Token} tok - Token of the operator
   * @param {Type} p - Type of the expression
   */
  constructor(tok, p) { super(tok, p) }
  reduce() {
    var x = this.genRightSide()  // = this
      , t = new Temp(this.type);
    this.emitassign(t.toAddr(), x.toAddr());
    return t
  }
  toAddr() { return this.genRightSide() }
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
    if (this.type == void 0) this.error("Type mismatch")
  }
  genRightSide() { return new Arith(this.op, this.expr1.reduce(), this.expr2.reduce()) }
  toString() { return this.expr1.toString() + " " + this.op.toString() + " " + this.expr2.toString() }
  toAddr() { return new Arith(this.op, this.expr1.reduce().toAddr(), this.expr2.reduce().toAddr()) }
}

/** 
 * GetScore expression implement.
 * The usage of scoreboard in HLCL.
 * @extends Op
 */
class GetScore extends Op {
  /**
   * @param {Token} tok - Token of the operator
   * @param {Expr} x1 - Scoreboard object
   * @param {Expr} x2 - Target
   */
  constructor(tok, x1, x2) {
    super(tok, void 0);
    this.scb = x1;
    this.target = x2;
    this.type = Type.Vector;
    if (x1.type != Type.String) this.error("Type error: Scoreboard must be a string, recieved: " + x1.type.lexeme);
    if (x2.type != Type.String && x2.type != Type.Selector) this.error("Type error: Target must be a string or selector, received: " + x2.type.lexeme);
  }
  genRightSide() { return new GetScore(this.op, this.scb.reduce(), this.target) }
  toString() { return this.scb.toString() + " " + this.op.toString() + " " + this.target.toString() }
  reduce() {
    var x = this.genRightSide()  // = this
      , t = new Temp(Type.Int);
    this.emitassign(t.toAddr(), x.toAddr());
    return t
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
    if (this.type == void 0) this.error("Type mismatch")
  }
  genRightSide() { return new Unary(this.op, this.expr.reduce()) }
  toString() { return this.op.toString() + " " + this.expr.toString() }
}

/** Temp variable implement. @extends Expr */
class Temp extends Expr { constructor(p) { super(Word.temp, p); this.number = ++Temp.count } toString() { return "t" + this.number } }

/** Constant implement @extends Expr */
class Constant extends Expr {
  /**
   * @param {Token} a - Token of the constant
   * @param {Type} b - Type
   */
  constructor(a, b) {
    if (b) super(a, b);
    else super(new NumericLiteral(a), Type.Int)
  }
  static True = new Constant(Word.True, Type.Bool);
  static False = new Constant(Word.False, Type.Bool);
  jumping(t, f) {
    if (this == Constant.True && t != 0) this.emitgoto(t);
    if (this == Constant.False && f != 0) this.emitgoto(f);
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
  gen() { this.emitassign(this.id.toAddr(), this.expr.genRightSide().toAddr()) }
  genRightSide() { this.gen(); return this.id }
  toString() { return this.id.toString() + " = " + this.expr.toString() }
  reduce() { this.gen(); return this.id }
}

/** Compound assignment implement. @extends AssignExpr */
class CompoundAssignExpr extends AssignExpr {
  /**
   * @param {Token} i - Identifier to be assigned
   * @param {Expr} x - Right-hand-side expression
   * @param {Token} op - Operator
   */
  constructor(i, x, op) { super(i, x); this.op = op; }
  gen() { this.emitassigncomp(this.id.toAddr(), this.op, this.expr.genRightSide().toAddr()) }
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
  }
  gen() { this.emitassign(this.id.toAddr(), this.op) }
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
  }
  gen() { this.emitassign(this.id.toAddr(), this.op) }
  genRightSide() { this.gen(); return this.id }
}

/** 
 * Vanilla command implement. 
 * Produces direct access to vanilla command in MCBE.
 * @extends Expr 
 */
class VanillaCmd extends Expr {
  /**
   * @param {Token} tok - Token of vanilla command
   */
  constructor(tok) { super(tok, Type.Bool); this.cmd = tok; }
  gen() { this.emitvanilla(this.cmd.toString()) }
  toString() { return this.cmd.toString() }
  reduce() {
    var x = this.genRightSide()  // = this
      , t = new Temp(this.type);
    this.emitassign(t.toAddr(), x.toAddr());
    return t
  }
}

/** Selector implement. @extends Expr */
class Selector extends Expr {
  /**
   * @param {Token} tok - Token of selector
   */
  constructor(tok) { super(tok, Type.Selector); this.sel = tok; }
  reduce() {
    var t = new Temp(Type.Int);
    this.emitassign(t.toAddr(), this.toAddr());
    return t
  }
  jumping(t, f) { this.emitjumps(this.toAddr(), t, f) }
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
  constructor(tok, x1, x2) { super(tok, x1, x2) }
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
  constructor(tok, x1, x2) { super(tok, x1, x2) }
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
  constructor(tok, x2) { super(tok, x2, x2) }
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
  constructor(tok, x1, x2) { super(tok, x1, x2) }
  check(p1, p2) {
    if (p1 == p2) return Type.Bool;
    else if (p1 == Type.Selector && p2 == Type.Int) return Type.Bool;
    else if (p2 == Type.Selector && p1 == Type.Int) return Type.Bool;
    else return void 0
  }
  jumping(t, f) {
    this.emitjumps(new Rel(this.op, this.expr1.reduce(), this.expr2.reduce()), t, f)
  }
}

class Parser {
  constructor(str) {
    this.lex = new Lexer(str); // 词法分析器
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
  move() { this.look = this.lex.scan(); }
  error(s) { throw new Error("Near line " + this.lex.line + ": " + s) }
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
      var r = new TAC(Parser.resultObj.mode), c = 1, d = 0, e = 0;
      // c: label counter, d: baseblock counter, e: counter of inst except label in current bb
      for (var a of Parser.resultObj) {
        var rd = (r[d] ? r[d] : (e = 0, r[d] = new TACBaseBlock()));
        if (a.type == "label") a.onUse ? (a.label = c++, (e ? (e = 0, r[++d] = new TACBaseBlock()).push(a) : rd.push(a))) : 0;
        else if (a.type == "if" || a.type == "iffalse" || a.type == "goto") rd.push(a), d++;
        else rd.push(a), e++;
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
      return new AssignExpr(id, new Constant(new NumericLiteral(0)));
    } else if (this.look.tag == '=') {
      this.move();
      var stmt = new AssignExpr(id, this.assign());
      this.match(";");
      return stmt
    }
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
      case Tag.VANICMD: case Tag.ID: case Tag.NUM: case Tag.STRING: case Tag.SELECTOR: case "++": case "--":
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
      case Tag.VANICMD: case Tag.ID: case Tag.NUM: case Tag.STRING: case Tag.SELECTOR: case "++": case "--":
        x = this.assign();
        this.match(';');
        return x;
      default:
        this.errorUnexp()
    }
  }

  assign() {
    var x = this.bool(), tok = this.look;
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

  bool() { var x = this.join(); while (this.look.tag == Tag.OR) { var tok = this.look; this.move(); x = new Or(tok, x, this.join()) } return x }
  join() { var x = this.equality(); while (this.look.tag == Tag.AND) { var tok = this.look; this.move(); x = new And(tok, x, this.equality()) } return x }
  equality() { var x = this.rel(); while (this.look.tag == Tag.EQ || this.look.tag == Tag.NE) { var tok = this.look; this.move(); x = new Rel(tok, x, this.rel()) } return x }
  rel() { var x = this.expr(); switch (this.look.tag) { case '<': case Tag.LE: case Tag.GE: case '>': var tok = this.look; this.move(); return new Rel(tok, x, this.expr()); default: return x } }
  expr() { var x = this.term(); while (this.look.tag == "+" || this.look.tag == "-") { var tok = this.look; this.move(); x = new Arith(tok, x, this.term()) } return x }
  term() { var x = this.unary(); while (this.look.tag == "*" || this.look.tag == "/" || this.look.tag == "%") { var tok = this.look; this.move(); x = new Arith(tok, x, this.unary()) } return x }

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
    var x = this.score(), tok;
    if (this.look.tag == "++" || this.look.tag == "--") {
      tok = this.look; this.move();
      if (x.op.tag == Tag.ID || x.op.tag == Tag.GS) return new Postfix(x, tok);
      else this.error("Invalid left-hand side expression in postfix operation");
    } else return x;
  }

  score() {
    var x = this.factor();
    if (this.look.tag == Tag.GS) {
      this.move();
      return new GetScore(Word.gs, x, this.factor())
    } else return x
  }

  factor() {
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
        //for (var id of x.replacement) { }
        this.move();
        return new VanillaCmd(x);
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
}

function Generator(W) {
  var regDesc = [], varDesc = [], scb = "bkstage";
  function getReg(v) {
    if (v.tag == Tag.TEMP) { }
    if (v.tag == Tag.ID) {
      //varDesc[v.offset] ? 
    }
  }
  function CP(M) {
    var chain = [];
    for (var k of B) {
      var t = "";
      switch (k.type) {
        case "assign":
          var s = "", t = "", it = k.getIdTag(), et = k.getExprTag();
          if ((it == Tag.ID || it == Tag.TEMP) && k.id.type == Type.Int) t = k.id.toString(), s = this.scb;
          if (it == Tag.GS) t = k.id.target.toString(), s = k.id.scb.toString();
          switch (et) {
            case Tag.NUM:
              t = genScb(t, s, "set", k.expr.toString());
              break;
            case Tag.SELECTOR:
              t = `scb ply set ${v} 0\nexe ${k.expr.toString()} ~~~ scb ply add ${k.id.toString()} ${this.scb} 1`;
              break;
            case Tag.GS:
              t = genScb(t, s, "=", k.expr.target.toString(), k.expr.scb.toString());
              break;
            case Tag.ID: case Tag.TEMP:
              t = `scb ply op ${v} = ${k.expr.toString()} ${this.scb}`;
              t = genScb(t, s, "=", k.expr.toString(), scb);
              break;
            case Tag.GS:
              t = `scb ply op ${v} = ${k.expr.target.toString()} ${k.expr.scb.toString()}`;
              break;
            default:
              t = `scb ply op ${v} = ${k.expr.expr1.toString()} ${this.scb}\nscb ply op ${k.id.toString()} ${this.scb} ${et}= ${k.expr.expr2.toString()} ${this.scb}`;
              break;
          }
      }
      chain.push(new CB(t));
    }
  }
}

function run() {
  var str = document.getElementById("input").value;
  Token.uid = 0;
  ASTNode.labels = 0;
  Temp.count = 0;
  var parse = new Parser(str);
  parse.program();
  console.log(Parser.modules);
  //var k = new CommandGenerator(Parser.modules[0][0]);
  //k.gen()
}