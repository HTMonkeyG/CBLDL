"use strict";

//var fs = require("fs");

var Tag = {
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
  REAL: 272,
  TEMP: 273,
  TRUE: 274,
  WHILE: 275,

  EOF: 0xffff,
  VANICMD: 276,
  STRING: 277,
  SELECTOR: 278,
  CHAIN: 279,
  PULSE: 280,
  REPEATING: 281,
  MODULE: 282,
  GS: 283,
  AE: 284
}

class Token {
  constructor(t) { this.tag = t; this.uid = Token.uid++; }
  static EOF = new Token(Tag.EOF);
  toString() { return this.tag }
  static uid = 0;
}

class NumericLiteral extends Token {
  constructor(v) { super(Tag.NUM); this.value = v }

  toString() { return this.value.toString() }
}

class StringLiteral extends Token {
  constructor(v) { super(Tag.STRING); this.value = v }

  toString() { return this.value }
}

class VaniCmdLiteral extends Token {
  constructor(v) { super(Tag.VANICMD); this.cmd = v }

  toString() { return "`" + this.cmd + "`" }
}

class SelectorLiteral extends Token {
  constructor(v) { super(Tag.SELECTOR); this.value = v }
}

class Word extends Token {
  constructor(s, t) {
    super(t);
    this.lexeme = s
  }

  toString() {
    return this.lexeme
  }

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

class HashTable {
  constructor() {
    this.KV = {}
  }

  put(k, v) {
    this.KV[k] = v;
  }

  get(k) {
    return this.KV[k]
  }
}

class Lexer {
  constructor(str) {
    this.words = new HashTable();
    this.str = str;
    this.ptr = 0;
    this.peek = " ";
    Lexer.line = 1;
    this.reserve(new Word("if", Tag.IF));
    this.reserve(new Word("else", Tag.ELSE));
    this.reserve(new Word("while", Tag.WHILE));
    this.reserve(new Word("do", Tag.DO));
    this.reserve(new Word("break", Tag.BREAK));
    this.reserve(new Word("chain", Tag.CHAIN));
    this.reserve(new Word("pulse", Tag.PULSE));
    this.reserve(new Word("repeating", Tag.REPEATING));
    this.reserve(new Word("module", Tag.MODULE));
    this.reserve(Word.False);
    this.reserve(Word.True);
    this.reserve(Type.Int);
  }

  readNext() {
    if (this.ptr > this.str.length) throw new Error("String Ends");
    return this.str[this.ptr++]
  }

  canRead() {
    return this.ptr <= this.str.length
  }

  reserve(w) {
    this.words.put(w.lexeme, w)
  }

  readch(c) {
    this.peek = this.readNext();
    if (this.peek != c) return !1;
    this.peek = " ";
    return !0
  }

  scan() {
    // 跳过空白
    for (; this.canRead(); this.readch()) {
      if (this.peek === ' ' || this.peek === "\t") continue;
      else if (this.peek === "\n") Lexer.line += 1;
      else break;
    }
    switch (this.peek) {
      case '&':
        if (this.readch('&')) return Word.and;
        else return new Token('&');
      case '|':
        if (this.readch('&')) return Word.or;
        else return new Token('|');
      case '=':
        if (this.readch('=')) return Word.eq;
        if (this.readch('>')) return Word.ex;
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
        else return new Token('-');
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
      if (!/[a-zA-Z0-9_\-\u4e00-\u9fa5]/.test(this.peek)) break;
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

  put(w, i) {
    this.table.put(w.uid, i)
  }

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
    if (p == Type.Char || p == Type.Int || p == Type.Float) return !0;
    else return !1
  }

  // 类型转换
  static max(p1, p2) {
    if (!this.numeric(p1) || !this.numeric(p2)) return void 0;
    else if (p1 == Type.Float || p2 == Type.Float) return Type.Float;
    else if (p1 == Type.Int || p2 == Type.Int) return Type.Int;
    else return Type.Char
  }
}

class ASTNode {
  constructor() { this.lexline = Lexer.line; this.labels = 0; }
  static labels = 0;
  error(s) { throw new Error("near line " + Lexer.line + ": " + s) }
  newlabel() { return ++ASTNode.labels }
  emitlabel(i) { Parser.append("L" + i + ":") }
  emit(s) { Parser.append("\t" + s + "\n") }
}

class Stmt extends ASTNode {
  constructor() { super(); this.after = 0 }
  static Null = new Stmt();
  static Enclosing = Stmt.Null;
  gen(b, a) { }
}

class If extends Stmt {
  constructor(x, s) {
    super();
    this.expr = x;
    this.stmt = s;
    if (x.type != Type.Bool) x.error("boolean required in if")
  }

