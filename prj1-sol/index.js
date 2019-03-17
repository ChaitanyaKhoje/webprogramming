#!/usr/bin/env nodejs

'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const util = require('util');
const readFile = util.promisify(fs.readFile);

const DocFinder = require('./doc-finder');

/** Top level routine: args[0] is name of stopwords file, args[1...]
 *  are names of content files.
 */
async function go(args) {
    const finder = new DocFinder();
    await finder.addNoiseWords(await readFileContents(args.shift()));
    for (const fName of args) {
        const contents = await readFileContents(fName);
        const name = path.basename(fName, '.txt');
        await finder.addContent(name, contents);
    }
    interact(finder);
}

function interact(finder) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
        completer: (line) => [ finder.complete(line), line ]
    });
    rl.prompt();
    rl.on('line', (line) => doSearch(finder, rl, line));
}

function doSearch(finder, rl, line) {
    const terms = Array.from(new Set(finder.words(line)));
    const t0 = Date.now();
    const results = finder.find(terms);
    const t = Date.now() - t0;
    out(`time: ${t} milliseconds\n`);
    if (results.length === 0) {
        out('no results\n');
    }
    else {
        results.forEach((res) => out(`${res.name}: ${res.score}\n${res.lines}`));
    }
    rl.prompt();
}

async function readFileContents(path) {
    try {
        return await readFile(path, 'utf8');
    }
    catch (err) {
        console.error('cannot read %s: %s', path, err);
        process.exit(1);
    }
}

function out(text) { process.stdout.write(text); }

//top-level code
if (process.argv.length < 4) {
    console.error('usage: %s NOISE_WORDS DOC...', path.basename(process.argv[1]));
    process.exit(1);
}

(async (args) => await go(process.argv.slice(2)))();