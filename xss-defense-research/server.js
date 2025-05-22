const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');

const app = express();
const port = 3000;

// Create DOMPurify instance
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const fs = require('fs');

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/static', express.static('public'));

// Create routes for testing
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint to test DOMPurify
app.post('/sanitize', (req, res) => {
  const { input } = req.body;
  const sanitized = DOMPurify.sanitize(input);
  res.json({ original: input, sanitized });
});

// Endpoint with a reflected XSS vulnerability for testing
app.get('/reflect', (req, res) => {
  const userInput = req.query.input || '';
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>XSS Test</title>
    </head>
    <body>
      <h1>XSS Test Page</h1>
      <div>User input: ${userInput}</div>
    </body>
    </html>
  `);
});

// Endpoint with DOMPurify protection
app.get('/safe-reflect', (req, res) => {
  const userInput = req.query.input || '';
  const sanitized = DOMPurify.sanitize(userInput);
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Safe XSS Test</title>
    </head>
    <body>
      <h1>Safe XSS Test Page</h1>
      <div>Sanitized input: ${sanitized}</div>
    </body>
    </html>
  `);
});

// CSP test endpoint (FIXED IMPLEMENTATION)
app.get('/csp-test', (req, res) => {
  // Generate a fresh nonce for this request
  const nonce = crypto.randomBytes(16).toString('base64');
  
  // Read the file
  let html = fs.readFileSync(path.join(__dirname, 'public', 'csp-test.html'), 'utf8');
  
  // Replace ALL instances of the nonce placeholder
  html = html.replace(/NONCE_PLACEHOLDER/g, nonce);
  
  // Build CSP as an array for readability, then join without newlines
  const cspDirectives = [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' https://cdnjs.cloudflare.com/ajax/libs/ 'strict-dynamic'`,
    `style-src 'nonce-${nonce}'`,
    "img-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "connect-src 'self'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
    "require-trusted-types-for 'script'",
    "trusted-types dompurify test-policy",
    "report-uri http://localhost:8888/collect-violations"
  ];
  
  // Join with semicolons and spaces (no newlines)
  const cspHeader = cspDirectives.join('; ');
  
  res.setHeader('Content-Security-Policy', cspHeader);
  res.send(html);
});

// Endpoint to handle CSP violation reports
app.post('/csp-report', express.json({ type: 'application/csp-report' }), (req, res) => {
  console.log('CSP Violation:', req.body);
  res.status(204).end();
});

app.listen(port, () => {
  console.log(`XSS test server running at http://localhost:${port}`);
});