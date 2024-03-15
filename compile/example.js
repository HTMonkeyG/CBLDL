"use strict";

var fs = require("fs");

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
  WHILE: 275
}

var str = "", ptr = 0, ctr = 0;
function readNext() {
  if (ptr > str.length) throw new Error("");
  return str[ptr++]
}

class Token {
  constructor(t) { this.tag = t; this.uid = Token.uid++; }

  toString() { return this.tag }
}

Token.uid = 0;

class Num extends Token {
  constructor(v) { super(Tag.NUM); this.value = v }

  toString() { return this.value.toString() }
}

class Real extends Token {
  constructor(v) { super(Tag.REAL); this.value = v }

  toString() { return this.value.toString() }
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
  constructor() {
    this.words = new HashTable();
    this.peek = " ";
    this.reserve(new Word("if", Tag.IF));
    this.reserve(new Word("else", Tag.ELSE));
    this.reserve(new Word("while", Tag.WHILE));
    this.reserve(new Word("do", Tag.DO));
    this.reserve(new Word("break", Tag.BREAK));
    this.reserve(Word.False);
    this.reserve(Word.True);
    this.reserve(Type.Int);
    this.reserve(Type.Bool);
    this.reserve(Type.Char);
    this.reserve(Type.Float);
  }

  reserve(w) {
    this.words.put(w.lexeme, w)
  }

  readch(c) {
    this.peek = readNext();
    if (this.peek != c) return !1;
    this.peek = " ";
    return !0
  }

  scan() {
    for (; ; this.readch()) {
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
    }
    if (/\d/.test(this.peek)) {
      var v = 0;
      do {
        v = 10 * v + Number(this.peek);
        this.readch()
      } while (/\d/.test(this.peek))
      if (this.peek != ".") return new Num(v);
      var x = v, d = 10;
      for (; ;) {
        this.readch();
        if (!/\d/.test(this.peek)) break;
        x += Number(this.peek) / d;
        d *= 10;
      }
      return new Real(x)
    }
    if (/[A-Z]|[a-z]/.test(this.peek)) {
      var b = "";
      do {
        b += this.peek;
        this.readch()
      } while (/[A-Z]|[a-z]/.test(this.peek))

      var w = this.words.get(b);
      if (w != void 0) return w;
      w = new Word(b, Tag.ID);
      this.words.put(b, w);
      return w
    }
    var t = new Token(this.peek);
    this.peek = " ";
    return t
  }
}

Lexer.line = 1;

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
  static Float = new Type("float", Tag.BASIC, 8);
  static Char = new Type("char", Tag.BASIC, 1);
  static Bool = new Type("bool", Tag.BASIC, 1);

  static numeric(p) {
    if (p == Type.Char || p == Type.Int || p == Type.Float) return !0;
    else return !1
  }

  static max(p1, p2) {
    if (!this.numeric(p1) || !this.numeric(p2)) return void 0;
    else if (p1 == Type.Float || p2 == Type.Float) return Type.Float;
    else if (p1 == Type.Int || p2 == Type.Int) return Type.Int;
    else return Type.Char
  }
}

class Arr extends Type {
  constructor(s, p) { super("[]", Tag.INDEX, s * p.width); this.size = s; this.of = p; }
  toString() { return "[" + this.size + "] " + this.of.toString() }
}

class ASTNode {
  constructor() { this.lexline = Lexer.line; this.labels = 0; }
  static labels = 0;
  error(s) { throw new Error("near line " + Lexer.line + ": " + s) }
  newlabel() { return ++ASTNode.labels }
  emitlabel(i) { console.log("L" + i + ":") }
  emit(s) { console.log("\t" + s + "\n") }
}

class Expr extends ASTNode {
  constructor(t, p) { super(); this.op = t; this.type = p; }
  gen() { return this }
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
    var x = this.gen()
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

  gen() { return new Arith(this.op, this.expr1.reduce(), this.expr2.reduce()) }

  toString() { return this.expr1.toString() + " " + this.op.toString() + " " + this.expr2.toString() }
}

class Unary extends Op {
  constructor(tok, x) {
    super(tok, void 0);
    this.expr = x;
    this.type = Type.max(Type.Int, x.type);
    if (this.type == void 0) this.error("type error")
  }

  gen() { return new Unary(this.op, this.expr.reduce()) }

  toString() { return this.op.toString() + " " + this.expr.toString() }
}

class Temp extends Expr {
  constructor(p) { Temp.count = 0; super(Word.temp, p); this.number = ++Temp.count }
  toString() { return "t" + this.number }
}

class Constant extends Expr {
  constructor(a, b) {
    if (b) super(a, b);
    else super(new Num(a), Type.Int)
  }

  static True = new Constant(Word.True, Type.Bool);
  static False = new Constant(Word.False, Type.Bool);

  jumping(t, f) {
    if (this == Constant.True && t != 0) this.emit("goto L" + t);
    if (this == Constant.False && f != 0) this.emit("goto L" + f);
  }
}

class Logical extends Expr {
  constructor(tok, x1, x2) {
    super(tok, void 0);
    this.expr1 = x1;
    this.expr2 = x2;
    this.type = this.check(x1.type, x2.type);
    if (this.type == void 0) error("type error")
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
    if (p1 instanceof Arr || p2 instanceof Arr) return void 0;
    else if (p1 == p2) return Type.Bool;
    else return void 0
  }
  jumping(t, f) {
    var a = this.expr1.reduce()
      , b = this.expr2.reduce()
      , test = a.toString() + " " + this.op.toString() + " " + b.toString();
    this.emitjumps(test, t, f)
  }
}

