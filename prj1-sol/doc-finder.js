const {inspect} = require('util'); //for debugging

'use strict';

class DocFinder {

    /** Constructor for instance of DocFinder. */
    constructor() {
        //@TODO
        this.noiseWordsSet = new Set();
        this.contentMap = new Map();
    }

    /** Return array of non-noise normalized words from string content.
     *  Non-noise means it is not a word in the noiseWords which have
     *  been added to this object.  Normalized means that words are
     *  lower-cased, have been stemmed and all non-alphabetic characters
     *  matching regex [^a-z] have been removed.
     */
    words(content) {
        // split the content and normalize them by calling normalize function, ignore the word if its a noise word and return the remaining array
        let wordsArray = [];
        wordsArray = content.match(WORD_REGEX);
        let normalizedWordArray = [];

        if(wordsArray !== null) {
            for (let word of wordsArray) {
                if (!this.noiseWordsSet.has(word)) {
                    let normalizedWord = normalize(word);
                    normalizedWordArray.push(normalizedWord);
                }
            }
        }
        return normalizedWordArray;
    }

    /** Add all normalized words in noiseWords string to this as
     *  noise words.
     */
    addNoiseWords(noiseWords) {
        let noiseWordArray = noiseWords.split(/\s+/);
        for (let noiseWord of noiseWordArray) {
            if (noiseWord !== "") this.noiseWordsSet.add(noiseWord);
        }
    }

    /** Add document named by string name with specified content to this
     *  instance. Update index in this with all non-noise normalized
     *  words in content string.
     */
    addContent(name, content) {
        // MAP: value contains which document contains the word and how many times.
        // map = {"word1": {"doc1": {"numberOfOccurrence":12,"line":"xyz"}};
        let lines = content.split("\n");
        let i = 0;
        for (let line of lines) {
            if (line === "" || line === " ") continue;
            ++i;
            let normalizedWords = this.words(line);
            for (let normalizedWord of normalizedWords) {
                // Check if normalizedWord exists in map
                // If it exists, check if document with "name" exists in its inner map.
                // It if does, increase the value, which is total occurrences.
                // If the document doesn't exist, create key and value
                // If word doesn't exist, create word
                if (!this.contentMap.has(normalizedWord)) {
                    let documentsMap = new Map();
                    documentsMap.set(name, {numberOfOccurrence: 1, ln: line, lineNumber: i});
                    this.contentMap.set(normalizedWord, documentsMap);
                } else if (this.contentMap.has(normalizedWord)) {
                    if ((this.contentMap.get(normalizedWord).get(name)) !== undefined) {
                        let cnt = this.contentMap.get(normalizedWord).get(name).numberOfOccurrence;
                        let recordedLine = this.contentMap.get(normalizedWord).get(name).ln;
                        let recordedLineNumber = this.contentMap.get(normalizedWord).get(name).lineNumber;
                        this.contentMap.get(normalizedWord).set(name, {
                            numberOfOccurrence: cnt + 1,
                            ln: recordedLine,
                            lineNumber: recordedLineNumber
                        });
                    } else {
                        this.contentMap.get(normalizedWord).set(name, {numberOfOccurrence: 1, ln: line, lineNumber: i});
                    }
                }
            }
        }
    }

