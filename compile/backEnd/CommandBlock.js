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

export { CB, CBSubChain };