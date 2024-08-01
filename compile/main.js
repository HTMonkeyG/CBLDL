/**
 * HLCL Compiler
 * For CBLDL Specification v1.2
 * MCBE v1.20
 * By HTMonkeyG
 * Bilibili & GitHub: HTMonkeyG
 * 
 * Reference: 
 *   Alfred V. Aho, Ravi Sethi, Jeffrey D. Ullman.
 *   Compilers: Principles, Techniques, and Tools. 2nd ed.
 */

"use strict";

const TokenTag = {
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
  INITIAL: 290,
  EXECUTESUB: 291,
  DELETE: 292,
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

var options = {
  defaultScb: "bkstage",
  targetVersion: 10200
};

class HashTable { constructor() { this.KV = {} } put(k, v) { this.KV[k] = v; } get(k) { return this.KV[k] } }

class CompileError extends Error {
  constructor(type, message, input, cursor) { super(); }
}

/** A syntax token */
class Token {
  /** 
   * @param {*} t - Tag of the token
   */
  constructor(t) { this.tag = t; this.uid = Token.uid++ }
  toString() { return this.tag }
  static uid = 0;
  static EOF = new Token(TokenTag.EOF)
}

/** A numeric token */
class NumericLiteral extends Token {
  /**
   * @param {Number} v - Numeric value
   */
  constructor(v) { super(TokenTag.NUM); this.value = v }
  getValue() { return this.value }
  toString() { return this.value.toString() }
  isInteger() { return Math.isInteger(this.value) }
}

/** A string token */
class StringLiteral extends Token {
  /**
   * @param {String} v - String value
   */
  constructor(v) { super(TokenTag.STRING); this.value = v }
  toString() { return '"' + this.value + '"' }
}

/** A vanilla command token */
class VaniCmdLiteral extends Token {
  /**
   * @param {String} v - String value of this segment
   * @param {*} t - Tag
   */
  constructor(v, t) { super(t ? t : TokenTag.VANICMD); this.cmd = v }
  toString() { return this.cmd }
}

/** A selector */
class SelectorLiteral extends Token {
  /**
   * @param {String} v - String value of selector
   */
  constructor(v) { super(TokenTag.SELECTOR); this.value = v }
  toString() { return this.value }
}

/** Abstract representation of execution context */
class EntityLayer {
  static Type = {
    AS: 0,
    AT: 1,
    ALIGN: 2,
    ANCHORED: 3,
    FACING: 4,
    FACINGENT: 5,
    IN: 6,
    ROTATED: 7,
    POSITIONED: 8,
    POSITIONEDAS: 9,
    IF: 10,
    UNLESS: 11
  };
  static Initial = new EntityLayer(void 0, void 0, void 0);
  /**
   * @param {EntityLayer|undefined} prev - Previous entity layer
   * @param {String} type - Current layer's type
   * @param {*} param - Current layer's param
   */
  constructor(prev, type, param) { this.prev = prev; this.type = type; this.param = param }
  withRoot(l) {
    for (var c = this; c.prev; c = c.prev)
      if (l == c) throw new Error("Try to generate loop in entity layer")
    return c.prev = l;
  }
  toString() {
    if (!this.prev) return "";
    return this.prev.toString() + " " + EntityLayer.Type[this.type] + " " + this.param;
  }
}

// execute ... 
class PayloadLayer extends EntityLayer {
  constructor() {
    super()
  }
}

// execute ... if|unless score <RelationalExpression> ...
// execute ... if|unless block <String:pos> <String:block> ...
// execute ... if|unless blocks <String:pos> <String:pos> <String:pos> <String:mode>
// execute ... if|unless entity <Selector>
class ConditionLayer extends EntityLayer {
  static Conditions = {
    SCORE: 1,
    BLOCK: 2,
    BLOCKS: 3,
    ENTITY: 4
  }
  constructor(prev, isUnless, condition) {
    super(prev, isUnless ? EntityLayer.Type.UNLESS : EntityLayer.Type.IF, condition);
  }
}

class Word extends Token {
  constructor(s, t) { super(t); this.lexeme = s }
  toString() { return this.lexeme }
  static and = new Word("&&", TokenTag.AND);
  static or = new Word("||", TokenTag.OR);
  static eq = new Word("==", TokenTag.EQ);
  static ne = new Word("!=", TokenTag.NE);
  static le = new Word("<=", TokenTag.LE);
  static ge = new Word(">=", TokenTag.GE);
  static gs = new Word("->", TokenTag.GS);
  static ae = new Word("=>", TokenTag.AE);
  static minus = new Word("minus", TokenTag.MINUS);
  static True = new Word("true", TokenTag.TRUE);
  static False = new Word("false", TokenTag.FALSE);
  static temp = new Word("t", TokenTag.TEMP);
}

/**
 * Virtual entity
 */
class Register {
  constructor() {
    var s = () => Math.floor(Math.random() * 16).toString(16), n = '';
    for (var i = 0; i < 8; i++) n += s();
    this.name = "R_" + n;
  }

  toString() {
    return this.name + " " + options.defaultScb;
  }
}

class RegisterPool {
  static registers = [];
  static createRegister() {
    var r = new Register(), p;
    for (var e of RegisterPool.registers)
      if (e.name == r.name)
        return RegisterPool.createRegister();
    RegisterPool.registers.push(r);
    return r
  }
  static Global = new RegisterPool();

  constructor() {
    this.registers = new Map();
  }

  /**
   * Try to assign register for given variable
   * @param {Reference} v - Variable
   */
  getRegFor(v) {
    if (v.reg) return false;
    for (var e of this.registers) {
      if (!e[1]) {
        v.reg = e[0];
        this.registers.set(e, v);
        return true;
      }
    }
    this.registers.set(v.reg = RegisterPool.createRegister(), v);
    return true;
  }

  /**
   * Release register for given variable
   * @param {Reference} v - Variable
   */
  releaseRegFor(v) {
    if (!v.reg) return false;
    var s = this.registers.size;
    this.registers.set(v.reg, null);
    if (s != this.registers.size)
      throw new Error("Failed to release register.");
    v.reg = null;
  }
}

class Type extends Word {
  constructor(s, tag, c) { super(s, tag); this.const = c }

  isConst() { return this.const }

  static Int = new Type("int", TokenTag.BASIC, false);
  static Float = new Type("float", TokenTag.BASIC, true);
  static Bool = new Type("bool", TokenTag.BASIC, false);
  static String = new Type("string", TokenTag.BASIC, true);
  static Vector = new Type("vector", TokenTag.BASIC, true);
  static Selector = new Type("sel", TokenTag.BASIC, true);

  static Const = new Type("const", TokenTag.BASIC, true);
  static Var = new Type("var", TokenTag.BASIC, false);

  static numeric(p) {
    if (p == Type.Int || p == Type.Vector) return !0;
    else return !1
  }

  static max(p1, p2) {
    if (p1 == Type.Int && p2 != Type.String) return Type.Int;
    else if (p2 == Type.Int && p1 != Type.String) return Type.Int;
    else if (p1 == Type.Vector && p2 != Type.String) return Type.Int;
    else if (p2 == Type.Vector && p1 != Type.String) return Type.Int;
    else return void 0;
  }

  /** 
   * Convert given expression to boolean 
   * @param {Expr} x - Expression
   * @returns {Expr}
   */
  static toBoolean(x) {
    if (x.type == Type.Int || x.type == Type.Vector || x.type == Type.Selector)
      return new Rel(Word.ne, x, Constant.from(0))
    else return x;
  }

  /** 
   * Convert given expression to int 
   * @param {Expr} x - Expression
   * @returns {Expr}
   */
  static toInt(x) {
    if (x.type == Type.Float) {
      var v = Expr.getConstValue(x);
      return Constant.from(Math.round(v))
    } else return x;
  }
}

class ExecuteSubcommand extends Word {
  constructor(s, tag, type) { super(s, tag); this.type = type }
  static As = new ExecuteSubcommand("as", TokenTag.ID, EntityLayer.Type.AS);
  static At = new ExecuteSubcommand("at", TokenTag.ID, EntityLayer.Type.AT);
  static Align = new ExecuteSubcommand("align", TokenTag.ID, EntityLayer.Type.ALIGN);
  static Anchored = new ExecuteSubcommand("anchored", TokenTag.ID, EntityLayer.Type.ANCHORED);
  static Facing = new ExecuteSubcommand("facing", TokenTag.ID, EntityLayer.Type.FACING);
  static In = new ExecuteSubcommand("in", TokenTag.ID, EntityLayer.Type.IN);
  static Rotated = new ExecuteSubcommand("rotated", TokenTag.ID, EntityLayer.Type.ROTATED);
  static Positioned = new ExecuteSubcommand("postitoned", TokenTag.ID, EntityLayer.Type.POSITIONED);
  static If = new ExecuteSubcommand("if", TokenTag.IF, EntityLayer.Type.IF);
  static Unless = new ExecuteSubcommand("unless", TokenTag.ID, EntityLayer.Type.UNLESS);
}

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
  function reserve(w) { words.put(w.lexeme, w) }
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
      words.put(b, w);
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
    return /[a-z$A-Z_\u4e00-\u9fa5]/.test(peek)
    //return !/[\ ~`!@#%\^&\*\(\)\-=+\|\\'":;\?\/\.><,\[\]\}\{0-9]/.test(peek)
    //return !/[\ -#%-@\[-\^`\{-\~]/.test(peek)
  }

  function isUnquotedString() {
    return /[a-z0-9$A-Z_\u4e00-\u9fa5]/.test(peek)
    //return !/[\ ~`!@#%\^&\*\(\)\-=+\|\\'":;\?\/\.><,\[\]\}\{]/.test(peek)
    //return !/[\ -#%-\/:-@\[-\^`\{-\~]/.test(peek)
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

  var words = new HashTable()
    , str = s.replace(/(\/\*(.|\r?\n)*\*\/)|(\/\/.*\n)/g, "") // Ignore comments
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

/**
 * Symbol table implement
 */
class Env {
  constructor(n) {
    this.table = new Map();
    this.prev = n;
  }

  put(w, i) { this.table.set(w, i) }

  get(w) {
    for (var i = this, found; i != void 0; i = i.prev)
      if ((found = i.table.get(w)), found != void 0) return found;
    return void 0
  }
}

class CB {
  static Type = {
    PULSE: 0,
    CHAIN: 1,
    REPEAT: 2
  };
  static from(cmd, type) { return (new CB(cmd)).setType(type || CB.Type.CHAIN) }
  constructor(cmd) {
    this.cmd = cmd;
    this.rsctl = false;
    this.condition = false;
    this.type = CB.Type.PULSE
    this.delay = 0;
  }
  setCondition(t) { this.condition = t; return this }
  setRedstone(t) { this.redstone = t; return this }
  setType(t) { this.type = t; return this }
  setDelay(t) { this.delay = t; return this }
}

/** Array of command blocks. @extends Array */
class CBSubChain extends Array {
  constructor() { super() }
  pushCB(cmd, type, delay) { this.push(CB.from(cmd, type).setDelay(delay || 0)) }
}

/**
 * TAC Module
 * 
 * Array of baseblock.
 * 
 * @extends Array
 */
class TAC extends Array {
  static Mode = { CP: 0, CR: 1, M: 2 };

  /**
   * @param {Number} m - Mode
   */
  constructor(m) {
    super();
    this.mode = m;
    // Calculated by paser
    this.totalDelay = 0;
    this.chain = new CBSubChain();
  }

  gen() {
    this.chain = new CBSubChain();

    for (var BB of this) {
      for (var Inst of BB) {
        /* Calculate lastRead and lastWrite */
        var x1, x2;
        switch (Inst.type) {
          case "assign": case "assigncomp":
            x1 = Inst.id;
            if (x1.tag == ExprTag.REF)
              x1.lastWrite = Inst;
          case TACGoto.Type.IF: case TACGoto.Type.UNLESS:
            x2 = Inst.expr;
            if (x2.tag == ExprTag.REF)
              x2.lastRead = Inst;
            else if (x2.tag == ExprTag.UNARY && x2.expr.tag == ExprTag.REF)
              x2.expr.lastRead = Inst;
            else if (x2.tag == ExprTag.ARITH || x2.tag == ExprTag.REL) {
              if (x2.expr1.tag == ExprTag.REF)
                x2.expr1.lastRead = Inst;
              if (x2.expr2.tag == ExprTag.REF)
                x2.expr2.lastRead = Inst;
            }
            break;
          case "vanilla":
            break;
        }
      }
    }

    if (this.mode != TAC.Mode.M && !this.totalDelay)
      this.registerPool = RegisterPool.Global;
    else this.registerPool = new RegisterPool();

    var state = new Temp(Type.Int);
    this.registerPool.getRegFor(state);
    this.chain.pushCB(`scoreboard players set ${state} 0`);

    if (this.mode != TAC.Mode.M) {
      var delay = 0;
      for (var bb of this) {
        delay = bb.gen(this.registerPool, state, delay || 0);
        this.chain = this.chain.concat(bb.chain);
      }
    }

    this.registerPool.releaseRegFor(state);

    if (this.mode == TAC.Mode.CP) {
      this.chain[0].type = CB.Type.PULSE;
    } else if (this.mode == TAC.Mode.CR) {
      this.chain[0].type = CB.Type.REPEAT;
      this.chain[0].delay = this.totalDelay;
    }
  }
}

/**
 * TAC Baseblock
 * 
 * Array of TAC instructions.
 * 
 * @extends Array
 */
class TACBaseBlock extends Array {
  constructor(id) {
    super();
    this.chain = new CBSubChain();
    this.id = id
  }

  /**
   * Generate CB
   * @param {RegisterPool} regPool - Register assigner
   * @param {Temp} state - Variable to storage state
   * @param {Number} delay - Delay of first CB
   * @returns {Number} Delay of next CB
   */
  gen(regPool, state, delay) {
    var delay_ = delay;
    this.chain = new CBSubChain();
    for (var inst of this) {
      delay_ = inst.gen(regPool, state, this.chain, this.id, delay_ || 0);
    }
    for (var cb of this.chain) {
      cb.cmd = `execute if score ${state} matches ${this.id} run ${cb.cmd}`;
    }
    return delay_
  }
}

class TACInst {
  static Type = {
    LABEL: 0,
    ASSIGN: 1,
    ASSIGNCOMP: 2,
    IF: 3,
    UNLESS: 4,
    DELAYH: 5,
    GOTO: 6,
    VANILLA: 7
  };

  constructor(t) {
    this.type = t;
    this.lastWrite = [];
    this.lastRead = []
  }

  /**
   * Generate commands
   * @param {RegisterPool} regPool - Register pool
   * @param {Reference} state - Variable to storage state
   * @param {CBSubChain} chain - Array of command blocks
   * @param {Number} id - Sequence number of baseblock
   * @param {Number} delay - Delay of the first CB of subchain
   */
  gen(regPool, state, chain, id, delay) { }
}

class TACLabel extends TACInst {
  constructor(n) {
    super("label");
    this.label = n;
    this.onUse = [];
    this.baseblock = null
  }
  mark(i) { this.onUse.push(i) }
}

class TACDelayH extends TACInst {
  /**
   * @param {Reference|NumericLiteral} t - Delay in tick
   */
  constructor(t) {
    super("delayh");
    this.delay = t;
  }

  gen() { return this.delay }
}

/** Goto TAC instruction. @extends TACInst */
class TACGoto extends TACInst {
  static Type = {
    GOTO: 0,
    IF: 1,
    UNLESS: 2
  };

  /**
   * @param {TACLabel} l - Label
   * @param {Number|undefined} c - Type
   * @param {Expr} t - Condition
   */
  constructor(l, c, t) {
    super(void 0);

    this.type = c || TACGoto.Type.GOTO;
    this.expr = t;
    this.label = l;
  }

  gen(regPool, state, chain, id, delay) {
    //console.log(this, this.expr.toString())
    if (options.targetVersion > 10180) {
      switch (this.type) {
        case TACGoto.Type.GOTO:
          chain.pushCB(
            `scoreboard players set ${state} ${this.label.baseblock.id}`,
            CB.Type.CHAIN,
            delay
          );
          break;
        case TACGoto.Type.IF:
          chain.pushCB(
            `execute if score ${this.expr.toString()} run scoreboard players set ${state} ${this.label.baseblock.id}`,
            CB.Type.CHAIN,
            delay
          );
          break;
        case TACGoto.Type.UNLESS:
          chain.pushCB(
            `execute unless score ${this.expr.toString()} run scoreboard players set ${state} ${this.label.baseblock.id}`,
            CB.Type.CHAIN,
            delay
          );
          break;
      }
    }
  }
}

class TACVanilla extends TACInst {
  constructor(c) {
    super("vanilla");
    this.cmd = c
  }

  gen(regPool, state, chain, id, delay) {
    chain.pushCB(this.cmd.toString(), CB.Type.CHAIN, delay);
  }
}

/** 
 * TAC assignment instruction.
 * 
 * id1 = id2 op id3
 * 
 * @extends TACInst 
 */
class TACAssign extends TACInst {
  constructor(i, e, o) {
    super(void 0);
    if (o)
      this.type = "assigncomp", this.id = i, this.expr = e, this.op = o;
    else
      this.type = "assign", this.id = i, this.expr = e;
  }

  gen(regPool, state, chain, id, delay) {
    function assignReg(v) { return regPool.getRegFor(v) }
    function releaseReg(v) { return regPool.releaseRegFor(v) }

    var x1 = this.id, x2 = this.expr;
    if (this.type == "assign") {
      var x21, x22, r;
      switch (x2.tag) {
        case ExprTag.CONST:
          assignReg(x1);
          chain.pushCB(`scoreboard players set ${x1} ${x2}`, CB.Type.CHAIN, delay);
          break;

        case ExprTag.GS:
          assignReg(x1);
          chain.pushCB(`scoreboard players operation ${x1} = ${x2}`, CB.Type.CHAIN, delay)
          break;

        case ExprTag.REF:
          r = x2.reg;
          if (x2.lastRead == this)
            releaseReg(x2);
          assignReg(x1);
          x1.reg != r && chain.pushCB(`scoreboard players operation ${x1} = ${r}`, CB.Type.CHAIN, delay);
          break;

        case ExprTag.SELECTOR:
          assignReg(x1);
          chain.pushCB(`scoreboard players set ${x1} 0`, CB.Type.CHAIN, delay);
          chain.pushCB(`execute as ${x2} run scoreboard players add ${x1} 1`, CB.Type.CHAIN);
          break;

        case ExprTag.ARITH:
          assignReg(x1);
          x21 = x2.expr1, x22 = x2.expr2;
          // First cmd
          if (x21.tag == ExprTag.GS || (x21.tag == ExprTag.REF && x1.reg != x21.reg))
            chain.pushCB(`scoreboard players operation ${x1} = ${x21}`, CB.Type.CHAIN, delay);
          else if (x21.tag == ExprTag.CONST)
            chain.pushCB(`scoreboard players set ${x1} ${x21}`, CB.Type.CHAIN, delay);

          // Second cmd
          if (x22.tag == ExprTag.REF || x22.tag == ExprTag.GS)
            chain.pushCB(`scoreboard players operation ${x1} ${x2.op.tag}= ${x22}`, CB.Type.CHAIN);
          else if (x22.tag == ExprTag.CONST)
            chain.pushCB(`scoreboard players operation ${x1} ${x2.op.tag}= ${x22}`, CB.Type.CHAIN);
          if (x21.lastRead == this) releaseReg(x21);
          if (x22.lastRead == this) releaseReg(x22);
          break;

        case "++":
          assignReg(x1);
          chain.pushCB(`scoreboard players add ${x1} 1`, CB.Type.CHAIN, delay);
          break;

        case "--":
          assignReg(x1);
          chain.pushCB(`scoreboard players add ${x1} -1`, CB.Type.CHAIN, delay);
          break;
      }
    } else if (this.type == "assigncomp") {
      if (x1.tag == ExprTag.SELECTOR && x2.tag == ExprTag.CONST) {
        if (this.op.tag == '+=')
          // <Selector> += <StringLiteral>
          //  => tag <Selector> add <StringLiteral>
          chain.pushCB(`tag ${x1} add ${x2}`, CB.Type.CHAIN, delay);

        else if (this.op.tag == '-=')
          // <Selector> -= <StringLiteral>
          //  => tag <Selector> remove <StringLiteral>
          chain.pushCB(`tag ${x1} remove ${x2}`, CB.Type.CHAIN, delay);
      } else if (x1.tag == ExprTag.REF || x1.tag == ExprTag.GS) {
        assignReg(x1);
        chain.pushCB(`scoreboard players operation ${x1} ${this.op} ${x2}`, CB.Type.CHAIN, delay);
        if (x2.lastRead == this) releaseReg(x2);
        if (x2.lastRead == this) releaseReg(x2);
      }
    }
  }
}

/** Abstract Syntax Tree Node */
class ASTNode {
  constructor() { this.lexline = ASTNode.lexer && ASTNode.lexer.getLine(); this.labels = 0; this.entityLayer = void 0 }
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
  emitlabel(i) { ASTNode.parser.appendTAC(i) }
  emit(s) { ASTNode.parser.append("\t" + s + "\n") }
  /**
   * Gen an if-goto.
   * @param {Expr} t - Condition
   * @param {TACLabel} l - Label 
   */
  emitif(t, l) { var i = new TACGoto(l, TACGoto.Type.IF, t); l.mark(i); ASTNode.parser.appendTAC(i) }
  /**
   * Gen a direct goto.
   * @param {TACLabel} l - Label 
   */
  emitgoto(l) { var i = new TACGoto(l); l.mark(i); ASTNode.parser.appendTAC(i) }
  /**
   * Gen an iffalse-goto.
   * @param {Expr} t - Condition
   * @param {TACLabel} l - Label 
   */
  emitiffalse(t, l) { var i = new TACGoto(l, TACGoto.Type.UNLESS, t); l.mark(i); ASTNode.parser.appendTAC(i) }
  /** 
   * Gen a TAC operation.
   * @param {Id | GetScore} i - Condition
   * @param {Expr} e - Expression
   */
  emitassign(i, e) { ASTNode.parser.appendTAC(new TACAssign(i, e)) }
  /** 
   * Gen a TAC assigncomp.
   * @param {Id | GetScore} i - Condition
   * @param {Token} o - Operator
   * @param {Expr} e - Expression
   */
  emitassigncomp(i, o, e) { ASTNode.parser.appendTAC(new TACAssign(i, e, o)) }
  /** 
   * Gen a vanilla command.
   * @param {VanillaCmdNoTag} c - Command
   */
  emitvanilla(c) { ASTNode.parser.appendTAC(new TACVanilla(c)) }
  /** 
   * Gen a delay hard.
   * @param {NumericLiteral} t - Delay time
   */
  emitdelayh(t) { ASTNode.parser.appendTAC(new TACDelayH(t)) }
}

/** Statement implement. @extends ASTNode */
class Stmt extends ASTNode {
  constructor() { super(); this.after = 0; this.useLabel = 0 }
  static Null = new Stmt();
  static Enclosing = Stmt.Null;
  /** 
   * Gen as a stmt.
   * @param {TACLabel} b - Label of this statement
   * @param {TACLabel} a - Label of next statement
   * @param {EntityLayer} l - Entity layer of this statement
   */
  gen(b, a, l) {/* Empty placeholder for child class */ }
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
    var label = this.newlabel(); // label of stmt
    this.expr.jumping(0, a);     // Control flow crosses when expr == true
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
 * 
 * Seq -> Stmt
 *      | Stmt Seq
 * @extends Stmt 
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

/**
 * Hard delay statement. 
 * 
 * Using internal execution delay in CB.
 * 
 * @extends Stmt
 */
class DelayH extends Stmt {
  /**
   * @param {Expr} x - Inteval in ticks
   */
  constructor(x) {
    super();
    if (x.type != Type.Int)
      this.error("Type error: Delay must be an integer.");
    var v = Expr.getConstValue(x);
    if (!v)
      this.error("Reference error: Only constants can be used in delayh.");
    this.delay = v;
  }
  gen(b, a) { this.emitdelayh(this.delay) }
}

class Delete extends Stmt {
  /**
   * @param {Reference} x - Inteval in ticks
   */
  constructor(x) {
    super();
    if (x.type != Type.Int)
      this.error("Type error: Delay must be an integer.");
    if (x.tag != ExprTag.CONST && x.tag != ExprTag.REF)
      this.error("Syntax error");
    if (x.tag == ExprTag.REF && !x.getConst())
      this.error("Reference error: Only constants can be used in delayh.");
    this.delay = x;
  }

  gen() {

  }
}

/** 
 * Execute statement. 
 *
 * Changes the executor of commands.
 * 
 * @extends Stmt 
 */
class ExecuteStmt extends Stmt {
  /** 
   * Arrow execute statement. 
   *
   * A syntatic sugar of `execute as ${...} at #s run ...`
   * 
   * @param {Expr} tok - Target
   * @param {EntityLayer} top - Top entity layer
   */
  static createArrowExecuteEL(tok, top) {
    return new EntityLayer(
      new EntityLayer(top, EntityLayer.Type.AS, tok)
      , EntityLayer.Type.AT
      , new Selector(new SelectorLiteral("@s"))
    )
  }

  /**
   * @param {EntityLayer} l - Entity layer stack
   * @param {Stmt} s - Statement
   */
  constructor(l, s) {
    super();
    this.stmt = s;
    this.entityLayer = l;
  }

  gen(b, a, l) {
    console.log("execute as ", this.entityLayer)
    this.stmt.gen(b, a, this.entityLayer);
  }
}

/** Expression implement. @extends Stmt */
class Expr extends Stmt {
  /**
   * Create a expression AST node.
   * @param {Token} t - Token representing the expression
   * @param {Type} p - Type of the expression
   */
  constructor(t, p) { super(); this.op = t; this.type = p; this.tag = ExprTag.EXPR }

  /** Gen as the right-hand side of a TAC. */
  genRightSide() { return this }

  /** 
   * Gen as a single reference.
   * @param {Number} a - Tag of caller
   */
  reduce(a) { return this }

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

  /**
   * Try to get a primitive value from Expr node.
   * @param {Expr} x - Expression
   * @returns {*} Primitive value
   */
  static getConstValue(x) {
    if ((x.tag == ExprTag.REF && x.getConst() && x.type != Type.Vector && x.type != Type.Selector) || x.tag == ExprTag.CONST)
      return x.getValue().getValue();
    else
      return void 0
  }
}

/** Reference type implement. @extends Expr */
class Reference extends Expr {
  /**
   * @param {Token} tok - Token of the identifier
   * @param {Type} p - Type of the identifier
   * @param {Boolean} isConst - True if constant type
   */
  constructor(tok, p, isConst) {
    super(tok, p);
    this.tag = ExprTag.REF;
    this.const = !!isConst;
    this.lastRead = null;
    this.lastWrite = null;
    this.value = null;
    this.reg = null
  }

  getConst() { return this.const }

  /**
   * Set initial value & type of id.
   * 
   * @param {Expr} v - Initial value
   */
  setValue(v) {
    if (!this.const)
      this.error("Reference error: Try to init a variable as a const.");
    if (v.tag != ExprTag.GS && v.tag != ExprTag.CONST && v.tag != ExprTag.SELECTOR)
      this.error("Reference error: Can't init a const with an expression.");
    this.type = v.type;
    this.value = v;
  }

  getValue() {
    if (this.const) {
      if (!this.value)
        this.error("Reference Error: Try to read uninited const.");
      return this.value;
    } else
      this.error("Reference Error: Try to read static value of a variable.")
  }

  /**
   * Set initial type of id.
   * 
   * @param {Type} p - Initial type
   */
  setType(p) {
    if (this.type)
      this.error("Reference error: Repeated type init.");
    this.type = p;
  }

  getReg() {
    if (this.const || this.reg) return;
    else return this.reg
  }

  /** 
   * @param {Boolean} s - Return string literal if true
   */
  toString(s) { if (!s) return this.reg.toString(); else return this.op.toString() }
}

/** Identifier implement. @extends Reference */
class Id extends Reference {
  /**
   * @param {Token} id - Token of the identifier
   * @param {Type} p - Type of the identifier
   * @param {Number} b - UID of the identifier
   * @param {Boolean} c - True if constant type
   */
  constructor(id, p, b, c) {
    super(id, p, c);
    this.offset = b;
  }
  genRightSide() { if (this.const) return this.value; else return this }
  reduce() { return this.genRightSide() }
}

/** Temp variable implement. @extends Reference */
class Temp extends Reference {
  /**
   * @param {Type} p - Type of temp
   */
  constructor(p) {
    super(Word.temp, p, p.isConst());
    this.number = ++Temp.count;
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
  reduce(a) {
    var x = this.genRightSide()
      , t = new Temp(this.type);
    this.emitassign(t, x);
    return t
  }
}

/** Arith expression implement. @extends Op */
class Arith extends Op {
  static preCalc(x1, tok, x2) {
    var s = tok.toString();
    switch (s) {
      case '+':
        return x1 + x2;
      case '-':
        return x1 - x2;
      case '*':
        return x1 * x2;
      case '/':
        return x1 / x2;
      case '%':
        return x1 % x2;
      default:
        return NaN
    }
  }

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

  calc() {
    var x1 = Expr.getConstValue(this.expr1), x2 = Expr.getConstValue(this.expr2), v;
    if (x1 && x2) {
      v = Arith.preCalc(x1, this.op, x2);
      if (!Number.isNaN(v))
        return Constant.from(v);
      return void 0
    } else
      return void 0;
  }

  reduce() {
    var v;
    if (typeof (v = this.calc()) !== 'undefined')
      return v;
    var x = this.genRightSide()
      , t = new Temp(this.type);
    this.emitassign(t, x);
    return t
  }

  genRightSide() {
    var v;
    if (typeof (v = this.calc()) !== 'undefined')
      return v;
    return new Arith(this.op, this.expr1.reduce(), this.expr2.reduce(this.tag))
  }

  toString() { return this.expr1.toString() + " " + this.op.toString() + " " + this.expr2.toString() }
}

/** 
 * GetScore expression implement.
 * 
 * The usage of scoreboard in HLCL.
 * 
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
    //if (a == ExprTag.ASSICOMP)
    return x
    //else {
    t = new Temp(Type.Int);
    this.emitassign(t, x);
    return t
    //}
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
  static True = new Constant(new NumericLiteral(1), Type.Bool);
  static False = new Constant(new NumericLiteral(0), Type.Bool);
  getValue() { return this.op }
  jumping(t, f) {
    if (this == Constant.True && t != 0) this.emitgoto(t);
    if (this == Constant.False && f != 0) this.emitgoto(f);
  }
  reduce(a) {
    if (this.type == Type.Int && a == ExprTag.ARITH) {
      var x = this.genRightSide()
        , t = new Temp(Type.Int);
      this.emitassign(t, x);
      return t
    } else
      return this
  }
  /**
   * Build a constant from primitive value
   * @param {*} v - Primitive value
   * @param {Type} p - Type
   * @returns {Constant}
   */
  static from(v, p) {
    var t;
    switch (p) {
      case Type.String:
        t = new StringLiteral(v);
        break;
      case Type.Int: default:
        t = new NumericLiteral(v);
        break;
    }
    return new Constant(t, p)
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
    if (this.check(i.type, x.type) == void 0) this.error("Type error: Type mismatch in assign");
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
    if (i.tag != ExprTag.REF && i.tag != ExprTag.GS)
      this.error("Invalid left-hand side expression in prefix operation");
    this.tag = ExprTag.PREF
  }
  genRightSide() { this.emitassign(this.id, this.op); return this.id }
}

/** 
 * Postfix expression implement.
 * 
 * Statement i++ behaves the same as ++i:
 * 
 * Add 1 to i, then return the value of i.
 * @extends CompoundAssignExpr
 */
class Postfix extends CompoundAssignExpr {
  /**
   * @param {Token} i - Identifier to be assigned
   * @param {Token} op - Operator
   */
  constructor(i, op) {
    super(i, i, op);
    if (i.tag != ExprTag.REF && i.tag != ExprTag.GS)
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
  constructor(tok) { super(tok, Type.Selector); this.tag = ExprTag.SELECTOR }
  /**
   * @param {Boolean} a - Only GetScore & VaniCmd uses this param.
   * 
   * When in GetScore or VaniCmd, then reduce() returns the selector itself,
   * 
   * or it returns a entity counter.
   */
  reduce(a) {
    if (a == ExprTag.GS || a == ExprTag.VANICMD)
      return this
    else {
      var t = new Temp(Type.Int);
      this.emitassign(t, this);
      return t
    }
  }
  jumping(t, f) { this.emitjumps(this, t, f) }
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
    function check_(p) {
      for (var t of [Type.Selector, Type.Int, Type.Float, Type.Bool, Type.Vector])
        if (p == t) return true;
      return false
    }
    if (check_(p1) && check_(p2))
      return Type.Bool;
    return void 0
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
  jumping(t, f) {
    var x1 = this.expr1.reduce(this.tag), x2 = this.expr2.reduce(this.tag);
    //if (this.expr1.tag == ExprTag.CONST)
    //this.emitjumps(new Rel(Rel.move(this.op), x2, x1), t, f);
    //else 
    this.emitjumps(new Rel(this.op, x1, x2), t, f);
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
 * 
 * Produces direct access to vanilla command in MCBE.
 * 
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
 * 
 * Involve expressions in vanilla command.
 * 
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
  gen() { this.emitvanilla(this.reduceAll()) }
  jumping(t, f) { this.emitjumps(this.reduceAll(), t, f) }
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
  reduceAll() {
    var x, t;
    if (this.expr) x = this.expr.reduce(this.tag);
    t = this.next ? this.next.reduceAll() : void 0;
    return new VanillaCmdTag(x, this.op, t)
  }
  reduce() { return this.genRightSide() }
}

class Parser {
  constructor(str) {
    this.lexer = new Lexer(str);
    this.look = void 0; // Lexer unit
    this.used = 0; // Uid of variable
    this.top = new Env(void 0); // Current symbol table
    this.topEL = EntityLayer.Initial;
    this.done = !1;
    this.result = "";
    this.resultObj = void 0;
    this.modules = [];
    this.move();
  }

  appendTAC(a) { this.resultObj.push(a) }
  move() { this.look = this.lexer.scan(); }
  error(s) { throw new Error("Near line " + this.lexer.getLine() + ": " + s) }
  match(t) { if (this.look.tag == t) this.move(); else this.error("Syntax error: Unexpected " + this.look.tag) }
  test(t) { for (var e of t) if (e == this.look.tag) return true; return false }
  errorUnexp(t) { this.error("Syntax error: Unexpected token " + (t ? t : this.look.tag)) }

  /**
   * CBLDL Program
   */
  Program() {
    if (this.done) return;
    while (this.look.tag == TokenTag.BASIC)
      this.VariableStatement(true);

    while (this.look.tag != TokenTag.EOF) {
      var s = this.Module()
        , begin = s.newlabel()
        , after = s.newlabel();
      s.emitlabel(begin);
      s.gen(begin, after, EntityLayer.Initial);
      s.emitlabel(after);
      // Remove unused label and
      // Cut into base blocks
      var r = new TAC(this.resultObj.mode), c = 1, d = 0, e = 0, f = null;
      // c: label counter, d: baseblock counter, 
      // e: counter of inst except label in current bb
      // f: current bb's first label
      for (var a of this.resultObj) {
        var rd = (r[d] ? r[d] : (r[d] = new TACBaseBlock(d)));
        if (a.type == "delayh")
          r.totalDelay += a.delay;
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
      this.modules.push(r);
    }
  }

  /**
   * Single module
   * @returns {Stmt}
   */
  Module() {
    switch (this.look.tag) {
      case TokenTag.CHAIN:
        this.move();
        if (this.look.tag == TokenTag.PULSE) {
          // <ChainPulseModule> : chain pulse <Block>
          this.move();
          this.resultObj = new TAC(TAC.Mode.CP);
          return this.Block(TAC.Mode.CP);
        } else if (this.look.tag == TokenTag.REPEATING) {
          // <ChainRepeatingModule> : chain repeating <Block>
          this.move();
          this.resultObj = new TAC(TAC.Mode.CR);
          return this.Block(TAC.Mode.CR);
        } else if (this.look.tag == "{") {
          // <ChainPulseModule> : chain <Block>
          this.resultObj = new TAC(TAC.Mode.CP);
          return this.Block(TAC.Mode.CP);
        } else
          this.errorUnexp();

      case TokenTag.MODULE:
        // <CombinedModule> : module <BlockNoDelayHard>
        this.move();
        if (this.look.tag == "{") {
          this.resultObj = new TAC(TAC.Mode.M);
          return this.Block(TAC.Mode.M);
        } else
          this.errorUnexp();

      default:
        this.errorUnexp();
    }
  }

  /**
   * Variable or constant declaration statement
   * @param {Boolean} toplevel - Top level declarations, only constant or variable without init
   * @returns {Stmt}
   */
  VariableStatement(toplevel) {
    // <VariableStatement> : <VariableTypes> <VariableDeclarationList> ;
    var p = this.VariableTypes(), s;
    s = this.VariableDeclarationList(p, toplevel);
    this.match(";");
    return s
  }

  /**
   * Variable or constant declaration list
   * @param {Type} p - Identifier type
   * @param {Boolean} toplevel - True if top level declarations, only constant or variable without init
   * @returns {Stmt}
   */
  VariableDeclarationList(p, toplevel) {
    // <VariableDeclarationList> : <VariableDeclarationList> , <VariableDeclaration>
    // <VariableDeclarationList> : <VariableDeclaration>
    var tok = this.look, id, s, expr;
    this.match(TokenTag.ID);
    id = new Id(tok, void 0, this.used, p.isConst());
    this.top.put(tok, id);
    this.used++;

    // <VariableDeclaration> : <Identifier>
    if (this.test([",", ";"])) {
      if (p.isConst())
        this.error("Invalid constant declaration: Constant must have an initial value.");
      id.setType(Type.Int);
      s = toplevel ? Stmt.Null : new AssignExpr(id, Constant.from(0));
      return this.look == ';' ? s : (this.move(), new Seq(s, this.VariableDeclarationList(p, toplevel)));
    }

    // <VariableDeclaration> : <Identifier> <Initialiser>
    if (toplevel && this.test(["="]) && !p.isConst())
      this.error("Top level variable declarations only avaliable without initial value.");

    // <Initialiser> : = <AssignmentExpression>
    this.match("=");

    expr = this.AssignmentExpression();
    if (p.isConst())
      id.setValue(expr), s = Stmt.Null;
    else {
      if (expr.type == Type.Bool || expr.type == Type.Int)
        id.setType(expr.type), s = new AssignExpr(id, expr);
      else
        id.setType(Type.Int), s = new AssignExpr(id, expr);
    }

    if (this.test([",", ";"]))
      return this.look == ';' ? s : (this.move(), new Seq(s, this.VariableDeclarationList(p, toplevel)));

    this.errorUnexp();
  }

  /**
   * Declaration type
   * @returns {Type}
   */
  VariableTypes() {
    // <VariableTypes> : var
    // <VariableTypes> : const
    var p = this.look;
    this.match(TokenTag.BASIC);
    return p;
  }

  /**
   * Block statement
   * @param {Number} m - Block type
   * @returns {Stmt}
   */
  Block(m) {
    // <Block> : { <StatementList> }
    // <Block> : { }
    this.match("{");
    var savedEnv = this.top;
    this.top = new Env(this.top);
    var s = this.Stmts(m);
    this.match("}");
    this.top = savedEnv;
    return s
  }

  /**
   * Statement
   * @param {Number} m - Block type
   * @returns {Stmt}
   */
  Stmts(m) {
    var f = [this.CPStmt, this.CPStmt, this.MStmt];
    if (this.look.tag == '}') return Stmt.Null;
    else if (this.look.tag == TokenTag.EOF) return Stmt.Null;
    else return new Seq(f[m].call(this), this.Stmts(m))
  }

  /** 
   * Single statement
   * @returns {Stmt}
   */
  CPStmt() {
    var x, s1, s2, savedEL;
    switch (this.look.tag) {
      case ';':
        // <EmptyStatement> : ;
        this.move();
        return Stmt.Null;

      case TokenTag.IF:
        // <IfStatement> : if ( <Expression> ) <Statement>
        this.match(TokenTag.IF), this.match("("), x = this.AssignmentExpression(), this.match(")");
        s1 = this.CPStmt();
        if (this.look.tag != TokenTag.ELSE) return new If(x, s1);
        // <IfStatement> : if ( <Expression> ) <Statement> else <Statement>
        this.match(TokenTag.ELSE);
        s2 = this.CPStmt();
        return new Else(x, s1, s2);

      case TokenTag.EXECUTE:
        this.match(TokenTag.EXECUTE); this.match('(');
        savedEL = this.topEL;
        this.topEL = this.executeSubcommands();
        this.match(')');
        s1 = new ExecuteStmt(this.topEL, this.CPStmt());
        this.topEL = savedEL;
        return s1

      case "{":
        // <Block> : { [<StatementList>] }
        return this.Block(TAC.Mode.CP);

      case TokenTag.BASIC:
        // <VariableStatement> : <VariableTypes> <VariableDeclarationList> ;
        return this.VariableStatement();

      case TokenTag.VANICMD: case TokenTag.ID: case TokenTag.VANICMDHEAD: case TokenTag.NUM: case TokenTag.STRING: case TokenTag.SELECTOR: case "++": case "--": case '(':
        x = this.AssignmentExpression();
        // <ExecuteStatement> : <PrimaryExpression> => <Statement>
        if (this.look.tag == TokenTag.AE) {
          this.match(TokenTag.AE);
          savedEL = this.topEL;
          this.topEL = ExecuteStmt.createArrowExecuteEL(x, this.topEL);
          s1 = new ExecuteStmt(this.topEL, this.CPStmt());
          this.topEL = savedEL;
          return s1;
        } else
          // <ExpressionStatement> : <Expression> ;
          this.match(';');
        return x;

      case TokenTag.INITIAL:
        // <ExecuteStatement> : <PrimaryExpression> => <Statement>
        this.move(); this.match(TokenTag.AE);
        savedEL = this.topEL;
        this.topEL = EntityLayer.Initial;
        s1 = new ExecuteStmt(this.topEL, this.CPStmt());
        this.topEL = savedEL;
        return s1;

      case TokenTag.DELAYH:
        // <DelayHardStatement> : <PrimaryExpression>
        this.move();
        x = this.PrimaryExpression();
        this.match(";");
        return new DelayH(x);

      default:
        this.errorUnexp()
    }
  }

  /** StatementNoDelayH */
  MStmt() {
    var x, s1, s2, savedStmt;
    switch (this.look.tag) {
      case ';':
        this.move();
        return Stmt.Null;
      case TokenTag.IF:
        this.match(TokenTag.IF), this.match("("), x = this.AssignmentExpression(), this.match(")");
        s1 = this.MStmt();
        if (this.look.tag != TokenTag.ELSE) return new If(x, s1);
        this.match(TokenTag.ELSE);
        s2 = this.MStmt();
        return new Else(x, s1, s2);
      case TokenTag.WHILE:
        var whilenode = new While();
        savedStmt = Stmt.Enclosing, Stmt.Enclosing = whilenode;
        this.match(TokenTag.WHILE), this.match("("), x = this.AssignmentExpression(), this.match(")");
        s1 = this.MStmt();
        whilenode.init(x, s1);
        Stmt.Enclosing = savedStmt;
        return whilenode;
      case TokenTag.DO:
        var donode = new Do();
        savedStmt = Stmt.Enclosing, Stmt.Enclosing = donode;
        this.match(TokenTag.DO);
        s1 = this.MStmt();
        this.match(TokenTag.WHILE), this.match("("), x = this.AssignmentExpression(), this.match(")"), this.match(";");
        donode.init(s1, x);
        Stmt.Enclosing = savedStmt;
        return donode;
      case TokenTag.BREAK:
        this.match(TokenTag.BREAK), this.match(";");
        return new Break();
      case "{":
        return this.MBlock();
      case TokenTag.BASIC:
        return this.VariableStatement();
      case TokenTag.VANICMD: case TokenTag.VANICMDHEAD: case TokenTag.ID: case TokenTag.NUM: case TokenTag.STRING: case TokenTag.SELECTOR: case "++": case "--":
        x = this.AssignmentExpression();
        this.match(';');
        return x;
      default:
        this.errorUnexp()
    }
  }

  /**
   * Assignment expression
   * @returns {Expr}
   */
  AssignmentExpression() {
    // <AssignmentExpression> : 
    //   <LogicalORExpression>
    //   <LeftHandSideExpression> <AssignmentOperator> <AssignmentExpression>
    var x = this.LogicalORExpression(), tok = this.look;
    switch (tok.tag) {
      case "=":
        if (x.tag != ExprTag.REF && x.tag != ExprTag.GS)
          this.error("Syntax error: Invalid left-hand side in assignment")
        this.match("=");
        return new AssignExpr(x, this.AssignmentExpression());
      case "*=": case "/=": case "%=":
        if (x.tag != ExprTag.REF && x.tag != ExprTag.GS)
          this.error("Syntax error: Invalid left-hand side in assignment")
      case "+=": case "-=":
        if (x.tag != ExprTag.ID && x.tag != ExprTag.GS && x.tag != ExprTag.SELECTOR)
          this.error("Syntax error: Invalid left-hand side in assignment")
        this.move();
        return new CompoundAssignExpr(x, this.AssignmentExpression(), tok);
      default:
        return x;
    }
  }

  /**
   * Logical or expression
   * @returns {Expr}
   */
  LogicalORExpression() {
    var x = this.LogicalANDExpression(), tok;
    while (this.test([TokenTag.OR]))
      tok = this.look, this.move(), x = new Or(tok, x, this.LogicalANDExpression());
    return x
  }

  /**
   * Logical and expression
   * @returns {Expr}
   */
  LogicalANDExpression() {
    var x = this.EqualityExpression(), tok;
    while (this.test([TokenTag.AND]))
      tok = this.look, this.move(), x = new And(tok, x, this.EqualityExpression());
    return x
  }

  /**
   * Equality expression
   * @returns {Expr}
   */
  EqualityExpression() {
    var x = this.RelationalExpression(), tok;
    while (this.test([TokenTag.EQ, TokenTag.NE]))
      tok = this.look, this.move(), x = new Rel(tok, x, this.RelationalExpression());
    return x
  }

  /**
   * Relational expression
   * @returns {Expr}
   */
  RelationalExpression() {
    var x = this.AdditiveExpression(), tok;
    if (this.test(['<', TokenTag.LE, TokenTag.GE, '>']))
      tok = this.look, this.move(), x = new Rel(tok, x, this.AdditiveExpression());
    return x
  }

  /**
   * Additive expression
   * @returns {Expr}
   */
  AdditiveExpression() {
    // <AdditiveExpression> :
    //   <MultiplicativeExpression>
    //   <AdditiveExpression> + <MultiplicativeExpression>
    //   <AdditiveExpression> - <MultiplicativeExpression>
    var x = this.MultiplicativeExpression(), tok;
    while (this.test(["+", "-"]))
      tok = this.look, this.move(), x = new Arith(tok, x, this.MultiplicativeExpression());
    return x
  }

  /**
   * Multiplicative expression
   * @returns {Expr}
   */
  MultiplicativeExpression() {
    // <MultiplicativeExpression> :
    //   <UnaryExpression>
    //   <MultiplicativeExpression> * <UnaryExpression>
    //   <MultiplicativeExpression> / <UnaryExpression>
    //   <MultiplicativeExpression> % <UnaryExpression></UnaryExpression>
    var x = this.UnaryExpression(), tok;
    while (this.test(["*", "/", "%"]))
      tok = this.look, this.move(), x = new Arith(tok, x, this.UnaryExpression());
    return x
  }

  /**
   * Unary expression
   * @returns {Expr}
   */
  UnaryExpression() {
    var tok = this.look;
    if (this.test(["-"])) {
      // <UnaryExpression> : - <UnaryExpression>
      this.move(); return new Unary(Word.minus, this.UnaryExpression())
    } else if (this.test(["+"])) {
      // <UnaryExpression> : + <UnaryExpression>
      this.move(); return this.UnaryExpression()
    } else if (this.test(["!"])) {
      // <UnaryExpression> : ! <UnaryExpression>
      this.move(); return new Not(tok, this.UnaryExpression())
    } else if (this.test(["++", "--"])) {
      // <UnaryExpression> : 
      //   ++ <UnaryExpression>
      //   -- <UnaryExpression>
      this.move();
      if (this.test([TokenTag.ID]))
        return new Prefix(this.UnaryExpression(), tok);
      else
        this.error("Invalid left-hand side expression in prefix operation");
    } else
      // <UnaryExpression> : - <PostfixExpression>
      return this.PostfixExpression();
  }

  /**
   * Postfix expression
   * @returns {Expr}
   */
  PostfixExpression() {
    var x = this.GetScoreExpression(), tok;
    if (this.test(["++", "--"])) {
      // <PostfixExpression> : 
      //   <LeftHandSideExpression> ++
      //   <LeftHandSideExpression> --
      tok = this.look; this.move();
      if (x.op.tag == TokenTag.ID || x.op.tag == TokenTag.GS)
        return new Postfix(x, tok);
      else
        this.error("Invalid left-hand side expression in postfix operation");
    } else
      // <PostfixExpression> : <LeftHandSideExpression>
      return x;
  }

  /**
   * Get score expression
   * @returns {Expr}
   */
  GetScoreExpression() {
    var x = this.PrimaryExpression(), t;
    if (this.test([TokenTag.GS])) {
      // <GetScoreExpression> : <PrimaryExpression> -> <PrimaryExpression>
      this.move();
      return new GetScore(Word.gs, x, this.PrimaryExpression())
    } else if (this.test(["."])) {
      // <GetScoreExpression> : <PrimaryExpression> . <Identifier>
      this.move();
      if (this.test([TokenTag.ID])) {
        t = this.look.toString();
        this.move();
        return new GetScore(Word.gs, x, Constant.from(t, Type.String))
      } else this.errorUnexp(i)
    } else
      // <GetScoreExpression> : <PrimaryExpression>
      return x
  }

  /**
   * Primary expression
   * @param {Boolean} c - Read id as literal if true
   * @returns {Expr}
   */
  PrimaryExpression(c) {
    var x = void 0;
    switch (this.look.tag) {
      // <PrimaryExpression> : ( <Expression> )
      case '(':
        this.move(), x = this.AssignmentExpression(), this.match(')');
        return x;

      // <PrimaryExpression> : <Literal>
      case TokenTag.NUM:
        x = new Constant(this.look, Type.Int);
        this.move();
        return x;
      case TokenTag.TRUE:
        x = Constant.True;
        this.move();
        return x;
      case TokenTag.FALSE:
        x = Constant.False;
        this.move();
        return x;
      case TokenTag.VANICMD:
        x = this.look;
        this.move();
        return new VanillaCmdNoTag(x);
      case TokenTag.VANICMDHEAD:
        x = this.look;
        this.move();
        return new VanillaCmdTag(void 0, x, this.VanillaCommandWithTag());
      case TokenTag.STRING:
        x = this.look;
        this.move();
        return new Constant(x, Type.String);
      case TokenTag.SELECTOR:
        x = this.look;
        this.move();
        return new Selector(x);

      // <PrimaryExpression> : <Identifier>
      case TokenTag.ID:
        x = this.look.toString();
        if (c) { this.move(); return this.look; }
        var id = this.top.get(this.look);
        if (id == void 0) this.error(x + " is undeclared");
        this.move();
        return id;

      default:
        this.errorUnexp();
    }
  }

  VanillaCommandWithTag() {
    var x = this.AssignmentExpression(), t = this.look;
    this.move();
    if (t.tag == TokenTag.VANICMDBODY)
      return new VanillaCmdTag(x, t, this.VanillaCommandWithTag());
    if (t.tag == TokenTag.VANICMDTAIL)
      return new VanillaCmdTag(x, t, void 0);
    this.errorUnexp();
  }

  executeSubcommands() {
    var t1 = this.look, t2 = this.topEL;
    while (this.look.tag !== ")") {
      this.match(TokenTag.ID);
      switch (t1.type) {
        case EntityLayer.Type.AS:
        case EntityLayer.Type.AT:
        case EntityLayer.Type.ANCHORED:
        case EntityLayer.Type.ALIGN:
        case EntityLayer.Type.IN:
          t2 = this.executeSimplePayload(t2, t1.type);
          break;
        default:
          this.errorUnexp();
      }
      this.move();
    }
    return t2
  }

  /** 
   * Parses subcommand with single param: 
   * 
   * Subcomands: as at anchored align in
   */
  executeSimplePayload(prev, type) {
    return new EntityLayer(prev, type, this.look)
  }

  executeFacing() {

  }

  executeCondition() { }
}

class CommandGenerator {
  constructor(str) {
    Token.uid = 0;
    ASTNode.labels = 0;
    Temp.count = 0;
    this.parser = new Parser(str);
    ASTNode.lexer = this.parser.lexer;
    ASTNode.parser = this.parser;
    this.parser.Program();
    this.modules = this.parser.modules;
  }

  generate() {
    for (var m of this.modules) {
      m.gen();
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
  ASTNode.lexer = parse.lexer;
  ASTNode.parser = parse;
  parse.Program();
  console.log(parse.top)
  console.log(temp1 = parse.modules);
}