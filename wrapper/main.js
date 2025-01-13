const NBT = require("parsenbt-js")
  , MCS = require("mcstructure-js")
  , PMR = require("project-mirror-registry")
  , FMT = require("@htmonkeyg/tformat")
  , ARG = require('arg')
  , ps = require("process")
  , fs = require("fs")
  , pl = require("path")
  , defaultRule = require("./defaultRule.js")
  , BlockGroup = require("./blockGroup.js")
  , consts = require("./constants.js")
  , printf = FMT.printF;

const VERSION = consts.VERSION
  , PROGNAME = consts.PROGNAME
  , CMD = consts.CMD
  , CB = consts.CB;

function version(v) {
  !v && (v = VERSION);
  return `v${Math.floor(v / 10000)}.${Math.floor(v / 100 % 100)}.${Math.floor(v % 100)}`;
}

function error(reason, param, exit) {
  if (!reason)
    reason = errorFlag;
  if (!reason)
    return;

  switch (reason) {
    case 1:
      printf("§r§lhlcl-wrapper: §r§cerror: §rinput %0 does not exist or is a directory", param);
      break;
    case 2:
      printf("§r§lhlcl-wrapper: §r§cfatal error: §rno input files");
      break;
    case 3:
      printf("§r§lhlcl-wrapper: §r§cerror: §rread file error: %0", param);
      break;
    case 4:
      printf("§r§lhlcl-wrapper: §r§cfatal-error: §rread file failed");
      break;
    case 5:
      printf("§r§lhlcl-wrapper: §r§cerror: §rfile %0: invalid version %1", param);
      break;
    case 6:
      printf("§r§lhlcl-wrapper: §r§cerror: §rfile %0: invalid version %1", param);
      break;
  }

  exit && ps.exit(exit);
}

var args = ARG({
  '--help': Boolean,
  '--version': Boolean,
  '-o': String,
  '--link-only': Boolean,
  '-w': String,
  '-v': '--version',
  '-h': '--help',
  '-l': '--link-only'
});

if (args["--version"]) {
  printf(`HLCL Linker & Wrapper ${version()}`);
  printf("Copyright (C) 2024 HTMonkeyG");
  ps.exit(0)
}

if (args["--help"]) {
  printHelp();
  ps.exit(0)
}

var localPath = ""//pl.dirname(ps.argv[1])
  , inputFiles = Array.from(args._)
  , fileContent = {}
  , rule = null
  , errorFlag = 0
  , globalSymbol = {}
  , area = new BlockGroup();

// Preload files
if (!inputFiles.length)
  error(2, [], 1);

for (var file of inputFiles) {
  pl.isAbsolute(file) || (file = pl.join(localPath, file));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory())
    error(1, [file]), errorFlag = 2;
  else
    try {
      fileContent[file] = JSON.parse(fs.readFileSync(file, 'utf-8'))
    } catch (e) {
      error(3, [e.message]);
      errorFlag = 4
    }
}
// Test error flag
error(0, [], 1);

// Wrapping rule
if (args["-w"]) {
  var file = args["-w"];
  pl.isAbsolute(file) || (file = pl.join(localPath, file));

  if (!fs.existsSync(file) || fs.statSync(file).isDirectory())
    error(6, [file]), errorFlag = 7;
  else
    try {
      rule = JSON.parse(fs.readFileSync(file, 'utf-8'))
    } catch (e) {
      error(3, [e.message]);
      errorFlag = 4
    }
} else
  rule = defaultRule;
// Test error flag
error(0, [], 1);

//validateRule();
preprocessArea();

function preprocessArea() {
  var preprocessRule = rule.preprocess;


}

/**
 * Preprocess files.
 */
function preprocessFile() {

}

/**
 * Wrap single normal CBG file.
 */
function normalCBG(file, content) {
  var CBG = content, v, type;

  type = CBG.type;
  v = CBG.version || VERSION;

  if (v > VERSION)
    error(5, [file, version(v)]);

  for (var module of CBG) {
    for (var chain of module) {
      var blocks = [];
      for (var block of chain) {
        /**
         * CBG command block format:
         * {
         *   "type": ...,
         *   "name": ...,
         *   "delay": ...,
         *   "condition": ...,
         *   "commandType": ...,
         *   "command": ...,
         * }
         */
        var a;
        switch (block.type) {
          case CB.CHAIN:
            a = PMR.createBlockEntity("chain_command_block");
            break;
          case CB.PULSE:
            a = PMR.createBlockEntity("command_block");
            break;
          case CB.REPEAT:
            a = PMR.createBlockEntity("repeating_command_block");
            break;
          case CB.BREAK:
            a = NBT.create(1);
            break;
        }
      }
    }
  }
}

/**
 * Wrapping CBG with symbols
 */
function symbolCBG() {

}

function printHelp() {
  printf("Usage: %0 [options] input...", [PROGNAME]);
  printf("Options:");
  printf("  -v or --version           Display version information.")
  printf("  -h or --help              Display this information.");
  printf("  -o <filename>             Specify output file name (\"a.o\" by default).");
  printf("  -l or --link-only         Only links the input files.");
  printf("  -w <rule>                 Specify the wrapping rule.");
}