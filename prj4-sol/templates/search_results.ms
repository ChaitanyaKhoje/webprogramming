<!DOCTYPE html>
<html>
<head>
  <title>Documents Collections Search</title>
  <link rel="stylesheet" href="/docs/css/style.css">
</head>
<body>
  <h1>Documents Collection Search</h1>
  <ul>
    {{#ws}}
      <li class="error">{{.}}</li>
    {{/ws}}  
    {{#not_found}}
      <li class="error">{{.}}</li>
    {{/not_found}}
  </ul>
  <form method="GET" action="/docs/search/term">
    <p>
      Please fill in one or more search terms in the field below:
    </p>
    <label>
      <span class="label">Search Terms:</span>
      <input id="query" name="q" value="{{{s}}}">
    </label>
    <br/>

    {{#null_search}}
      <span class="error">{{.}}</span> <br/>
    {{/null_search}} 
  </label>
  <input id="submit" name="submit" type="submit"
  value="search" class="control">
</form>

{{#sh}}
  <h2>{{{.}}}</h2>
{{/sh}}

{{#sr}}
<p class="result">
  <a class="doc-name" href="{{{href}}}">{{name}}</a><br>
  {{#lines}}
  {{{.}}}
  {{/lines}}
  <br>
  {{#links}}
  {{.}}
  {{/links}}
</p>  
{{/sr}}

{{#p}}
{{{.}}}
{{/p}}

{{#n}}
{{{.}}}
{{/n}}

{{>footer}}
</body>
</html>