const React = require('react');


function Tab(props) {
  const {component, isSelected, tabId, label, disabled, selectTab} = props;
  const label1 = displayLabel(label);
  return (
    <section className="tab">
      <input type="radio" name="tab" className="tab-control"
             id={tabId} checked={isSelected}
             onChange={() => selectTab(tabId)}
             disabled={disabled}/>
        <h1 className="tab-title">
          <label data-label0={label} data-label1={label1} htmlFor={tabId}>
            {label1}
          </label>
        </h1>
        <div className="tab-content" id={props.id}>
          {(component) ? component : ""}
        </div>
    </section>
  );
}

module.exports = Tab;

const [ MAX_LABEL_LEN, LABEL_0, LABEL_1, ELLIPSIS ] = [ 10, 5, -3, '..' ];
function displayLabel(label) {
  return (
    label.length < MAX_LABEL_LEN
      ? label
      : label.slice(0, LABEL_0) + ELLIPSIS + label.slice(LABEL_1)
  );
}
