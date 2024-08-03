import { CB, CBSubChain } from "./CommandBlock.js";
import { Type } from "../frontEnd/Token.js";
import { TokenTag, ExprTag } from "../utils/Enums.js";
import { RegisterPool, Register } from "./Register.js";
import { Temp } from "../frontEnd/SyntaxTree.js";
import { options } from "../utils/Option.js";

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

//module.exports = 
export {
  TAC,
  TACAssign,
  TACBaseBlock,
  TACDelayH,
  TACGoto,
  TACInst,
  TACLabel,
  TACVanilla
};