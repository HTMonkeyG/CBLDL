/**
 * HLCL Compiler
 * For CBLDL Specification v1.2
 * MCBE v1.20
 * By HTMonkeyG
 * Bilibili & GitHub: HTMonkeyG
 * 
 * Reference: 
 *   Alfred V. Aho, Ravi Sethi, Jeffrey D. Ullman.
 *   Compilers: Principles, Techniques, and Tools. 2nd ed.
 */

import { Token } from "./frontEnd/Token.js";
import { ASTNode, Temp } from "./frontEnd/SyntaxTree.js";
import { Parser } from "./frontEnd/Parser.js";
import { options } from "./utils/Option.js";
import MCStructure from "mcstructure-js";
import { createBlockEntity, createUniversalTag } from "project-mirror-registry";
import { CB } from "./backEnd/CommandBlock.js";
import * as fs from "node:fs";

var temp1 = {};

options.defaultScb = "aaa";

function main() {
  var str = fs.readFileSync("./compile/test.hlcl", "utf-8");
  Token.uid = 0;
  ASTNode.labels = 0;
  Temp.count = 0;
  var parse = new Parser(str);
  ASTNode.lexer = parse.lexer;
  ASTNode.parser = parse;
  try {
    parse.Program();
    temp1 = parse.modules;

    temp1[0].gen();
    temp1[1].gen();
  } catch (e) {
    throw e.getMessage();
  }

  var output = new MCStructure(1, temp1[0].chain.length, 1);
  for (var i = 0; i < temp1[0].chain.length; i++) {
    var d = createBlockEntity("command_block");
    d["str>Command"] = temp1[0].chain[i].cmd;
    d["i32>TickDelay"] = temp1[0].chain[i].delay;
    d["i8>auto"] = !temp1[0].chain[i].rsctl;
    d["i8>conditionMet"] = !temp1[0].chain[i].condition;
    d["i8>LPCondionalMode"] = temp1[0].chain[i].condition;
    d["i8>LPRedstoneMode"] = temp1[0].chain[i].rsctl;
    d["i32>LPCommandMode"] = temp1[0].chain[i].type;
    d["i8>conditionalMode"] = temp1[0].chain[i].condition;
    output.setBlock({ x: 0, y: i, z: 0 }, {
      "str>name": temp1[0].chain[i].type == CB.Type.PULSE ? "command_block"
        : temp1[0].chain[i].type == CB.Type.REPEAT ? "repeating_command_block"
          : "chain_command_block",
      "i16>val": 1,
      "i32>version": 1,
      "comp>states": {
        "i8>facing_direction": 1
      }
    });
    output.setBlockData({ x: 0, y: i, z: 0 }, d);
  }

  fs.writeFileSync("./test.mcstructure", Buffer.from(output.serialze()));
}

main();