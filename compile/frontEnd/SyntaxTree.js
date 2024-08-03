import {
  TAC,
  TACAssign,
  TACBaseBlock,
  TACDelayH,
  TACGoto,
  TACInst,
  TACLabel,
  TACVanilla
} from "../backEnd/TAC.js";
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
import { ExprTag, TokenTag } from "../utils/Enums.js";
import { EntityLayer, SymbolTable } from "../utils/Env.js";

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

export {
  ASTNode,
  Stmt,
  If,
  Else,
  While,
  Do,
  Seq,
  Break,
  DelayH,
  Delete,
  ExecuteStmt,
  Expr,
  Reference,
  Id,
  Temp,
  Op,
  Arith,
  GetScore,
  Unary,
  Constant,
  AssignExpr,
  CompoundAssignExpr,
  Prefix,
  Postfix,
  Selector,
  Logical,
  Or,
  And,
  Not,
  Rel,
  VanillaCmdNoTag,
  VanillaCmdTag
};