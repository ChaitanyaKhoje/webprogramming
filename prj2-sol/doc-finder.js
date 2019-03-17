const assert = require('assert');
const mongo = require('mongodb').MongoClient;

const {inspect} = require('util'); //for debugging

'use strict';

/** This class is expected to persist its state.  Hence when the
 *  class is created with a specific database url, it is expected
 *  to retain the state it had when it was last used with that URL.
 */ 
class DocFinder {

    /** Constructor for instance of DocFinder. The dbUrl is
     *  expected to be of the form mongodb://SERVER:PORT/DB
     *  where SERVER/PORT specifies the server and port on
     *  which the mongo database server is running and DB is
     *  name of the database within that database server which
     *  hosts the persistent content provided by this class.
     */
    constructor(dbUrl) {
        //console.log("DEBUG: Constructor call");
        let dbName = dbUrl.substring(dbUrl.lastIndexOf("/") + 1, dbUrl.length);
        let url = dbUrl.substring(0, dbUrl.lastIndexOf("/") + 1);
        process.env.MONGO_DBNAME = dbName;
        process.env.MONGO_URL = url;
        this.noiseWordsSet = new Set();
        this.contentMap = new Map();
    }

    /** This routine is used for all asynchronous initialization
     *  for instance of DocFinder.  It must be called by a client
     *  immediately after creating a new instance of this.
     */
    async init() {
        let client;
        if (!client) client = await mongo.connect(process.env.MONGO_URL, {useNewUrlParser: MONGO_OPTIONS.useNewUrlParser});
        this.client = client;
        const db = client.db(process.env.MONGO_DBNAME);
        this.db = db;
        this.contentMapCollection = this.db.collection('ContentMap');
        this.noiseWordsCollection = this.db.collection('NoiseWords');
        this.documentsCollection = this.db.collection('Documents');
        //console.log("DEBUG: Database connected? >> " + db.serverConfig.isConnected());
    }

    /** Release all resources held by this doc-finder.  Specifically,
     *  close any database connections.
     */
    async close() {
        if(this.client) await this.client.close();
    }

    /** Clear database */
    async clear() {
        let collections = await this.db.collections();
        for(let i = 0; i < collections.length; i++) {
            let col = collections[i];
            await col.drop();
        }
    }

    /** Return an array of non-noise normalized words from string
     *  contentText.  Non-noise means it is not a word in the noiseWords
     *  which have been added to this object.  Normalized means that
     *  words are lower-cased, have been stemmed and all non-alphabetic
     *  characters matching regex [^a-z] have been removed.
     */
    async words(contentText) {
        let wordsArray;
        wordsArray = contentText.match(WORD_REGEX);
        let normalizedWordArray = [];

        // Fetch noise words from database
        let storedNoiseWords = await this.noiseWordsCollection.find().toArray();
        storedNoiseWords = storedNoiseWords.map(a => a._id);

        if(wordsArray !== null) {
            for (let word of wordsArray) {
                word = normalize(word);
                if (!storedNoiseWords.includes(word)) {
                    let normalizedWord = normalize(word);
                    normalizedWordArray.push(normalizedWord);
                }
            }
        }
        return normalizedWordArray;
    }

    /** Add all normalized words in the noiseText string to this as
     *  noise words.  This operation should be idempotent.
     */
    async addNoiseWords(noiseText) {
        let noiseWordArray = noiseText.split(/\s+/);
        for (let noiseWord of noiseWordArray) {
            if (noiseWord !== "") this.noiseWordsSet.add(noiseWord);
        }
        for(let nW of this.noiseWordsSet) {
            let output = await this.noiseWordsCollection.updateOne({'_id':nW}, {$set: {"NoiseWord": nW}}, {upsert: true});
        }
    }

