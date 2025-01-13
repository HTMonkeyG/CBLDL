var CMD = {
  /** Vanilla commands, directly put into command block. */
  VANNILLA: 0,
  /**
   * Commands for start and stop statements,
   * enable or disable a module.
   */
  ENABLE: 1,
  /**
   * Used for chain-breaking,
   * i.e. remove a command block in the chain
   * to stop following command blocks.
   */
  BREAK: 2
}, CB = {
  /** Pulse command block. */
  PULSE: 0,
  /** Repeating command block. */
  REPEAT: 1,
  /** Chain command block. */
  CHAIN: 2,
  /**
   * Used for chain-breaking.
   */
  BREAK: 3
}, FACING = {
  Y_INC: 0,
  Y_DEC: 1,
  X_INC: 2,
  X_DEC: 3,
  Z_INC: 4,
  Z_DEC: 5,
};

var consts = {
  /** Version of the software. */
  VERSION: 10000,
  /** Command line. */
  PROGNAME: "cll",
  CMD: Object.freeze(CMD),
  CB: Object.freeze(CB),
  FACING: Object.freeze(FACING)
};

module.exports = Object.freeze(consts);