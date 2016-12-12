#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const hoist = require(path.resolve(fs.realpathSync(path.dirname(__filename)), '../index.js'));

const args = process.argv.slice();

if (~args[0].indexOf('node')) args.shift();
const program = args.shift();

const options = {};
let input = process.stdin;
let output = process.stdout;
let map;
let arg;

while ( arg = args.shift() ) {
  switch (arg) {
    case '-h':
      console.error(`Usage: ${program} [options] [file]

If no input file or option is specified, STDIN will be used. If
no output file or option is specified, STDOUT will be used.

Options:
  -i, --input     the file to read
  -o, --output    the file to write
  -m, --map       flag - when present creates \${output}.map
  -w, --whitelist comma separated list of identifiers to
                  consider for hoisting
  -r, --replace   replace the first member with the second
                  this is handy for performance-sensitive accesses
`);
      process.exit(2);
      break;

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

    case '-w':
    case '--whitelist':
      options.whitelist = args.shift().split(',');
      break;

    case '-r':
    case '--replace':
      if (!options.replace) options.replace = Object.create(null);
      options.replace[args.shift()] = args.shift();
      break;

    default:
      // last arg may be input file
      if (!args.length) {
        input = fs.createReadStream(arg);
      } else {
        console.error('???', arg);
      }
      break;
  }
}

const parts = [];
input.on('data', c => parts.push(c));
input.on('end', () => {
  const code = Buffer.concat(parts).toString('utf8');
  const result = hoist(code, options);

  console.error(`shaved ${code.length - result.code.length} chars off of ${code.length} or ${((code.length - result.code.length)/code.length) * 100}% for new size of ${result.code.length} chars`);
  if (map) fs.writeFileSync(map, result.map, { encoding: 'utf8' });
  output.on('drain', () => process.exit(0));
  output.write(result.code, 'utf8');
});
