//-*- mode: rjsx-mode;

'use strict';

const React = require('react');

class Content extends React.Component {

  /** called with properties:
   *  app: An instance of the overall app.  Note that props.app.ws
   *       will return an instance of the web services wrapper and
   *       props.app.setContentName(name) will set name of document
   *       in content tab to name and switch to content tab.
   *  name:Name of document to be displayed.
   */
  constructor(props) {
    super(props);
    //@TODO
  }

  //@TODO

  render() {
    //@TODO
    return "";
  }

}

module.exports = Content;