  gen(b, a) {
    var label = this.newlabel(); // stmt代码标号
    this.expr.jumping(0, a);     // 为真时控制流穿越, 否则转向a
    this.emitlabel(label);
    this.stmt.gen(label, a)
  }
}

class Else extends Stmt {
  constructor(x, s1, s2) {
    super();
    this.expr = x;
    this.stmt1 = s1;
    this.stmt2 = s2;
    if (x.type != Type.Bool) x.error("boolean required in if")
  }

  gen(b, a) {
    var label1 = this.newlabel()  // stmt1代码标号
      , label2 = this.newlabel(); // stmt2代码标号
    this.expr.jumping(0, label2); // 为真时控制流穿越至stmt1
    this.emitlabel(label1);
    this.stmt1.gen(label1, a)
    this.emit("goto L" + a);
    this.emitlabel(label2);
    this.stmt2.gen(label2, a)
  }
}

class While extends Stmt {
  constructor() { super(); this.expr = null; this.stmt = null; }

  init(x, s) {
    this.expr = x;
    this.stmt = s;
    if (this.expr.type != Type.Bool) this.expr.error("Boolean required in while")
  }

  gen(b, a) {
    this.after = a;
    this.expr.jumping(0, a);
    var label = this.newlabel();
    this.emitlabel(label);
    this.stmt.gen(label, b);
    this.emit("goto L" + b)
  }
}

class Do extends Stmt {
  constructor() { super(); this.expr = null; this.stmt = null; }

  init(s, x) {
    this.expr = x;
    this.stmt = s;
    if (this.expr.type != Type.Bool) this.expr.error("Boolean required in while")
  }

  gen(b, a) {
    this.after = a;
    var label = this.newlabel();
    this.stmt.gen(b, label);
    this.emitlabel(label);
    this.expr.jumping(b, 0);
  }
}

class AssignExpr extends Stmt {
  constructor(i, x) {
    super();
    this.id = i;
    this.expr = x;
    if (this.check(i.type, x.type) == void 0) this.error("Type mismatch")
  }

  check(p1, p2) {
    if (Type.numeric(p1) && Type.numeric(p2)) return p2;
    else if (p1 == Type.Bool && p2 == Type.Bool) return p2;
    else return void 0
  }

  gen(b, a) {
    this.emit(this.id.toString() + " = " + this.expr.genN().toString())
  }
}

class Seq extends Stmt {
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

class Break extends Stmt {
  constructor() {
    super();
    if (Stmt.Enclosing == Stmt.Null) this.error("unenclosed break");
    this.stmt = Stmt.Enclosing;
  }

  gen(b, a) {
    this.emit("goto L" + this.stmt.after)
  }
}

class Expr extends Stmt {
  constructor(t, p) { super(); this.op = t; this.type = p; }
  genN() { return this }
  gen() { return this.toString() }
  reduce() { return this }
  jumping(t, f) { this.emitjumps(this.toString(), t, f) }
  emitjumps(test, t, f) {
    if (t != 0 && f != 0) {
      this.emit("if " + test + " goto L" + t);
      this.emit("goto L" + f)
    }
    else if (t != 0) this.emit("if " + test + " goto L" + t);
    else if (f != 0) this.emit("iffalse " + test + " goto L" + f);
    else; // 不生成指令, t和f都直接穿越
  }
  toString() { return this.op.toString() }
}

class Id extends Expr {
  constructor(id, p, b) { super(id, p); this.offset = b }
  // offset为相对地址
}

class Op extends Expr {
  constructor(tok, p) { super(tok, p) }
  reduce() {
    var x = this.genN()  // = this
      , t = new Temp(this.type);
    this.emit(t.toString() + " = " + x.toString());
    return t
  }
}

class Arith extends Op {
  constructor(tok, x1, x2) {
    super(tok, void 0);
    this.expr1 = x1;
    this.expr2 = x2;
    this.type = Type.max(x1.type, x2.type);
    if (this.type == void 0) this.error("type error")
  }

