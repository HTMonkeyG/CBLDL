const PMR = require("project-mirror-registry")
  , consts = require("../constants.js")
  , BlockGroup = require("../blockGroup.js");

class Pos3D {
  static fromString(input) {
    var result = new Pos3D()
      , s = input + ""
      , k;

    for (var a of ["x", "y", "z"]) {
      s = s.trim();
      k = /^(~?((\+|-)?((\d*\.\d+)|(\d+\.?)))|~)/.exec(s);
      if (!k)
        throw new Error("invalid coordinate format");
      if (k[0][0] == "~")
        result["d" + a] = Number(k[0].substring(1));
      else
        result[a] = Number(k[0]);
      s = s.substring(k[0].length);
    }

    if (s.trim().length)
      throw new Error("invalid coordinate format");

    return result
  }

  static from(pos3d) {
    var result = new Pos3D();
    for (var a of ["x", "y", "z"])
      if (pos3d["d" + a])
        result[a] = pos3d["d" + a];
      else
        result[a] = pos3d[a];
    return result
  }

  constructor() {
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.dx = 0;
    this.dy = 0;
    this.dz = 0;
  }

  evaluate(pos3d) {
    var result = new Pos3D();

    for (var a of ["x", "y", "z"])
      if (this["d" + a])
        result[a] = pos3d[a] + this["d" + a];
      else
        result[a] = this[a];

    return result
  }

  evaluateOn(pos3d) {
    for (var a of ["x", "y", "z"]) {
      this["d" + a] = 0;
      if (pos3d["d" + a])
        this[a] += pos3d["d" + a];
      else
        this[a] = pos3d[a];
    }
  }

  toString() {
    var result = "";
    for (var a of ["x", "y", "z"])
      if (this["d" + a])
        result += "~" + this["d" + a] + " ";
      else
        result += this[a] + " ";
    return result.trim();
  }
}

class WrappingContext {
  constructor() {
    this.blockGroup = new BlockGroup();
    this.pos = new Pos3D();
    this.facing = consts.FACING.Y_INC;
  }
}

class WrappingRule {
  static deserialize(input) {
    var result = new WrappingRule();

    result.name = input.name;
    result.version = input.version;

    for (var a of ["preprocess", "module", "chain", "block"])
      if (input[a]) {
        result[a] = [];
        for (var command of input[a])
          result[a].push(WrappingRuleCommand.deserialize(command))
      }

    return result
  }

  constructor() {
    this.name = "";
    this.version = consts.VERSION;
    this.preprocess = [];
    this.module = [];
    this.chain = [];
    this.block = [];
  }

  *run() {

  }
}

class WrappingRuleCommand {
  /**
   * Deserialize command from JSON.
   * @param {Object} input
   */
  static deserialize(input) {
    var commands = {
      "move": MoveCommand,
      "fill": FillCommand,
      "put": PutCommand
    }
    if (!commands[input.do])
      throw new Error("invalid command: " + input.do);
    return commands[input.do].deserialize(input);
  }

  constructor(name) {
    this.name = name;
  }

  /**
   * Execute the command.
   * @param {WrappingContext} context
   */
  execute(context) { }
}

/** Move the pointer. */
class MoveCommand extends WrappingRuleCommand {
  static deserialize(input) {
    var result = new MoveCommand();
    result.to = Pos3D.fromString(input.to);
    return result
  }

  constructor() {
    super("move");
    this.to = new Pos3D();
  }

  /**
   * Execute the command.
   * @param {WrappingContext} context
   */
  execute(context) {
    context.pos.evaluateOn(this.to);
  }
}

/** Fill a specified area with given block. */
class FillCommand extends WrappingRuleCommand {
  static deserialize(input) {
    var result = new FillCommand();
    result.from = Pos3D.fromString(input.from);
    result.to = Pos3D.fromString(input.to);
    result.block = PMR.createUniversalTag("block", input.block + "");
    return result
  }

