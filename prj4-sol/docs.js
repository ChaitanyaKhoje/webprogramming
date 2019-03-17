'use strict';

const express = require('express');
const upload = require('multer')();
const fs = require('fs');
const mustache = require('mustache');
const Path = require('path');
const { URL } = require('url');

const STATIC_DIR = 'statics';
const TEMPLATES_DIR = 'templates';

function serve(port, base, model) {
	const app = express();
	app.locals.port = port;
	app.locals.base = base;
	app.locals.model = model;
	process.chdir(__dirname);
	app.use(base, express.static(STATIC_DIR));
	setupTemplates(app, TEMPLATES_DIR);
	setupRoutes(app);
	app.listen(port, function() {
		console.log(`listening on port ${port}`);
	});
}


module.exports = serve;

/******************************** Routes *******************************/

function setupRoutes(app) {
  //@TODO add appropriate routes
  const base = app.locals.base;
  app.get(`/`, redirect(app));
  app.get(`${base}/add.html`, createForm(app));
  app.post(`${base}/add`, upload.single('avatar'), createAddDocument(app));
  app.get(`${base}/search.html`, createSearchForm(app));
  app.get(`${base}/search/:id`, doSearch(app));
  app.get(`${base}/:id`, getContent(app));
}

/*************************** Action Routines ***************************/

//@TODO add action routines for routes + any auxiliary functions.

function redirect(app) {

	return async function(req, res) {
		res.redirect(`/docs`);
	}
}

function getContent(app) {

	return async function(req, res) {
		//console.log("INSIDE GET CONTENT");
		let model;
		const id = req.params.id;
		try {
			const docResults = await app.locals.model.get(id);
			model = { base: app.locals.base, name: id, content: docResults.content };
		}
		catch (err) {
			console.error(err);
			const errors = err.message;
			model = {base: app.locals.base, errors: errors};
		}
		const html = doMustache(app, 'document_content', model);
		res.send(html);
	};
}

function createForm(app) {

	return async function(req, res) {
		const model = {base: app.locals.base};
		//console.log("Hello");
		//console.log(model);
		const html = doMustache(app, 'add_document', model);
		res.send(html);
	};
};

function createSearchForm(app) {

	return async function(req, res) {
		const model = {base: app.locals.base};
		//console.log("Hello search");
		const html = doMustache(app, 'search_results', model);
		res.send(html);
	};
};

function createAddDocument(app) {

	return async function(req, res) {
		let errors = [];
		try {
			//console.log("Inside add document post");
			//console.log("file: ", req.file);
			if (req.file === undefined) {
				errors.push('please select a file containing a document to upload');
			}
			if (errors.length === 0) {
				//console.log("file: ", req.file);
				let fileName = req.file;
				let origName = fileName.originalname.substr(0, fileName.originalname.lastIndexOf('.')) || fileName.originalname;
				//console.log("Name: ", origName);
				let content = req.file.buffer.toString('utf8');
				await app.locals.model.addContent(origName.trim(), content);
				//console.log("SUCCESS");
				res.redirect(`${app.locals.base}/${origName}`);
			}
		}
		catch (err) {
			console.error(err);
			errors.push(err.message);
		}

		if (errors.length !== 0) {
			const model = {base: app.locals.base, errors: errors};
			const html = doMustache(app, 'add_document', model);
			res.send(html);
		}
	};
}

function doSearch(app) {
	return async function(req, res) {
		//console.log("INSIDE DO SEARCH");
		const isSubmit = req.query.submit !== undefined;
		const search = getNonEmptyValues(req.query);
		let isQuery = 1;
		//console.log(search.q)
		if (search.q === undefined) {
			isQuery = 0;
		}
		//console.log("Search termssss: ", search);
		//console.log(isQuery);
		let searchResults = [];
		let errors = [];
		let model, template;
		template = 'search_results';
		
		if (isSubmit || req.query.q !== undefined) {
			if (isQuery === 0) {
				const msg = 'please specify one-or-more search terms';
				errors.push(msg);
				model = {base: app.locals.base, null_search: errors}
			} else if (isQuery === 1) {
				//console.log("QUERY PRESENT");
				const qspace = search.q;
				let q = search.q;
				q = q.split(' ').join('%20');
				//console.log(q);
				try {
					if (req.query.start === undefined) {
						searchResults = await app.locals.model.find(q, 0);
					} else {
						searchResults = await app.locals.model.find(q, req.query.start);
					}
					//console.log("THE SEARCH RESULTS ARE: ", searchResults);
					//console.log("The links are: ", searchResults.links);
					//console.log("ARRAY RESULTS", searchResults.results);
					//console.log("SUCCESS");
					let searchTerm = search.q;
					var highlightedLines = highlightSearchTerms(searchResults.results, searchTerm);
				}
				catch (err) {
					//console.log("CAUGHT");
					errors.push(err.message);
					//console.error(err);
					model = {base: app.locals.base, ws: errors};
				}
				if (errors.length === 0) {
					if (searchResults !== undefined) {
						if (searchResults.results.length > 0) {
							let results = searchResults.results;
							let nextLink;
							let prevLink;
							let lks = [];
							let next_link = '';
							let prev_link = '';
							let newQ = search.q;

							if (searchResults.links.length > 0) {
								searchResults.links.forEach(function (curr, i, arr) {
									//console.log(arr)
									if(curr.rel === 'previous') {
										let pl = '';
										pl = '<a id="previous" href="'+ relativeUrl(req, '', {q: newQ, start: arr[i].start}) +'">Previous</a>'
										lks.push(pl);
										prev_link = pl;
									}
									if(curr.rel === 'next') {
										let nl = '';
										nl = '<a id="next" href="'+ relativeUrl(req, '', {q: newQ, start: arr[i].start}) +'">Next</a>'
										lks.push(nl);
										next_link = nl;
									}
								});
								//console.log(highlightedLines);
								highlightedLines.forEach(function(c,i,a) {
									a[i].href = relativeUrl(req, `${app.locals.base}/${a[i].name}`);
								});
							}
							model = {base: app.locals.base, sr: highlightedLines, s: qspace, n: next_link, p: prev_link, sh: "Search Results"};
						} else {
							errors.push('no document containing "' + search.q + '"  found; please retry');
							model = {base: app.locals.base, s: qspace, not_found: errors};
						}
					}
				}
			}
		}
		const html = doMustache(app, template, model);
		res.send(html);
	};
};