  genN() { return new Arith(this.op, this.expr1.reduce(), this.expr2.reduce()) }
  toString() { return this.expr1.toString() + " " + this.op.toString() + " " + this.expr2.toString() }
}

class Unary extends Op {
  constructor(tok, x) {
    super(tok, void 0);
    this.expr = x;
    this.type = Type.max(Type.Int, x.type);
    if (this.type == void 0) this.error("type error")
  }

  genN() { return new Unary(this.op, this.expr.reduce()) }
  toString() { return this.op.toString() + " " + this.expr.toString() }
}

class Temp extends Expr {
  constructor(p) { Temp.count = 0; super(Word.temp, p); this.number = ++Temp.count }
  toString() { return "t" + this.number }
}

class Constant extends Expr {
  constructor(a, b) {
    if (b) super(a, b);
    else super(new NumericLiteral(a), Type.Int)
  }

  static True = new Constant(Word.True, Type.Bool);
  static False = new Constant(Word.False, Type.Bool);

  jumping(t, f) {
    if (this == Constant.True && t != 0) this.emit("goto L" + t);
    if (this == Constant.False && f != 0) this.emit("goto L" + f);
  }
}

class VanillaCmd extends Expr {
  constructor(tok) {
    super(tok, Type.Int);
    this.cmd = tok;
  }

  gen() { return this.emit(this.cmd.toString()) }
  reduce() {
    var x = this.genN()  // = this
      , t = new Temp(this.type);
    this.emit(t.toString() + " = " + x.toString());
    return t
  }
  toString() { return this.cmd.toString() }
}

class Logical extends Expr {
  constructor(tok, x1, x2) {
    super(tok, void 0);
    this.expr1 = x1;
    this.expr2 = x2;
    this.type = this.check(x1.type, x2.type);
    if (this.type == void 0) this.error("type error")
  }

  check(p1, p2) {
    if (p1 == Type.Bool && p2 == Type.Bool) return Type.Bool;
    else return void 0;
  }

  gen() {
    var f = this.newlabel()
      , a = this.newlabel()
      , temp = new Temp(this.type);
    this.jumping(0, f);
    this.emit(temp.toString() + " = true");
    this.emit("goto L" + a);
    this.emitlabel(f);
    this.emit(temp.toString() + " = false");
    this.emitlabel(a);
    return temp
  }

  toString() { return this.expr1.toString() + " " + this.op.toString() + " " + this.expr2.toString() }
}

class Or extends Logical {
  constructor(tok, x1, x2) { super(tok, x1, x2) }
  jumping(t, f) {
    var label = t != 0 ? t : this.newlabel();
    this.expr1.jumping(label, 0);
    this.expr2.jumping(t, f);
    if (t == 0) this.emitlabel(label)
  }
}

class And extends Logical {
  constructor(tok, x1, x2) { super(tok, x1, x2) }
  jumping(t, f) {
    var label = f != 0 ? f : this.newlabel();
    this.expr1.jumping(0, label);
    this.expr2.jumping(t, f);
    if (f == 0) this.emitlabel(label)
  }
}

class Not extends Logical {
  constructor(tok, x2) { super(tok, x2, x2) }
  jumping(t, f) { this.expr2.jumping(f, t); }
  toString() { return this.op.toString() + " " + this.expr2.toString() }
}

class Rel extends Logical {
  constructor(tok, x1, x2) { super(tok, x1, x2) }
  check(p1, p2) {
    if (p1 == p2) return Type.Bool;
    else return void 0
  }
  jumping(t, f) {
    var a = this.expr1.reduce()
      , b = this.expr2.reduce()
      , test = a.toString() + " " + this.op.toString() + " " + b.toString();
    this.emitjumps(test, t, f)
  }
}

class Parser {
  constructor(l) {
    this.lex = l; // 词法分析器
    this.look = void 0; // 向前看词法单元
    this.used = 0; // 用于声明变量的存储位置
    this.top = new Env(this.top); // 当前或顶层符号表
    Parser.result = "";
    this.move();
  }

