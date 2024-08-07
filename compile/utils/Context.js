import { Lexer } from "../frontEnd/Lexer.js";
import { Parser } from "../frontEnd/Parser.js";

class StringRange {
  constructor(begin, end) {
    this.begin = begin;
    this.end = end;
  }

  cut(s) {
    return (s + '').substring(this.begin, this.end)
  }
}

class CompileContext {
  /**
   * Context for tokens
   * @param {String} input - Input string
   * @param {StringRange} range - Range of token
   * @param {Lexer} lexer
   * @param {Parser} parser 
   */
  constructor(input, range, lexer, parser) {
    this.input = input;
    this.line = lexer.getLine();
    this.lineOffset = lexer.getLineOffset();
    this.ptr = lexer.getPtr();
    this.range = range;
    this.lexer = lexer;
    this.parser = parser;
  }
}

export { StringRange, CompileContext };