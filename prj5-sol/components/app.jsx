//-*- mode: rjsx-mode;

'use strict';

const React = require('react');
const ReactDom = require('react-dom');

const Search = require('./search.jsx');
const Content = require('./content.jsx');
const Add = require('./add.jsx');
const Tab = require('./tab.jsx');

/*************************** App Component ***************************/

class App extends React.Component {

  constructor(props) {
    super(props);

    this.ws = props.ws;

    this.components = {
      search: <Search app={this} key="search"/>,
      add: <Add app={this} key="add"/>,
      content: <Content app={this} key="content"/>,
    };

    this.selectTab = this.selectTab.bind(this);

    this.state = {
      selected: 'search',
      contentName: '',
    };

  }


  componentDidCatch(error, info) {
    console.error(error, info);
  }

  /** Set contentName and select content tab */
  setContentName(contentName) {
    this.setState({contentName, selected: 'content'});
  }

  selectTab(v) {
    this.setState({selected: v});
  }

  render() {
    const tabs = ['search', 'add', 'content'].map((k, i) => {
      let component = this.components[k];
      let label = k[0].toUpperCase() + k.substr(1);
      let disabled = false;
      if (k === 'content') {
        const contentName = this.state.contentName.trim();
        if (contentName) {
          label = this.state.contentName;
          component = <Content app={this} name={contentName}/>
        }
        else {
          disabled = true;
        }
      }
      const isSelected = (this.state.selected === k);
      const tab = (
        <Tab component={component} key={k} tabId={k}
             label={label} index={i} disabled={disabled}
             selectTab={this.selectTab} isSelected={isSelected}/>
      );
      return tab;
    });

    return <div className="tabs">{tabs}</div>
  }

}

module.exports = App;
