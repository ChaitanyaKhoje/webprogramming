'use strict';

const cors = require('cors');
const express = require('express');
const bodyParser = require('body-parser');
const process = require('process');
const url = require('url');
const queryString = require('querystring');

const OK = 200;
const CREATED = 201;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;
const SERVER_ERROR = 500;

//Main URLs
const DOCS = '/docs';
const COMPLETIONS = '/completions';

//Default value for count parameter
const COUNT = 5;

/** Listen on port for incoming requests.  Use docFinder instance
 *  of DocFinder to access document collection methods.
 */
function serve(port, docFinder) {
  const app = express();
  app.locals.port = port;
  app.locals.finder = docFinder;
  setupRoutes(app);
  const server = app.listen(port, async function() {
    console.log(`PID ${process.pid} listening on port ${port}`);
  });
  return server;
}

module.exports = { serve };

function setupRoutes(app) {
  app.use(cors());            //for security workaround in future projects
  app.use(bodyParser.json()); //all incoming bodies are JSON
  //@TODO: add routes for required 4 services

  app.get(`${DOCS}/:id`, doGetContent(app));
  app.post(DOCS, doCreate(app));
  app.get(`${COMPLETIONS}?:text`, doGetCompletions(app));
  app.get(`${DOCS}`, doGetSearchContent(app));
  app.use(doErrors()); //must be last; setup for server errors   
}

//@TODO: add handler creation functions called by route setup
//routine for each individual web service.  Note that each
//returned handler should be wrapped using errorWrap() to
//ensure that any internal errors are handled reasonably.

function doGetContent(app) {
    return errorWrap(async function(req, res) {
        try {
            const id = req.params.id;
            const results = await app.locals.finder.docContent(id);
            const url = baseUrl(req, `${DOCS}/${id}`);
            let obj = {
                "content": results,
                links: [{
                    "rel": "self",
                    "href": url
                }]
            };
            res.json(obj);
        }
        catch(err) {
            res.status(NOT_FOUND);
            const mapped = mapError(err);
            res.json(mapped);
        }
    });
}

function doGetCompletions(app) {
    return errorWrap(async function(req, res) {
        try {
            const id = req.query || {};
            let results;
            if (id.text !== undefined) {
                results = await app.locals.finder.complete(id.text);
            } else {
                throw {
                    code: 'BAD_PARAM',
                    message: `required query parameter \"text\" is missing`,
                };
            }
            res.json(results);
        }
        catch(err) {
            res.status(BAD_REQUEST);
            const mapped = mapError(err);
            res.json(mapped);
        }
    });
}

function doCreate(app) {
    return errorWrap(async function (req, res) {
        try {
            const id = req.body || {};
            if (id.name === undefined) {
                throw {
                    code: 'BAD_PARAM',
                    message: `required body parameter \"name\" is missing`,
                };
            } else if (id.content === undefined) {
                throw {
                    code: 'BAD_PARAM',
                    message: `required body parameter \"content\" is missing`,
                };
            }
            const name = id.name;
            const content = id.content;
            await app.locals.finder.addContent(name, content);
            res.append('Location', baseUrl(req, DOCS) + '/' + name);
            res.send({"href": baseUrl(req, DOCS) + '/' + name});
            res.status(CREATED);
        } catch (err) {
            res.status(BAD_REQUEST);
            const mapped = mapError(err);
            res.json(mapped);
        }
    });
}

function doGetSearchContent(app) {
    return errorWrap(async function (req, res) {
        try {
            const QUERY_PARAMS = req.query || {};
            let start = QUERY_PARAMS.start;
            if (start === undefined) start = 0;
            let cnt = QUERY_PARAMS.count;
            if (cnt === undefined) cnt = COUNT;
            let tempCntForPrev = cnt;
            let query = QUERY_PARAMS.q;
            if (QUERY_PARAMS.q === undefined) {
                throw {
                    code: 'BAD_PARAM',
                    message: `required query parameter \"q\" is missing`,
                };
            }
            if (QUERY_PARAMS.start !== undefined && isNaN(QUERY_PARAMS.start)) {
                throw {
                    code: 'BAD_PARAM',
                    message: `bad query parameter \"start\"`,
                };
            }
            if (QUERY_PARAMS.start < 0) {
                throw {
                    code: 'BAD_PARAM',
                    message: `bad query parameter \"start\"`
                }
            }
            if (QUERY_PARAMS.count !== undefined && isNaN(QUERY_PARAMS.count)) {
                throw {
                    code: 'BAD_PARAM',
                    message: `bad query parameter \"count\"`,
                };
            }
            if (QUERY_PARAMS.count < 0) {
                throw {
                    code: 'BAD_PARAM',
                    message: `bad query parameter \"count\"`
                }
            }

            let resultArray = [];

            const results = await app.locals.finder.find(query);
            for (let i = start; cnt !== 0; i++) {
                let obj = results[i];
                if (obj === undefined) break;
                obj['href'] = baseUrl(req, `${DOCS}/${results[i].name}`);
                resultArray.push(obj);
                cnt--;
            }

            // Check for prev and next
            let next, prev;

            // Handling next and prev depending what start and count is.

            if (start === 0) {
                if (tempCntForPrev > results.length) {
                    next = 0;
                    if (start !== 0) prev = 0;
                } else {
                    if (start !== 0) prev = 0;
                    next = tempCntForPrev;
                }
            } else if (start > 0) {
                prev = start - tempCntForPrev;
                if (prev < 0 && start > 0) prev = 0;
                //next = results.length - start;
                next = Number(start) + Number(tempCntForPrev);
                if (next > results.length) next = 0;
            }
            if (next > results.length) next = -1;
            if (next === undefined || next < start) next = -1;
            if (prev === undefined) prev = -1;
            let links = {};
            links = {"nextEle": Number(next), "prevEle": Number(prev), "st": Number(start)};
            console.log("NEXT: ", links.nextEle, "PREV: ", links.prevEle, "START: ", start);
            let finalObj = buildJSONObj(req, resultArray, "GET_SEARCH_CONTENT", results, links, QUERY_PARAMS);
            res.json(finalObj);
        }
        catch (err) {
            res.status(BAD_REQUEST);
            const mapped = mapError(err);
            res.json(mapped);
        }
    });
}

