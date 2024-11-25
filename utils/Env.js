/**
 * Symbol table implement
 */
class SymbolTable {
  constructor(n) {
    this.table = new Map();
    this.prev = n;
  }

  put(w, i) { this.table.set(w, i) }

  get(w) {
    for (var i = this, found; !!i; i = i.prev)
      if ((found = i.table.get(w)), found != void 0) return found;
    return void 0
  }
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

  static Initial = new EntityLayer(null, null, null);

  /**
   * @param {EntityLayer|undefined} prev - Previous entity layer
   * @param {String} type - Current layer's type
   * @param {*} param - Current layer's param
   */
  constructor(prev, type, param) {
    this.prev = prev;
    this.type = type;
    this.param = param
  }

  withRoot(l) {
    for (var c = this; c.prev; c = c.prev)
      if (l == c)
        throw new Error("Try to generate loop in entity layer")
    return c.prev = l;
  }

  toString() {
    var t = ["as", "at", "align", "anchored", "facing", "facing entity", "in", "rotated", "positioned", "positioned as", "if", "unless"];
    if (!this.prev)
      return "";
    return this.prev.toString() + " " + t[this.type] + " " + this.param;
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

export {
  SymbolTable,
  EntityLayer,
  PayloadLayer,
  ConditionLayer
};