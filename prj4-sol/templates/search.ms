<!DOCTYPE html>
<html>
  <head>
    <title>Documents Collections Search</title>
    <link rel="stylesheet" href="/docs/css/style.css">
  </head>
  <body>
    <h1>Documents Collection Search</h1>
    <ul>
    </ul>
    <form method="GET" action="/docs/search/term">
      <p>
        Please fill in one or more search terms in the field below:
      </p>
      <label>
        <span class="label">Search Terms:</span>
          <input id="query" name="q" value="">
	</label>
	<br/>
      </label>
      <input id="submit" name="submit" type="submit"
             value="search" class="control">
    </form>

{{>footer}}
  </body>
</html>