  static append(a) {
    Parser.result += a;
  }

  move() { this.look = this.lex.scan(); }
  error(s) { throw new Error("near line " + Lexer.line + ":" + s) }

  match(t) {
    if (this.look.tag == t) this.move();
    else this.error("syntax error")
  }

  program() {
    var s = /*this.toplevel()*/this.stmts()
      , begin = s.newlabel()
      , after = s.newlabel();
    s.emitlabel(begin);
    s.gen(begin, after);
    s.emitlabel(after);
  }

  toplevel() {
    switch (this.look.tag) {
      case Tag.CHAIN:
        this.move();
        if (this.look.tag == Tag.PULSE) {
          this.move();
          return this.CPBlock();
        } else if (this.look.tag == Tag.REPEATING) {
          this.move();
          return this.CRBlock();
        } else if (this.look.tag == "{")
          this.CPBlock();
        break;
    }
  }

  CPBlock() {
    this.match("{");
    var savedEnv = this.top;
    this.top = new Env(this.top);
    var s = this.CPStmts();
    this.match("}");
    this.top = savedEnv;
    return s
  }

  CPStmts() {
    if (this.look.tag == '}') return Stmt.Null;
    else if (this.look.tag == Tag.EOF) return Stmt.Null;
    else return new Seq(this.stmt(), this.stmts())
  }

  CPStmt() {
    var x, s, s1, s2, savedStmt;
    switch (this.look.tag) {
      case ';':
        this.move();
        return Stmt.Null;
      case Tag.IF:
        this.match(Tag.IF), this.match("("), x = this.bool(), this.match(")");
        s1 = this.stmt();
        if (this.look.tag != Tag.ELSE) return new If(x, s1);
        this.match(Tag.ELSE);
        s2 = this.stmt();
        return new Else(x, s1, s2);
      case Tag.BREAK:
        this.match(Tag.BREAK), this.match(";");
        return new Break();
      case "{":
        return this.block();
      case Tag.BASIC:
        return this.decl();
      case Tag.VANICMD:
        return this.bool();
      default:
        return this.assign();
    }
  }

  block() {
    this.match("{");
    var savedEnv = this.top;
    this.top = new Env(this.top);
    var s = this.stmts();
    this.match("}");
    this.top = savedEnv;
    return s
  }

  decl() {
    // D -> type ID
    var p = this.type();
    var tok = this.look;
    this.match(Tag.ID);
    var id = new Id(tok, p, this.used);
    this.top.put(tok, id);
    this.used += p.width;
    if (this.look.tag == ';') {
      this.match(";");
      return Stmt.Null
    } else if (this.look.tag == '=') {
      this.move();
      var stmt = new AssignExpr(id, this.bool());
      this.match(";");
      return stmt
    }
  }

  type() {
    var p = this.look;
    this.match(Tag.BASIC);
    return p;
  }

  stmts() {
    if (this.look.tag == '}') return Stmt.Null;
    else if (this.look.tag == Tag.EOF) return Stmt.Null;
    else return new Seq(this.stmt(), this.stmts())
  }

  stmt() {
    var x, s1, s2, savedStmt;
    switch (this.look.tag) {
      case ';':
        this.move();
        return Stmt.Null;
      case Tag.IF:
        this.match(Tag.IF), this.match("("), x = this.bool(), this.match(")");
        s1 = this.stmt();
        if (this.look.tag != Tag.ELSE) return new If(x, s1);
        this.match(Tag.ELSE);
        s2 = this.stmt();
        return new Else(x, s1, s2);
      case Tag.WHILE:
        var whilenode = new While();
        savedStmt = Stmt.Enclosing, Stmt.Enclosing = whilenode;
        this.match(Tag.WHILE), this.match("("), x = this.bool(), this.match(")");
        s1 = this.stmt();
        whilenode.init(x, s1);
        Stmt.Enclosing = savedStmt;
        return whilenode;
      case Tag.DO:
        var donode = new Do();
        savedStmt = Stmt.Enclosing, Stmt.Enclosing = donode;
        this.match(Tag.DO);
        s1 = this.stmt();
        this.match(Tag.WHILE), this.match("("), x = this.bool(), this.match(")"), this.match(";");
        donode.init(s1, x);
        Stmt.Enclosing = savedStmt;
        return donode;
      case Tag.BREAK:
        this.match(Tag.BREAK), this.match(";");
        return new Break();
      case "{":
        return this.block();
      case Tag.BASIC:
        return this.decl();
      case Tag.VANICMD:
        return this.bool();
      case Tag.ID:
        return this.assign();
      default:
        this.error("Syntax error: Unexpected " + this.look.tag)
    }
  }

