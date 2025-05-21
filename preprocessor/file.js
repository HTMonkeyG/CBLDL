/**
 * This interface is environment-related.
 * 
 * Please implement this interface when port to another runtime environment.
 */
class FileInterface {
  constructor() { }

  /**
   * Returns `true` if the path exists, `false` otherwise.
   * @param {string} path 
   * @returns {boolean}
   */
  existSync(path) {
    return false
  }

  /**
   * Synchronously reads the entire contents of a file.
   * @param {string} path 
   * @returns {string}
   */
  readFileSync(path) {
    return ""
  }
}

module.exports = FileInterface;