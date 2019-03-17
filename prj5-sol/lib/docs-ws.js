'use strict';

const axios = require('axios');

class DocsWs {

  constructor() {
    this.baseUrl = getWsUrl();
    this.docsUrl = `${this.baseUrl}/docs`;
  }


  async searchDocs(searchTerms, start) {
    try {
      const url = this.docsUrl;
      const params = { q: searchTerms };
      if (start) params.start = start;
      const response = await axios.get(url, { params });
      return response.data;
    }
    catch (err) {
      console.error(err);
      throw (err.response && err.response.data) ? err.response.data : err;
    }
  }

  async getContent(name) {
    try {
      const response = await axios.get(`${this.docsUrl}/${name}`);
      return response.data;
    }
    catch (err) {
      console.error(err);
      throw (err.response && err.response.data) ? err.response.data : err;
    }  
  }

  async addContent(name, content) {
    try {
      const response = await axios.post(`${this.docsUrl}`, { name, content });
      return response.data;
    }
    catch (err) {
      console.error(err);
      throw (err.response && err.response.data) ? err.response.data : err;
    }
  }

  async completions(text) {
    try {
      const params = { text };
      const response =
	await axios.get(`${this.baseUrl}/completions`, { params });
      return response.data;
    }
    catch (err) {
      console.error(err);
      throw (err.response && err.response.data) ? err.response.data : err;
    }  
  }
  
}

module.exports = DocsWs;

const DEFAULT_WS_URL = 'http://zdu.binghamton.edu:1235';

function getWsUrl() {
  const params = (new URL(document.location)).searchParams;
  return params.get('ws-url') || DEFAULT_WS_URL;
}
