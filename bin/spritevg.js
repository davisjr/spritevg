#!/usr/bin/env node

const spritevg = require("../lib/index");
const argv = process.argv;

if (argv.length < 3 || !argv[2]) {
  console.log("Usage: spritevg <directory>");
  process.exit(1);
}

spritevg(argv[2]);
