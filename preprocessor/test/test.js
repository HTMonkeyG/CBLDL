const FileSlice = require("../slice.js");

var a = FileSlice.fromFile("a", "a\nb\nc", 0, 3, null)
  , b = FileSlice.fromFile("b", "e\nf\ng", 0, 3, null)
  , c = FileSlice.fromFile("c", "h\ni\nj", 2, 3, b);

a.insert(1, c);

console.log(a + "")