/************************ General Utilities ****************************/

/** return object containing all non-empty values from object values */
function getNonEmptyValues(values) {
	const out = {};
	Object.keys(values).forEach(function(k) {
		const v = values[k];
		if (v && v.trim().length > 0) out[k] = v.trim();
	});
	return out;
}

function highlightSearchTerms(search_res, st) {

	let output = [];
	let terms = st.split(' ');
	// Loop over objects in the results array (document-wise)
	search_res.forEach(function(c,i,ar) {
		if (c.lines.length != 0 && c.lines !== undefined) {
			// Loop over the lines inside a document object
			c.lines.forEach(function(curr, i , arr) {
				// Loop over each term in the search terms array
				terms.forEach(function(t, x, termArray) {
					// Save the current term into a regex
					let re = new RegExp("^"+termArray[x].toLowerCase()+"$");
					// Check if the current line contains the exact match for the current search term
					// Split the line into words and iterate to finally highlight the search term
					arr[i].split(/[^A-Za-z]/).forEach(function(elem, j, ary) {
						if (ary[j].toLowerCase().match(re)) {
							//console.log("TEST PASSED");
							arr[i] = arr[i].replace(ary[j], '<span class="search-term">'+ ary[j] +'</span>');
						}
					});
				});
			});
		}
	});
	output = search_res.slice(0);
	return output;
}

function validate(values, requires=[]) {

}

function wsErrors(err) {
	const msg = (err.message) ? err.message : 'web service error';
	console.error(msg);
	return { _: [ msg ] };
}



/** Return a URL relative to req.originalUrl.  Returned URL path
 *  determined by path (which is absolute if starting with /). For
 *  example, specifying path as ../search.html will return a URL which
 *  is a sibling of the current document.  Object queryParams are
 *  encoded into the result's query-string and hash is set up as a
 *  fragment identifier for the result.
 */
 function relativeUrl(req, path='', queryParams={}, hash='') {
 	const url = new URL('http://dummy.com');
 	url.protocol = req.protocol;
 	url.hostname = req.hostname;
 	url.port = req.socket.address().port;
 	url.pathname = req.originalUrl.replace(/(\?.*)?$/, '');
 	if (path.startsWith('/')) {
 		url.pathname = path;
 	}
 	else if (path) {
 		url.pathname += `/${path}`;
 	}
 	url.search = '';
 	Object.entries(queryParams).forEach(([k, v]) => {
 		url.searchParams.set(k, v);
 	});
 	url.hash = hash;
 	return url.toString();
 }

 /************************** Template Utilities *************************/


/** Return result of mixing view-model view into template templateId
 *  in app templates.
 */
 function doMustache(app, templateId, view) {
 	const templates = { footer: app.templates.footer };
 	return mustache.render(app.templates[templateId], view, templates);
 }

/** Add contents all dir/*.ms files to app templates with each 
 *  template being keyed by the basename (sans extensions) of
 *  its file basename.
 */
 function setupTemplates(app, dir) {
 	app.templates = {};
 	for (let fname of fs.readdirSync(dir)) {
 		const m = fname.match(/^([\w\-]+)\.ms$/);
 		if (!m) continue;
 		try {
 			app.templates[m[1]] =
 			String(fs.readFileSync(`${TEMPLATES_DIR}/${fname}`));
 		}
 		catch (e) {
 			console.error(`cannot read ${fname}: ${e}`);
 			process.exit(1);
 		}
 	}
 }

 function errorPage(app, errors, res) {
 	if (!Array.isArray(errors)) errors = [ errors ];
 	const html = doMustache(app, 'errors', { errors: errors });
 	res.send(html);
 }

