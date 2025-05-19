class FileSlice {
  /**
   * Create a copy of `a` or copy `a` to `b`.
   * @param {FileSlice} a 
   * @param {FileSlice} b 
   * @returns {FileSlice}
   */
  static copy(a, b) {
    var result = b || new FileSlice();
    result.completeFile = a.completeFile;
    result.file = a.file;
    result.content = a.content;
    result.parentLine = a.parentLine;
    result.size = a.length;
    result.next = a.next;
    return result
  }

  /**
   * @param {String} file - File Path.
   * @param {String} content - Original file content.
   * @param {Number} start - Slice start position in the file, in lines.
   * @param {Number} line - Slice size, in lines.
   * @param {FileSlice} next - Next slice.
   * @returns {FileSlice}
   */
  static fromFile(file, content, start, line, next) {
    var result = new FileSlice();
    result.completeFile = content;
    result.file = file;
    // We assume that the comments in the file is replaced with empty lines.
    result.content = content.split("\n").slice(start, start + line).join("\n");
    result.size = line;
    result.parentLine = start;
    result.next = next || null;
    return result
  }

  constructor() {
    /** File path. */
    this.file = "";
    /** Content of this slice. */
    this.content = "";
    /** Content of complete file. */
    this.completeFile = "";
    /** Start position. */
    this.parentLine = 0;
    /** Amount of lines this slice contains. */
    this.size = 0;
    /** Next slice. */
    this.next = null;
  }

  /**
   * @param {Number} start - Start line.
   * @param {FileSlice} inserted - The `FileSlice` object to be inserted.
   * @returns {FileSlice}
   */
  insert(start, inserted) {
    var content = this.content.split("\n")
      , oldLines = content.slice(0, start)
      , newLines = content.slice(start)
      , result, s;

    if (!newLines) {
      // `start` is larger than the file size. Set `this.next` only.
      inserted.next = this.next;
      this.next = inserted;
      return
    } else if (!oldLines) {
      // Current slice is completely replaced by a copy of `inserted`.
      result = FileSlice.copy(this);
      FileSlice.copy(inserted, this);
      s = this
    } else {
      result = FileSlice.copy(this);
      result.content = newLines.join("\n");
      result.parentLine = this.parentLine + start;
      result.size = newLines.length;
      this.next = inserted;
      this.content = oldLines.join("\n");
      s = inserted
    }
    for (; ; s = s.next)
      if (!s.next) {
        s.next = result;
        break
      }
    return this
  }

  toString() {
    return `# "${this.file}": ${this.parentLine}\n${this.content}${this.next ? "\n" + this.next : ""}`
  }
}

module.exports = FileSlice;