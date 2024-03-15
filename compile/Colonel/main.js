function Colonel() {
  function StringReader(a) {
    var str = a, ptr = 0;

    function skip() {
      ptr++
    }

    function peek() {
      return str[a]
    }

    function read() {
      return str[ptr++]
    }

    function isWhitespace(a) {
      return a === " " || a === "\t"
    }

    function canRead(len) {
      return len ? ptr < str.length + len : ptr < str.length
    }

    function skipWhitespace() {
      while (canRead() && isWhitespace(peek())) {
        skip();
      }
    }

    function isAllowedInUnquotedString(c) {
      return c >= '0' && c <= '9'
        || c >= 'A' && c <= 'Z'
        || c >= 'a' && c <= 'z'
        || c == '_' || c == '-'
        || c == '.' || c == '+';
    }

    function isAllowedNumber(c) {
      return c >= '0' && c <= '9' || c === '.' || c === '-';
    }

    function isQuotedStringStart(c) {
      return c === "\""
    }

    function readUnquotedString() {
      var start = ptr;
      while (canRead() && isAllowedInUnquotedString(peek())) {
        skip();
      }
      return string.substring(start, ptr);
    }

    function readQuotedString() {
      if (!canRead()) {
        return "";
      }
      var next = peek();
      if (!isQuotedStringStart(next)) {
        //throw CommandSyntaxException.BUILT_IN_EXCEPTIONS.readerExpectedStartOfQuote().createWithContext(this);
      }
      skip();
      return readStringUntil(next);
    }

    function readStringUntil(terminator) {
      var result = ""
        , escaped = false;
      while (canRead()) {
        var c = read();
        if (escaped) {
          if (c == terminator || c == "\\") {
            result += c;
            escaped = false;
          } else {
            ptr -= 1;
            //throw CommandSyntaxException.BUILT_IN_EXCEPTIONS.readerInvalidEscape().createWithContext(this, String.valueOf(c));
          }
        } else if (c == "\\") {
          escaped = true;
        } else if (c == terminator) {
          return result;
        } else {
          result += c;
        }
      }

      //throw CommandSyntaxException.BUILT_IN_EXCEPTIONS.readerExpectedEndOfQuote().createWithContext(this);
    }

    function readInt() {
      var start = ptr;
      while (canRead() && isAllowedNumber(peek())) {
        skip();
      }
      var number = string.substring(start, ptr);
      if (number === "") {
        //throw CommandSyntaxException.BUILT_IN_EXCEPTIONS.readerExpectedInt().createWithContext(this);
      }
      var result = Number(number);
      if (isNaN(result) || !Number.isInteger(result)) {
        ptr = start;
        //throw CommandSyntaxException.BUILT_IN_EXCEPTIONS.readerInvalidInt().createWithContext(this, number);
      } else return result
    }

    function readFloat() {
      var start = ptr;
      while (canRead() && isAllowedNumber(peek())) {
        skip();
      }
      var number = string.substring(start, ptr);
      if (number === "") {
        //throw CommandSyntaxException.BUILT_IN_EXCEPTIONS.readerExpectedFloat().createWithContext(this);
      }
      var result = Number(number);
      if (isNaN(result)) {
        ptr = start;
        //throw CommandSyntaxException.BUILT_IN_EXCEPTIONS.readerInvalidFloat().createWithContext(this, number);
      } else return result
    }

    function readString() {
      if (!canRead()) {
        return "";
      }
      var next = peek();
      if (isQuotedStringStart(next)) {
        skip();
        return readStringUntil(next);
      }
      return readUnquotedString();
    }

    return {
      skip: skip,
      read: read,
      peek: peek,
      canRead: canRead,
      getPtr: function () {
        return ptr
      },
      setPtr: function (a) {
        ptr = a
      },
      getString: function () {
        return str
      },
      getRemainingLength: function () {
        return str.length - ptr
      },
      getTotalLength: function () {
        return str.length;
      },
      getRemaining: function () {
        return str.substring(ptr)
      },
      skipWhitespace: skipWhitespace,
      readString: readString,
      readStringUntil: readStringUntil,
      readQuotedString: readQuotedString,
      readUnquotedString: readUnquotedString,
      isAllowedInUnquotedString: isAllowedInUnquotedString,
      isAllowedNumber: isAllowedNumber,
      isQuotedStringStart: isQuotedStringStart,
      readFloat: readFloat,
      readInt: readInt,
      readBoolean: function () {
        var start = ptr;
        var value = readString();
        if (value.isEmpty()) {
          //throw CommandSyntaxException.BUILT_IN_EXCEPTIONS.readerExpectedBool().createWithContext(this);
        }

        if (value === "true") {
          return !0;
        } else if (value === "false") {
          return !1;
        } else {
          ptr = start;
          //throw CommandSyntaxException.BUILT_IN_EXCEPTIONS.readerInvalidBool().createWithContext(this, value);
        }
      },
      expect: function (c) {
        if (!canRead() || peek() != c) {
          //throw CommandSyntaxException.BUILT_IN_EXCEPTIONS.readerExpectedSymbol().createWithContext(this, String.valueOf(c));
        }
        skip();
      }
    }
  }

  function ParamBulider(parent) {
    return {
      parent: parent ? parent : null,
      nodes: {},
      next: function(param){
        Object.assign(this.parent.nodes, param.parent.nodes);
        return this
      },
      literal: function(name){
        this.nodes["literal>" + name] = ParamBulider(this);
        return this.nodes["literal>" + name]
      },
      param: function(name, type){
        this.nodes[type + ">" + name] = ParamBulider(this);
        return this.nodes[type + ">" + name]
      }
    }
  }
  
  ParamBulider.literal = function(name){
    var res = ParamBulider(null);
    res.nodes["literal>" + name] = ParamBulider(res);
    return res.nodes["literal>" + name]
  };
  
  ParamBulider.param = function(name, type){
    var res = ParamBulider(null);
    res.nodes[type + ">" + name] = ParamBulider(res);
    return res.nodes[type + ">" + name]
  };

  var param = ParamBulider(null);

  return {
    register: function (reg) {
      Object.assign(param.nodes, reg.nodes)
    },
    test: function(){
      return param
    },
    ParamBulider: ParamBulider
  }
};

a = Colonel();
console.log(a.ParamBulider())
b = a.ParamBulider();
b.literal('tp').literal("target").next(a.ParamBulider.literal("pos")).literal("pos")
console.log(b)
a.register(b)
console.log(a.test())