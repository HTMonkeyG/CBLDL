import { options } from "../utils/Option.js";

/**
 * Virtual entity
 */
class Register {
  constructor() {
    var s = () => Math.floor(Math.random() * 16).toString(16), n = '';
    for (var i = 0; i < 8; i++) n += s();
    this.name = "R_" + n;
  }

  toString() {
    return this.name + " " + options.defaultScb;
  }
}

class RegisterPool {
  static registers = [];
  static createRegister() {
    var r = new Register(), p;
    for (var e of RegisterPool.registers)
      if (e.name == r.name)
        return RegisterPool.createRegister();
    RegisterPool.registers.push(r);
    return r
  }
  static Global = new RegisterPool();

  constructor() {
    this.registers = new Map();
  }

  /**
   * Try to assign register for given variable
   * @param {Reference} v - Variable
   */
  getRegFor(v) {
    if (v.reg) return false;
    for (var e of this.registers) {
      if (!e[1]) {
        v.reg = e[0];
        this.registers.set(e, v);
        return true;
      }
    }
    this.registers.set(v.reg = RegisterPool.createRegister(), v);
    return true;
  }

  /**
   * Release register for given variable
   * @param {Reference} v - Variable
   */
  releaseRegFor(v) {
    if (!v.reg) return false;
    var s = this.registers.size;
    this.registers.set(v.reg, null);
    if (s != this.registers.size)
      throw new Error("Failed to release register.");
    v.reg = null;
  }
}

//module.exports = 
export {
  Register,
  RegisterPool
};