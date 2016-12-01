const acorn = require('acorn');
const walk = require('acorn/dist/walk');
const MagicString = require('magic-string');

function hoist(src, opts) {
  opts = opts || {};
  const ast = acorn.parse(src);
  const str = new MagicString(src);

  const scopes = [];
  // find top level scopes, aka functions
  walk.recursive(ast, {}, {
    FunctionExpression(n) { scopes.push(n); }
  });

  // hoist applicable member accesses in each scope
  scopes.forEach(s => hoistMembers(s, str));

  return { code: str.toString(), map: str.generateMap() };
}

function hoistMembers(scope, str) {
  const identifiers = [];
  const members = {};

  // walk the tree from each function collecting identifiers and member refs
  walk.simple(scope, {
    Identifier(n) {
      if (!~identifiers.indexOf(n.name)) identifiers.push(n.name);
    },
    MemberExpression(n) {
      if (!n.computed) {
        if (!(n.property.name in members)) members[n.property.name] = 1;
        else members[n.property.name]++;
      }
    },
    VariableDeclarator(n) {
      if (!~identifiers.indexOf(n.id.name)) identifiers.push(n.id.name);
    }
  });

  const candidates = [];
  for (name in members) {
    //              times used       net 3 less per       var string weight
    const savings = (members[name] * (name.length - 3)) - (name.length + 9);
    if (savings > 3) candidates.push({ name, savings });
  }
  // move higher savings variables up the list so that they get shorter ids, if available
  candidates.sort((a, b) => a.savings > b.savings ? -1 : a.savings < b.savings ? 1 : 0);

  const newIds = generateIdentifiers(identifiers, candidates.length);

  const map = Object.create(null);
  for (let i = 0; i < newIds.length; i++) {
    map[candidates[i].name] = newIds[i];
  }

  walk.simple(scope, {
    MemberExpression(n) {
      if (!n.computed && n.property.name in map) str.overwrite(n.property.start - 1, n.property.end, `[${map[n.property.name]}]`);
    }
  });

  let anchor;
  if (scope.body.body.length && scope.body.body[0].type === 'ExpressionStatement' && scope.body.body[0].expression.value === 'use strict') {
    anchor = scope.body.body[0].end;
  } else {
    anchor = scope.body.start + 1;
  }
  for (const name in map) {
    str.appendLeft(anchor, `var ${map[name]}='${name}';`);
  }
}

function generateIdentifiers(existing, max) {
  let first = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_';
  let second = first + '1234567890';
  first = first.split('');
  second = second.split('');

  const out = [];
  for (let i = 0; i < first.length && out.length < max; i++) {
    if (!~existing.indexOf(first[i])) out.push(first[i]);
  }

  for (let i = 0; i < first.length && out.length < max; i++) {
    for (let j = 0; j< second.length && out.length < max; j++) {
      const id = first[i] + second[j];
      // yeah
      if (id === 'do' || id === 'in') continue;
      if (!~existing.indexOf(id)) out.push(id);
    }
  }

  return out;
}

module.exports = hoist;