  primaryExpr() {
    var stmt, t = this.look;
    this.match(Tag.ID);
    var id = this.top.get(t);
    if (id == void 0) this.error(t.toString() + " undeclared");
    if (this.look.tag == '=') { // S -> id = E
      this.move();
      stmt = new AssignExpr(id, this.bool());
    } else {
      while (this.look.tag == Tag.OR) {
        var tok = this.look; this.move(); x = new Or(tok, x, this.join())
      }
      return x
    }
    //this.error("Syntax error: Unexpected " + this.look.tag)
    this.match(";");
    return stmt
  }

  assign() {
    var stmt, t = this.look;
    this.match(Tag.ID);
    var id = this.top.get(t);
    if (id == void 0) this.error(t.toString() + " undeclared");
    if (this.look.tag == '=') { // S -> id = E
      this.move();
      stmt = new AssignExpr(id, this.bool());
    } else this.error("Syntax error: Unexpected " + this.look.tag)
    this.match(";");
    return stmt
  }

  bool() {
    var x = this.join();
    while (this.look.tag == Tag.OR) {
      var tok = this.look; this.move(); x = new Or(tok, x, this.join())
    }
    return x
  }

  join() {
    var x = this.equality();
    while (this.look.tag == Tag.AND) {
      var tok = this.look; this.move(); x = new And(tok, x, this.equality())
    }
    return x
  }

  equality() {
    var x = this.rel();
    while (this.look.tag == Tag.EQ || this.look.tag == Tag.NE) {
      var tok = this.look; this.move(); x = new Rel(tok, x, this.rel())
    }
    return x
  }

  rel() {
    var x = this.expr();
    switch (this.look.tag) {
      case '<': case Tag.LE: case Tag.GE: case '>':
        var tok = this.look;
        this.move();
        return new Rel(tok, x, this.expr());
      default:
        return x
    }
  }

  expr() {
    var x = this.term();
    while (this.look.tag == "+" || this.look.tag == "-") {
      var tok = this.look; this.move(); x = new Arith(tok, x, this.term())
    }
    return x
  }

  term() {
    var x = this.unary();
    while (this.look.tag == "*" || this.look.tag == "/") {
      var tok = this.look; this.move(); x = new Arith(tok, x, this.unary())
    }
    return x
  }

  unary() {
    if (this.look.tag == "-") {
      this.move(); return new Unary(Word.minus, this.unary())
    } else if (this.look.tag == "!") {
      var tok = this.look; this.move(); return new Not(tok, this.unary())
    } else return this.factor();
  }

  factor() {
    var x = void 0;
    switch (this.look.tag) {
      case '(':
        this.move(), x = this.bool(), this.match(')');
        return x;
      case Tag.NUM:
        x = new Constant(this.look, Type.Int);
        this.move();
        return x;
      case Tag.REAL:
        x = new Constant(this.look, Type.Float);
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
        var s = this.look.toString();
        var id = this.top.get(this.look);
        if (id == void 0) this.error(s + " undeclared");
        //id = this.assign(id);
        this.move();
        return id;
      case Tag.VANICMD:
        var s = this.look;
        this.move();
        return new VanillaCmd(s);
      default:
        this.error("syntax error");
        return x;
    }
  }
}

//str = fs.readFileSync("./compile/test", "utf8");

function run() {
  var str = document.getElementById("input").value;
  Token.uid = 0;
  ASTNode.labels = 0;
  var lex = new Lexer(str);
  var parse = new Parser(lex);
  parse.program();
  document.getElementById("output").value = Parser.result;
}