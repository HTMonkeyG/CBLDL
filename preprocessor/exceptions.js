class PreprocessError extends Error {
  constructor(msg, context) {
    super(msg);
    this.context = context;
  }
}

class PreprocessWarning extends Error {
  constructor(msg, context) {
    super(msg);
    this.context = context;
  }
}

exports.PreprocessError = PreprocessError;
exports.PreprocessWarning = PreprocessWarning;