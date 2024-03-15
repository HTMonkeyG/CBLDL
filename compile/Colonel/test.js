function ParamBulider(parent) {
  return {
    parent: parent ? parent : null,
    nodes: {},
    next: function(param){
      Object.assign(this.parent.nodes, param.parent.nodes);
      return this
    },
    literal: function(name){
      this.nodes["literal>" + name] = ParamBulider(this);
      return this.nodes["literal>" + name]
    },
    param: function(name, type){
      this.nodes[type + ">" + name] = ParamBulider(this);
      return this.nodes[type + ">" + name]
    }
  }
}

ParamBulider.literal = function(name){
  var res = ParamBulider(null);
  res.nodes["literal>" + name] = ParamBulider(res);
  return res.nodes["literal>" + name]
};

ParamBulider.param = function(name, type){
  var res = ParamBulider(null);
  res.nodes[type + ">" + name] = ParamBulider(res);
  return res.nodes[type + ">" + name]
};

a = ParamBulider()
a.literal('tp').literal("target").next(ParamBulider.literal("pos")).literal("pos")
/**
 * - a - b
 * |   - d
 * - c
 */
console.log(a)