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
import * as fs from "node:fs";

var temp1 = {};

options.defaultScb = "aaa";

function main() {
  var str = fs.readFileSync("./compile_modulized/test.hlcl", "utf-8");
  Token.uid = 0;
  ASTNode.labels = 0;
  Temp.count = 0;
  var parse = new Parser(str);
  ASTNode.lexer = parse.lexer;
  ASTNode.parser = parse;
  parse.Program();
  //console.log(parse.top)
  //console.log(temp1 = parse.modules);
  temp1 = parse.modules;

  temp1[1].gen();

  console.log(temp1[1].chain[0].cmd);
}

main();