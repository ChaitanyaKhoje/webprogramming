'use strict';

const axios = require('axios');


function DocsWs(baseUrl) {
  this.docsUrl = `${baseUrl}/docs`;
}

module.exports = DocsWs;

//@TODO add wrappers to call remote web services.
  
DocsWs.prototype.get = async function(id) {
  try {
    const response = await axios.get(`${this.docsUrl}/${id}`);
    return response.data;
  }
  catch (err) {
    console.error(err);
    throw (err.response && err.response.data) ? err.response.data : err;
  }  
};

DocsWs.prototype.addContent = async function(document, content) {
  try {
    const response = await axios.post(this.docsUrl, {"name": document, "content": content});
    return response.data;
  }
  catch (err) {
    console.error(err);
    throw (err.response && err.response.data) ? err.response.data : err;
  }
};

DocsWs.prototype.find = async function(q, start) {
  try {
    const url = this.docsUrl + ((q === undefined) ? '' : `?q=${q}&start=${start}`);
    const response = await axios.get(url);
    return response.data;
  }
  catch (err) {
    console.error(err);
    throw (err.response && err.response.data) ? err.response.data : err;
  }
};