    /** Add document named by string name with specified content string
     *  contentText to this instance. Update index in this with all
     *  non-noise normalized words in contentText string.
     *  This operation should be idempotent.
     */
    async addContent(name, contentText) {
        //console.log("DEBUG: ADDING CONTENT...");

        // MAP: value contains which document contains the word and how many times.
        // map = {"word1": {"doc1": {"numberOfOccurrence":12,"line":"xyz"}};
        let lines = contentText.split("\n");
        let i = 0;
        for (let line of lines) {
            if (line === "" || line === " ") continue;
            ++i;
            let normalizedWords = await this.words(line);
            for (let normalizedWord of normalizedWords) {
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
        // Main map is ready, now send to the database.

        try {
            await this.documentsCollection.updateOne({'_id': name},
                {$set: {"Content": contentText}}, {upsert: true});

            for (let entry of this.contentMap) {
                await this.contentMapCollection.updateOne({'_id': entry[0]},
                    {$set: {"Value": entry[1]}}, {upsert: true});
            }
        } catch (e) {
            console.log(e);
        }

    }

    /** Return contents of document name.  If not found, throw an Error
     *  object with property code set to 'NOT_FOUND' and property
     *  message set to `doc ${name} not found`.
     */
    async docContent(name) {
        let storedNoiseWords;
        storedNoiseWords = await this.documentsCollection.findOne({'_id': name});
        if (storedNoiseWords === null || storedNoiseWords === undefined) {
            let err = new Error();
            err.code = 'NOT_FOUND';
            err.message = "doc " + name + " not found!";
            throw err;
        }
        return storedNoiseWords.Content;
    }

    /** Given a list of normalized, non-noise words search terms,
     *  return a list of Result's  which specify the matching documents.
     *  Each Result object contains the following properties:
     *
     *     name:  the name of the document.
     *     score: the total number of occurrences of the search terms in the
     *            document.
     *     lines: A string consisting the lines containing the earliest
     *            occurrence of the search terms within the document.  The
     *            lines must have the same relative order as in the source
     *            document.  Note that if a line contains multiple search
     *            terms, then it will occur only once in lines.
     *
     *  The returned Result list must be sorted in non-ascending order
     *  by score.  Results which have the same score are sorted by the
     *  document name in lexicographical ascending order.
     *
     */
    async find(terms) {
        let names, score, lines;
        let resultsArray = [];
        let documents;

        if (terms.length > 1) {
            let multiWordMap = new Map();
            let i = 0;
            let normalizedTerms = [];
            // Create multi word map
            for (let term of terms) {
                for(let j = 0; j < terms.length; j++) {
                    term = normalize(terms[j]);
                    normalizedTerms.push(term);
                }
                let wordEntries = await this.contentMapCollection.find({'_id': {$in: normalizedTerms}}).toArray();

                for(; i < wordEntries.length; i++) {
                    documents = wordEntries[i].Value;
                    if (documents !== undefined && documents !== null && term !== "") {
                        for (let docObject in documents) {
                            if (multiWordMap.has(docObject)) {
                                let existingKey = [];
                                existingKey = multiWordMap.keys();
                                multiWordMap.get(docObject).push({
                                    tm: term,
                                    occurrences: documents[docObject].numberOfOccurrence,
                                    line: documents[docObject].ln,
                                    lineNo: documents[docObject].lineNumber
                                });
                            } else {
                                multiWordMap.set(docObject, [{
                                    tm: term,
                                    occurrences: documents[docObject].numberOfOccurrence,
                                    line: documents[docObject].ln,
                                    lineNo: documents[docObject].lineNumber
                                }]);
                            }
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
            term = normalize(term);
            let wordEntry = await this.contentMapCollection.find({'_id': {$eq: term}}).toArray();
            if (wordEntry.length !== 0) documents = wordEntry[0].Value;

            if (documents !== undefined && documents !== null && term !== "") {
                for (let docObject in documents) {
                    score = documents[docObject].numberOfOccurrence;
                    lines = documents[docObject].ln;
                    resultsArray.push(new Result(docObject.toString(), score, lines));
                    //console.log("DEBUG: Document: " + docObject.toString() + "added to result array.");
                }
            }
        }
        resultsArray.sort(compareResults);
        return resultsArray;
    }

    /** Given a text string, return a ordered list of all completions of
     *  the last normalized word in text.  Returns [] if the last char
     *  in text is not alphabetic.
     */
    async complete(text) {
        if(text !== "" && text!== " ") {
            let orderedList = [];
            let textArray = text.split(/\s+/);
            text = textArray[textArray.length - 1];
            text = normalize(text);
            let re = new RegExp("\^" + text + "\.\*");
            let words = await this.contentMapCollection.find('_id').toArray();

            if(text !== "") {
                for (let k = 0; k < words.length; k++) {
                    let word = normalize(words[k]._id);
                    if (re.test(word)) {
                        orderedList.push(word);
                    }
                }
                orderedList.sort();
            }
            return orderedList;
        }
    }
    //Add private methods as necessary


} //class DocFinder

module.exports = DocFinder;

//Add module global functions, constants classes as necessary
//(inaccessible to the rest of the program).

//Used to prevent warning messages from mongodb.
const MONGO_OPTIONS = {
  useNewUrlParser: true
};

/** Regex used for extracting words as maximal non-space sequences. */
const WORD_REGEX = /\S+/g;

/** A simple utility class which packages together the result for a
 *  document search as documented above in DocFinder.find().
 */ 
class Result {
  constructor(name, score, lines) {
    this.name = name; this.score = score; this.lines = lines;
  }

  toString() { return `${this.name}: ${this.score}\n${this.lines}`; }
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