  constructor() {
    super("fill");
    this.from = new Pos3D();
    this.to = new Pos3D();
    this.block = PMR.createUniversalTag("block", "minecraft:air");
  }

  /**
   * Execute the command.
   * @param {WrappingContext} context
   */
  execute(context) {
    var m = this.from.evaluate(context.pos)
      , n = this.to.evaluate(context.pos)
      , o, p;

    for (var a of ["x", "y", "z"]) {
      o = m[a];
      p = n[a];
      m[a] = Math.min(o, p);
      n[a] = Math.max(o, p);
    }

    if ((n.x - m.x) * (n.y - m.y) * (n.z - m.z) > 65535)
      throw new Error("too much blocks in specified area");

    for (var xC = m.x; xC <= n.x; xC++)
      for (var yC = m.y; yC <= n.y; yC++)
        for (var zC = m.z; zC <= n.z; zC++)
          context.blockGroup.setBlock(xC, yC, zC, { block: this.block })
  }
}

/** Try to enter the next stage. */
class PutCommand extends WrappingRuleCommand {
  static deserialize(input) {
    return new PutCommand()
  }

  constructor() {
    super("put");
  }

  execute(context) { }
}

class WrappingRuleControlCommand extends WrappingRuleCommand {
  static deserialize() {

  }

  constructor(name) {
    super(name);
    this.condition = new WrappingRuleCondition();
    this.list = [];
  }
}

/** Wrapping rule condition implement. */
class WrappingRuleCondition {
  static deserialize(input) {
    var result = new WrappingRuleCondition();

    if (input.all_of) {
      result.type = "all_of";
      result.conditions = [];
      for (var c of input.all_of)
        result.conditions.push(WrappingRuleCondition.deserialize(c))
    } else if (input.one_of) {
      result.type = "one_of";
      result.conditions = [];
      for (var c of input.one_of)
        result.conditions.push(WrappingRuleCondition.deserialize(c))
    } else if (input.not) {
      result.type = "not";
      result.conditions = [WrappingRuleCondition.deserialize(input.not)];
    } else {
      result.type = "single";
      result.target = input.target;
      result.operator = input.operator;
      result.value = input.value;
    }

    return result
  }

  constructor() {
    this.type = "single";
    this.target = "";
    this.value = "";
    this.operator = "";
    this.conditions = [];
  }

  /**
   * Evaluate the condition.
   * @param {WrappingContext} context
   * @returns {Boolean}
   */
  execute(context) {
    var query = {
      "query.x": context.pos.x,
      "query.y": context.pos.x,
      "query.z": context.pos.x
    }, operator = {
      "==": (a, b) => a == b,
      "!=": (a, b) => a != b,
      "<=": (a, b) => a <= b,
      ">=": (a, b) => a >= b,
      "<": (a, b) => a < b,
      ">": (a, b) => a > b,
    };

    if (this.type == "single") {
      if (!query[this.target])
        throw new Error("invalid condition target");
      if (!operator[this.operator])
        throw new Error("invalid condition operator");

      return operator[this.operator](query[this.target], this.value)
    } else if (this.type == "all_of") {
      for (var c of this.conditions)
        if (!c.execute(context))
          return false;
      return true
    } else if (this.type == "one_of") {
      for (var c of this.conditions)
        if (c.execute(context))
          return true;
      return false
    } else if (this.type == "not")
      return !this.conditions[0].execute(context)
  }
}

class LoopCommand extends WrappingRuleCommand {
  static deserialize(input) {
    var result = new LoopCommand();

    result.condition = WrappingRuleCondition.deserialize(input.condition);
    for (var c of input.list)
      result.list.push(WrappingRuleCommand.deserialize(c));

    return result
  }

  constructor() {
    super("loop");
    this.condition = new WrappingRuleCondition();
    this.list = [];
  }
}

module.exports = {
  WrappingContext,
  WrappingRule,
  WrappingRuleCommand,
  WrappingRuleCondition,
  WrappingRuleControlCommand,
  MoveCommand,
  FillCommand,
  PutCommand,
  LoopCommand
};