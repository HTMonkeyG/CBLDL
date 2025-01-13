class FileSlice {
  /**
   * @param {String} file 
   * @param {String} content 
   * @param {Number} start 
   * @param {Number} line 
   * @param {FileSlice} prev 
   * @returns {FileSlice}
   */
  static fromFile(file, content, start, line, prev) {
    var result = new FileSlice();
    // We assume that the comments in the file is removed.
    result.parentContent = content;
    result.file = file;
    result.content = content.split("\n").slice(start, start + line).join("\n");
    result.line = line;
    result.parentLine = start;
    if (prev)
      prev.next = result;
    return result
  }

  constructor() {
    /** File name. */
    this.file = "";
    /** Content of this slice. */
    this.content = "";
    /** Content of complete file. */
    this.parentContent = "";
    /** Start position. */
    this.parentLine = 0;
    /** Amount of lines this slice contains. */
    this.line = 0;
    /** Next slice. */
    this.next = null;
  }

  toString() {
    return `# "${this.file}": ${this.parentLine}\n${this.content}${this.next ? "\n" + this.next : ""}`
  }
}

module.exports = FileSlice;