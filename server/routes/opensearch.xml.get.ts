export default defineEventHandler(event => {
  const url = getRequestURL(event)
  const origin = url.origin

  setHeader(event, 'Content-Type', 'application/opensearchdescription+xml')

  return `
<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>npm</ShortName>
  <Description>Search npm packages on npmx.dev</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image width="16" height="16" type="image/svg+xml">${origin}/favicon.svg</Image>
  <Url type="text/html" template="${origin}/search?q={searchTerms}"/>
  <Url type="application/x-suggestions+json" template="${origin}/api/opensearch/suggestions?q={searchTerms}"/>
  <Url type="application/opensearchdescription+xml" rel="self" template="${origin}/opensearch.xml"/>
</OpenSearchDescription>
  `.trim()
})
