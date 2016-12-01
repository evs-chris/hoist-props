#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const hoist = require(path.resolve(fs.realpathSync(path.dirname(__filename)), '../index.js'));

const args = process.argv.slice();

if (~args[0].indexOf('node')) args.shift();
const program = args.shift();

let input = process.stdin;
let output = process.stdout;
let map;
let arg;

while ( arg = args.shift() ) {
  switch (arg) {
    case '-i':
    case '--input':
      input = fs.createReadStream(args.shift());
      break;

    case '-o':
    case '--output':
      output = fs.createWriteStream(args.shift());
      break;

    case '-m':
    case '--map':
      map = args.shift();
      break;

    default:
      console.error('???', arg);
      break;
  }
}

const parts = [];
input.on('data', c => parts.push(c));
input.on('end', () => {
  const code = Buffer.concat(parts).toString('utf8');
  const result = hoist(code);

  console.error(`shaved ${code.length - result.code.length} chars off of ${code.length} or ${((code.length - result.code.length)/code.length) * 100}% for new size of ${result.code.length} chars`);
  if (map) fs.writeFileSync(map, result.map, { encoding: 'utf8' });
  output.on('drain', () => process.exit(0));
  output.write(result.code, 'utf8');
});
