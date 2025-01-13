const MCS = require("mcstructure-js");

function hash(x, y, z) {
  return x + "/" + y + "/" + z
}

function unpack(h) {
  h = h.split("/");
  return [
    Number(h[0]),
    Number(h[1]),
    Number(h[2])
  ]
}

/**
 * Block position storage.
 */
class BlockGroup {
  constructor() {
    this.data = {};
    this.min = [2147483647, 2147483647, 2147483647];
    this.max = [-2147483648, -2147483648, -2147483648];
    this.empty = true;
  }

  hasBlock(x, y, z) {
    return !this.data[hash(x, y, z)]
      || this.data[hash(x, y, z)].block["str>name"] == "air"
      || this.data[hash(x, y, z)].block["str>name"] == "minecraft:air"
  }

  setBlock(x, y, z, nbt) {
    this.empty = false;
    this.data[hash(x, y, z)] = nbt;
    this.max[0] = Math.max(this.max[0], x);
    this.max[1] = Math.max(this.max[1], y);
    this.max[2] = Math.max(this.max[2], z);
    this.min[0] = Math.min(this.min[0], x);
    this.min[1] = Math.min(this.min[1], y);
    this.min[2] = Math.min(this.min[2], z);
  }

  clearBlock(x, y, z) {
    delete this.data[hash(x, y, z)];

    if (!(x == this.min[0]
      || y == this.min[1]
      || z == this.min[2]
      || x == this.max[0]
      || y == this.max[1]
      || z == this.max[2]))
      return;

    this.min = [2147483647, 2147483647, 2147483647];
    this.max = [-2147483648, -2147483648, -2147483648];

    for (var p in this.data) {
      p = unpack(p);
      this.max[0] = Math.max(this.max[0], p[0]);
      this.max[1] = Math.max(this.max[1], p[1]);
      this.max[2] = Math.max(this.max[2], p[2]);
      this.min[0] = Math.min(this.min[0], p[0]);
      this.min[1] = Math.min(this.min[1], p[1]);
      this.min[2] = Math.min(this.min[2], p[2]);
    }
  }

  size() {
    if (this.empty)
      return [0, 0, 0];
    return [
      this.max[0] - this.min[0],
      this.max[1] - this.min[1],
      this.max[2] - this.min[2]
    ]
  }

  toStructure() {
    if (this.empty)
      return null;
    var size = this.size()
      , result;

    if (size[0] > 64 || size[2] > 64 || size[1] > 384)
      throw new Error("blockGroup too large");
    result = new MCS(size[0], size[1], size[2]);

    for (var a in this.data) {
      var b = this.data[a], p = unpack(a);
      p[0] -= this.min[0];
      p[1] -= this.min[1];
      p[2] -= this.min[2];
      result.setBlock({ x: p[0], y: p[1], z: p[2] }, b.block);
      b.blockEntity && result.setBlockData({ x: p[0], y: p[1], z: p[2] }, b.blockEntity);
    }

    return result
  }
}

module.exports = BlockGroup;