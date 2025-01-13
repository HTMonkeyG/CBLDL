const { PreprocessLexer, PreprocessToken } = require("../lexer.js");
var i = "chain pulse {\n"
  + "#ifdef A\n"
  + "`say ${A} defined`\n"
  + "\"aaa\"\n"
  + "#endif\n"
  + "}";
var a = new PreprocessLexer(i)

for (; !a.done();)
  console.log(a.scan())/*
class Include {
  constructor() {
    this.file = "";
    this.content = "";
    this.parentLine = 0;
    this.includes = [];
  }

  gen() {
    //var r = parentContent.split("\n");
    var r = this.content.split("\n");
    for (var i = this.includes.length - 1; i >= 0; i--) {
      r[this.includes[i].parentLine] = this.includes[i].gen();
    }
    return r.join("\n")
  }
}

var a = new Include();
a.content = "aaa\n#include \nbbb";
a.parentLine = 0;
var b = new Include();
b.content = "included \n#include \n777999";
b.parentLine = 1;
a.includes[0] = b;
var c = new Include();
c.content = "included ccc"
c.parentLine = 1;
b.includes[0] = c;
console.log(a.gen())*/