class Access extends Op {
  constructor(a, i, p) {
    super(new Word("[]", Tag.INDEX), p);
    this.array = a;
    this.index = i;
  }
  gen() { return new Access(this.array, this.index.reduce(), this.type) }
  jumping() { this.emitjumps(this.reduce().toString(), t, f) }
  toString() {
    return this.array.toString() + " [ " + this.index.toString() + " ] "
  }
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

class While extends Expr {
  constructor() { super(); this.expr = null; this.stmt = null; }

  init(x, s) {
    this.expr = x;
    this.stmt = s;
    if (this.expr.type != Type.Bool) this.expr.error("boolean required in while")
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

class Do extends Expr {
  constructor() { super(); this.expr = null; this.stmt = null; }

  init(s, x) {
    this.expr = x;
    this.stmt = s;
    console.log(this.expr.type)
    if (this.expr.type != Type.Bool) this.expr.error("boolean required in while")
  }

  gen(b, a) {
    this.after = a;
    var label = this.newlabel();
    this.stmt.gen(b, label);
    this.emitlabel(label);
    this.expr.jumping(b, 0);
  }
}

class StmtSet extends Stmt {
  constructor(i, x) {
    super();
    this.id = i;
    this.expr = x;
    if (this.check(i.type, x.type) == void 0) this.error("type error")
  }

  check(p1, p2) {
    if (Type.numeric(p1) && Type.numeric(p2)) return p2;
    else if (p1 == Type.Bool && p2 == Type.Bool) return p2;
    else return void 0
  }

  gen(b, a) {
    this.emit(this.id.toString() + " = " + this.expr.gen().toString())
  }
}

class SetElem extends Stmt {
  constructor(x, y) {
    super();
    this.array = x.array;
    this.index = x.index;
    this.expr = y;
    if (this.check(x.type, y.type) == void 0) this.error("type error")
  }

  check(p1, p2) {
    if (p1 instanceof Arr && p2 instanceof Arr) return void 0;
    else if (p1 == p2) return p2;
    else if (Type.numeric(p1) && Type.numeric(p2)) return p2;
    else return void 0
  }

  gen(b, a) {
    var s1 = this.index.reduce().toString()
      , s2 = this.expr.reduce().toString();
    this.emit(this.array.toString() + " [ " + s1 + " ] = " + s2)
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
    if (this.stmt2 == Stmt.Null) this.stmt1.gen(b, a);
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

class Parser {
  constructor(l) {
    this.lex = l;// 词法分析器
    this.look = void 0;// 向前看词法单元
    this.used = 0;// 当前或顶层符号表
    this.top = void 0;// 用于声明变量的存储位置
    this.move();
  }

  move() { this.look = this.lex.scan(); }
  error(s) { throw new Error("near line " + Lexer.line + ":" + s) }

  match(t) {
    if (this.look.tag == t) this.move();
    else this.error("syntax error")
  }

  program() {
    var s = this.block()
      , begin = s.newlabel()
      , after = s.newlabel();
    s.emitlabel(begin);
    s.gen(begin, after);
    s.emitlabel(after);
  }

  block() {
    this.match("{");
    var savedEnv = this.top;
    this.top = new Env(this.top);
    this.decls();
    var s = this.stmts();
    this.match("}");
    this.top = savedEnv;
    return s
  }

  decls() {
    while (this.look.tag == Tag.BASIC) { // D -> type ID
      var p = this.type();
      var tok = this.look;
      this.match(Tag.ID);
      this.match(";");
      var id = new Id(tok, p, this.used);
      this.top.put(tok, id);
      this.used += p.width;
    }
  }

  type() {
    var p = this.look;
    this.match(Tag.BASIC);
    if (this.look.tag != '[') return p;
    else return this.dims(p);
  }

  dims(p) {
    this.match('[');
    var tok = this.look;
    this.match(Tag.NUM);
    this.match(']');
    if (this.look.tag == '[')
      p = this.dims(p);
    return new Arr(tok.value, p)
  }

  stmts() {
    if (this.look.tag == '}') return Stmt.Null;
    else return new Seq(this.stmt(), this.stmts())
  }

  stmt() {
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
      default:
        return this.assign();
    }
  }

  assign() {
    var stmt, t = this.look;
    this.match(Tag.ID);
    var id = this.top.get(t);
    if (id == void 0) this.error(t.toString() + " undeclared");
    if (this.look.tag == '=') { // S -> id = E
      this.move();
      stmt = new StmtSet(id, this.bool());
    } else {  // S - > L = E
      var x = this.offset(id);
      this.match("=");
      stmt = new SetElem(x, this.bool())
    }
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
        this.move();
        if (this.look.tag != "[") return id;
        else return this.offset(id);
      default:
        this.error("syntax error");
        return x;
    }
  }

  offset(a) { // I -> [E] | [E] I
    var i, w, t1, t2, loc, type = a.type;
    this.match("[");
    i = this.bool();
    this.match("]"); // 第一个下标, I -> [E]
    type = type.of;
    w = new Constant(type.width);
    t1 = new Arith(new Token("*"), i, w);
    while (this.look.tag == '[') { // 多维下标, I -> [E]I
      this.match("[");
      i = this.bool();
      this.match("]");
      type = type.of;
      w = new Constant(type.width);
      t1 = new Arith(new Token("*"), i, w);
      t2 = new Arith(new Token("+"), loc, t1);
      loc = t2;
    }
    return new Access(a, loc, type)
  }
}


str = fs.readFileSync("./compile/test", "utf8");

var lex = new Lexer();
var parse = new Parser(lex);
parse.program();
console.log("\n");