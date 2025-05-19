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

const PreprocessBuiltinErrors = {
  
};

exports.PreprocessError = PreprocessError;
exports.PreprocessWarning = PreprocessWarning;
exports.PreprocessBuiltinErrors = PreprocessBuiltinErrors;