    /** Given a list of normalized, non-noise words search terms,
     *  return a list of Result's  which specify the matching documents.
     *  Each Result object contains the following properties:
     *     name:  the name of the document.
     *     score: the total number of occurrences of the search terms in the
     *            document.
     *     lines: A string consisting the lines containing the earliest
     *            occurrence of the search terms within the document.  Note
     *            that if a line contains multiple search terms, then it will
     *            occur only once in lines.
     *  The Result's list must be sorted in non-ascending order by score.
     *  Results which have the same score are sorted by the document name
     *  in lexicographical ascending order.
     *
     */
    find(terms) {
        let names, score, lines;
        let resultsArray = [];

        if (terms.length > 1) {
            let bothTermsExist = true;
            // Check if the words exist in the same sentence.
            for (let term of terms) {
                term = normalize(term);
                if (!this.contentMap.has(term)) {
                    bothTermsExist = false;
                    break;
                }
            }
            let multiWordMap = new Map();
            // Create multi word map
            for (let term of terms) {
                term = normalize(term);
                if (this.contentMap.has(term) && term !== "") {
                    let docKeys = this.contentMap.get(term).keys();
                    for (let key of docKeys) {
                        if (multiWordMap.has(key)) {
                            let existingKey = [];
                            existingKey = multiWordMap.keys();
                            multiWordMap.get(key).push({
                                tm: term,
                                occurrences: this.contentMap.get(term).get(key).numberOfOccurrence,
                                line: this.contentMap.get(term).get(key).ln,
                                lineNo: this.contentMap.get(term).get(key).lineNumber
                            });
                        } else {
                            multiWordMap.set(key, [{
                                tm: term,
                                occurrences: this.contentMap.get(term).get(key).numberOfOccurrence,
                                line: this.contentMap.get(term).get(key).ln,
                                lineNo: this.contentMap.get(term).get(key).lineNumber
                            }]);
                        }
                    }
                }
            }
            // Fill in the results array.
            for (let termKey of multiWordMap.keys()) {
                let score = 0;
                let line = [];
                multiWordMap.get(termKey).sort(function (a,b){return (a.lineNo - b.lineNo);});
                for (let entry of multiWordMap.get(termKey)) {
                    score = score + parseInt(entry.occurrences);
                    //Checking lines
                    if (!line.includes(entry.line)) {
                        line = line + entry.line + "\n";
                    }
                }

                resultsArray.push(new Result(termKey, score, line));
            }
        } else if (terms.length === 1) {
            let term = terms[0];
            if (this.contentMap.has(term.toLowerCase()) && term !== "") {
                let documents = new Map(this.contentMap.get(term.toLowerCase()));
                names = documents.keys();
                for (let name of names) {
                    score = documents.get(name).numberOfOccurrence;
                    lines = (typeof documents.get(name).ln === 'undefined') ? "" : documents.get(name).ln + "\n";
                    resultsArray.push(new Result(name, score, lines));
                }
            }
        }
        resultsArray.sort(compareResults);
        return resultsArray;
    }

    /** Given a text string, return a ordered list of all completions of
     *  the last word in text.  Returns [] if the last char in text is
     *  not alphabetic.
     */
    complete(text) {

        //Checking if the text is empty or not.
        if(text !== "" && text!== " ") {
            text = normalize(text);
            let orderedList = [];
            let textArray = text.split(/\s+/);

            let re = new RegExp("\^" + textArray[textArray.length - 1] + "\.\*");
            for (let word of this.contentMap.keys()) {
                word = normalize(word);
                if (re.test(word)) {
                    orderedList.push(word);
                }
            }
            orderedList.sort();
            return orderedList;
        }
    }
} //class DocFinder

module.exports = DocFinder;

/** Regex used for extracting words as maximal non-space sequences. */
const WORD_REGEX = /\S+/g;

/** A simple class which packages together the result for a
 *  document search as documented above in DocFinder.find().
 */
class Result {
    constructor(name, score, lines) {
        this.name = name;
        this.score = score;
        this.lines = lines;
    }

    toString() {
        return `${this.name}: ${this.score}\n${this.lines}`;
    }
}

/** Compare result1 with result2: higher scores compare lower; if
 *  scores are equal, then lexicographically earlier names compare
 *  lower.
 */
function compareResults(result1, result2) {
    return (result2.score - result1.score) ||
        result1.name.localeCompare(result2.name);
}

/** Normalize word by stem'ing it, removing all non-alphabetic
 *  characters and converting to lowercase.
 */
function normalize(word) {
    return stem(word.toLowerCase()).replace(/[^a-z]/g, '');
}

/** Place-holder for stemming a word before normalization; this
 *  implementation merely removes 's suffixes.
 */
function stem(word) {
    return word.replace(/\'s$/, '');
}
