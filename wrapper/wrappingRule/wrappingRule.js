const PMR = require("project-mirror-registry")
  , consts = require("../constants.js")
  , FACING = consts.FACING;

function createNewPointer() {
  return {
    pos: {
      x: 0,
      y: 0,
      z: 0
    },
    facing: FACING.Y_INC
  }
}

function processPos(src, dst) {
  if (typeof dst == "number")
    return dst;
  else if (typeof dst == "string") {
    dst = dst.trim();
    var n = Number(dst);
    if (!Number.isNaN(n))
      return n;
    // Relative
    if (/(^~)/.test(dst)) {
      dst = dst.slice(1);
      var n = Number(dst);
      if (!Number.isNaN(n))
        return src + n;
      else
        throw new Error("invalid relative coordinate format")
    }
  }
  throw new Error("invalid coordinate format")
}

function process3DPos(pointerData, pos) {
  if (!pos)
    return [
      pointerData.pos.x,
      pointerData.pos.y,
      pointerData.pos.z
    ];
  return [
    processPos(pointerData.pos.x, pos[0]),
    processPos(pointerData.pos.y, pos[1]),
    processPos(pointerData.pos.z, pos[2])
  ]
}

function doFill(blockGroup, pointerData, command) {
  var m = process3DPos(pointerData)
    , n = process3DPos(pointerData);
  if (command.from)
    m = process3DPos(pointerData, command.from);
  if (command.to)
    n = process3DPos(pointerData, command.to);

  for (var i = 0; i < 3; i++) {
    var a = Math.min(m[i], n[i])
      , b = Math.max(m[i], n[i]);

    m[i] = a;
    n[i] = b
  }

  var block = PMR.createUniversalTag("block", command.block || "minecraft:air");

  for (var xC = m[0]; xC <= n[0]; xC++)
    for (var yC = m[1]; yC <= n[1]; yC++)
      for (var zC = m[1]; zC <= n[1]; zC++)
        blockGroup.setBlock(xC, yC, zC, { block: block })
}

function doMove(blockGroup, pointerData, command) {
  if (command.to) {
    pointerData.pos.x = processPos(pointerData.pos.x, command.to[0]);
    pointerData.pos.y = processPos(pointerData.pos.y, command.to[1]);
    pointerData.pos.z = processPos(pointerData.pos.z, command.to[2])
  }
}

var commands = {
  "fill": doFill,
  "move": doMove
}, controls = {
  //"loop": doLoop
};

function* executeRuleCommands(blockGroup, pointerData, commandList) {
  for (var command of commandList) {
    if (commands[command.do]) {
      
    }
  }
}
