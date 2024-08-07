import { TokenTag } from "../utils/Enums.js";
import { EntityLayer } from "../utils/Env.js";

/** A syntax token */
class Token {
  /** 
   * @param {*} t - Tag of the token
   */
  constructor(t) { this.tag = t; this.uid = Token.uid++; this.context = null }
  toString() { return this.tag }
  static uid = 0;
  static EOF = new Token(TokenTag.EOF)
}

/** A numeric token */
class NumericLiteral extends Token {
  /**
   * @param {Number} v - Numeric value
   * @param {String} o - Original string
   */
  constructor(v, o) {
    super(TokenTag.NUM);
    if (Number.isNaN(v) || !Number.isFinite(v))
      throw new Error("Invalid number: " + o);
    if (v > 2147483647)
      throw new Error("Number too high: " + o);
    if (v < -2147483648)
      throw new Error("Number too low: " + o);
    this.value = v
  }

  getValue() { return this.value }

  toString() { return this.value.toString() }

  isInteger() { return Number.isInteger(this.value) }
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

export {
  Token,
  NumericLiteral,
  SelectorLiteral,
  StringLiteral,
  VaniCmdLiteral,
  Word,
  Type,
  ExecuteSubcommand
};