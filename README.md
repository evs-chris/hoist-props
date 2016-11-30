## Hoist yer members, matey!

This uses the lovely [acorn](https://github.com/ternjs/acorn) and [magic-string](https://github.com/Rich-Harris/magic-string) libraries to find all of your long property accesses, like `document.createDocumentFragment()`, create smaller variables with the property names hoisted to the top of the scope, and replaces them with something like `document[a]()`. At the top of the scope, you'll end up with `var a='createDocumentFragment';`, but anywhere in that scope, you'll have a much shorter reference.

I don't know if this is a good idea. It may have performance implications that I haven't run across. It may already be implemented in the closure compiler or something like it. All I know is that it can save ~15% on a big funky code base.

### But why?

I was looking into making [Ractive](https://github.com/ractivejs/ractive)'s minified code a bit smaller, so I did an analysis of the most repeated strings. The analysis surfaced the usual suspects, `function`, `prototype`, and more like that, but it also had a ton of `parentFragment` and `instance`-like strings that kinda surprised me. Looking slightly harder, those turned out to be member accesses on objects just about everywhere, which uglify doesn't touch by default.

When checking to see if I had just missed a flag on uglify to take care of those pesky, large property names, I found the relatively recent `--mangle-props` option, which instilled a bit of hope. It turns out that "mangle" is a good name for that, as you have to set up a blacklist of names to skip in order to end up with a still-functioning public interface.

So, back round to how to shrink the large-ish property names, I thought I could just do a regex replace on some of them as a second minification stage, which is fine for those that are always in the right place and don't have partially overlapping names. Next I figured I could put a sigil on the biggest offenders to aid in my quest to shrink member accesses a bit, but I noticed the code got way uglier with `item._parentFragment` or `item.$parentFragment` scattered all over the place. Updating _all_ of the code _everywhere_ that those names could safely be adjusted was also a very tedious process that had to be repeated for _each and every_ target property.

Then I had my lightbulb moment and said, "we can access properties with a variable, so why not save the name in a variable and do that?" Surely someone else has done this. I looked at uglify again, and I still don't see any safe option that suites. I thought about trying to do a PR against uglify and nearly drowned - that code is way over my head. Instead, I gathered up the two most convenient libraries I could find to do this sort of stuff and wrote this as a proof-of-concept, and sure enough, it took a dev build of Ractive, which was 214887b minified and shrank it down to 183574b. It even still worked!

### Other things of note

This uses acorn to get an AST of the source and manually _tries_ to find all of the top-level scopes (functions). This works out very well for IIFE and UMD libraries. I have not tested it on anything else, but I can't really think of a good reason to apply this until everything is already bundled and uglified.

After the top-level scopes are gathered, this uses an acorn simple walker to find all of the identifiers, declarations, and member expressions to record what short names are already used and stats on which members are referenced the most. It then walks through the members and gets a savings estimate on each one by factoring in the size of the new access (`.foozle` becomes `[aa]`), the number of times it would apply, and the cost of the hoist (`var aa='foozle';`). I used the doubled identifier because most minified code has a fair number of single char identifiers used already. This will try single char identifiers first. Anything with a savings of more than 3 chars is paired up with a new identifier, and the AST is traversed again replacing member accesses that have a new identifier with the bracketed form. Finally, all of the new hoisted names are added just inside the body of the scope, after `'use strict';` if it's there.

### TODO

* Have someone much smarter than me take a look at this
* Add a CLI and publish to npm if it's sane

### License

MIT, WTFPL - go nuts