/**
 * Builds JSON object
 */
function buildJSONObj(req, res, operation, results, links, QUERY_PARAMS) {

    let obj = {};
    links = {};
    const url = baseUrl(req, DOCS);
    if (operation === "GET_CONTENT") {
        obj = {
            "content": res,
            links: [{
                "rel": "self",
                "href": url
            }]
        };
    }

    if (operation === "GET_SEARCH_CONTENT") {

        // Check if we actually have 'next' or 'prev' on the current given input.
        let selfURL = baseUrl(req, DOCS);
        selfURL = selfURL.concat('', '?', (QUERY_PARAMS.q !== undefined) ? 'q=' + (QUERY_PARAMS.q).replace(' ', '%20') : ''
            , (QUERY_PARAMS.start !== undefined) ? '&start=' + QUERY_PARAMS.start : '&start=' + 0
            , (QUERY_PARAMS.count !== undefined) ? '&count=' + QUERY_PARAMS.count : '&count=' + COUNT);

        obj = {
            "results": res,
            "totalCount": results.length,
            "links": [{"rel": "self", "href": selfURL}]
        };

        let nextURL = baseUrl(req, DOCS);;
        let prevURL = baseUrl(req, DOCS);;
        if (links !== undefined) {
            console.log("DATA: ", links.nextEle, links.st, Number(QUERY_PARAMS.count));
            if ((links.nextEle !== null && links.nextEle > 0 && results.length >= links.nextEle)
                || (Number(links.nextEle) === 0 && Number(links.st) === 0 && Number(QUERY_PARAMS.count) === 0)){
                nextURL = nextURL.concat('', '?', (QUERY_PARAMS.q !== undefined) ? 'q=' + (QUERY_PARAMS.q).replace(' ', '%20') : ''
                    , '&start=' + links.nextEle
                    , (QUERY_PARAMS.count !== undefined) ? '&count=' + QUERY_PARAMS.count : '&count=' + COUNT);

               /* obj = {
                    "results": res,
                    "totalCount": results.length,
                    "links": [{"rel": "self", "href": selfURL}, {"rel": "next", "href": nextURL}]
                };*/

                if (obj.results.length !== 0) {
                    obj.links.push({"rel": "next", "href": nextURL});
                }
            }
            if (links.prevEle !== null && links.prevEle >= 0) {
                prevURL = prevURL.concat('', '?', (QUERY_PARAMS.q !== undefined) ? 'q=' + (QUERY_PARAMS.q).replace(' ', '%20') : ''
                    , '&start=' + links.prevEle
                    , (QUERY_PARAMS.count !== undefined) ? '&count=' + QUERY_PARAMS.count : '&count=' + COUNT);

                /*obj = {
                    "results": res,
                    "totalCount": results.length,
                    "links": [{"rel": "self", "href": selfURL}, {"rel": "previous", "href": prevURL}]
                };*/

                obj.links.push({"rel": "previous", "href": prevURL});
            }
        }
    }
    if (0 === Number(QUERY_PARAMS.count)) {
        obj.results.length = 0;
    }
    return obj;
}

/** Return error handler which ensures a server error results in nice
 *  JSON sent back to client with details logged on console.
 */ 
function doErrors(app) {
  return async function(err, req, res, next) {
    res.status(SERVER_ERROR);
    res.json({ code: 'SERVER_ERROR', message: err.message });
    //console.error(err);
  };
}

/** Set up error handling for handler by wrapping it in a 
 *  try-catch with chaining to error handler on error.
 */
function errorWrap(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    }
    catch (err) {
      next(err);
    }
  };
}

/** Return base URL of req for path.
 *  Useful for building links; Example call: baseUrl(req, DOCS)
 */
function baseUrl(req, path='/') {
  const port = req.app.locals.port;
  const url = `${req.protocol}://${req.hostname}:${port}${path}`;
  return url;
}

const ERROR_MAP = {
    EXISTS: CONFLICT,
    NOT_FOUND: NOT_FOUND,
    BAD_REQUEST: BAD_REQUEST,

};

/** Map domain/internal errors into suitable HTTP errors.  Return'd
 *  object will have a "status" property corresponding to HTTP status
 *  code.
 */
function mapError(err) {
    //console.error(err);

    if (err.code === 'NOT_FOUND') {
        return {
            code: 'NOT_FOUND',
            message: err.message
        }
    }

    if(err.code === 'BAD_PARAM') {
        return {
            code: 'BAD_PARAM',
            message: err.message
        }
    }

    return err.isDomain
        ? { status: (ERROR_MAP[err.errorCode] || BAD_REQUEST),
            code: err.errorCode,
            message: err.message
        }
        : { status: SERVER_ERROR,
            code: 'INTERNAL',
            message: err.toString()
        };
}