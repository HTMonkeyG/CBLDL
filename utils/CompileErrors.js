class CompileError extends Error {
  static ContextAmount = 20;
  static BuiltIn = null;
  static Code = {
    TypeError: 'Type Error',
    ReferenceError: 'Reference Error',
    SyntaxError: 'Syntax Error'
  }

  constructor(type, code, message, context) {
    super(code + ": " + message, null);
    this.type = type;
    this.code = code;
    this.message = code + ": " + message;
    if (typeof context == 'undefined') {
      this.input = null;
      this.line = -1;
      this.lineOffset = -1;
      this.ptr = -1;
    } else {
      this.input = context.input;
      this.line = context.line;
      this.lineOffset = context.lineOffset;
      this.ptr = context.range.end;
    }
  }

  getMessage() {
    var message = this.message
      , context = this.getContext();
    if (context != null) {
      message += " at line " + this.line + ":\n" + context;
    }
    return message;
  }

  getRawMessage() { return this.message }
  getType() { return this.type }
  getInput() { return this.input }
  getLine() { return this.line }

  getContext() {
    if (this.input == null || this.line < 0)
      return null;

    var builder = "", offset = this.lineOffset;

    if (offset > CompileError.ContextAmount)
      builder += "...";

    builder += this.input.substring(this.ptr - Math.min(CompileError.ContextAmount, offset - 1), this.ptr).trim();
    builder += " <--[HERE]";

    return builder
  }
}

class SimpleCompileErrorType {
  constructor(code, message) { this.code = code; this.message = message }
  create() { return new CompileError(this, this.code, this.message) }
  createWithContext(context) {
    return new CompileError(
      this,
      this.code,
      this.message,
      context
    )
  }
  toString() { return message }
}

class DynamicCompileErrorType {
  constructor(code, func) { this.code = code; this.function = func }
  create(...arg) { return new CompileError(this, this.code, this.function.apply(null, arg)) }
  createWithContext(context, ...arg) {
    return new CompileError(
      this,
      this.code,
      this.function.apply(null, arg),
      context
    )
  }
}

CompileError.BuiltIn = {
  invalidToken: new SimpleCompileErrorType(CompileError.Code.SyntaxError, "Invalid or unexpected token"),
  unexpectedToken: new DynamicCompileErrorType(CompileError.Code.SyntaxError, token => "Unexpected token or identifier '" + token + "'"),
  invalidInitializer: new SimpleCompileErrorType(CompileError.Code.SyntaxError, "Invalid initializer in declaration"),
  invalidBreak: new SimpleCompileErrorType(CompileError.Code.SyntaxError, "Illegal break statement"),
  missingInitializer: new SimpleCompileErrorType(CompileError.Code.SyntaxError, "Missing initializer in const declaration"),
  invalidAssign: new SimpleCompileErrorType(CompileError.Code.SyntaxError, "Invalid left-hand side in assignment"),
  invalidPostfix: new SimpleCompileErrorType(CompileError.Code.SyntaxError, "Invalid left-hand side expression in postfix operation"),
  invalidPrefix: new SimpleCompileErrorType(CompileError.Code.SyntaxError, "Invalid left-hand side expression in prefix operation"),

  invalidDelete: new SimpleCompileErrorType(CompileError.Code.ReferenceError, "Invalid expression in delete operation"),
  invalidDelay: new SimpleCompileErrorType(CompileError.Code.ReferenceError, "Invalid expression in delayh operation"),
  notDeclared: new DynamicCompileErrorType(CompileError.Code.ReferenceError, token => token + " is not declared"),
  readUninit: new DynamicCompileErrorType(CompileError.Code.ReferenceError, token => "Cannot access " + token + " before initialization"),

  assignToConst: new SimpleCompileErrorType(CompileError.Code.TypeError, "Assignment to constant variable"),
  targetTypeError: new DynamicCompileErrorType(CompileError.Code.TypeError, token => "Target must be a string or selector, received: " + token),
  objTypeError: new DynamicCompileErrorType(CompileError.Code.TypeError, token => "Objective must be a string or selector, received: " + token),
  OperationTypeError1: new DynamicCompileErrorType(CompileError.Code.TypeError, (op, p1) => `Invalid operation '${op}' for type '${p1}'`),
  OperationTypeError2: new DynamicCompileErrorType(CompileError.Code.TypeError, (op, p1, p2) => `Invalid operation '${op}' for type '${p1}' and '${p2}'`),
};

export { CompileError, SimpleCompileErrorType, DynamicCompileErrorType };