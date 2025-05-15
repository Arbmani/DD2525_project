const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const advancedPayloads = require('./advanced-payloads');

// Array of test payloads
const payloads = [
  // Basic XSS
  '<script>alert("XSS")</script>',
  '<img src="x" onerror="alert(\'XSS\')">',
  '<div onmouseover="alert(\'XSS\')">Hover me</div>',
  
  // CSP bypass attempts
  '<script nonce="STOLEN-NONCE">alert("XSS with stolen nonce")</script>',
  '<script src="data:text/javascript,alert(\'XSS\')"></script>',
  
  // DOM-based XSS
  '"><script>alert(document.domain)</script>',
  '<img src=x onerror=eval(atob(\'YWxlcnQoImhpIik7\'))>',
  
  // DOMPurify bypass attempts
  '<math><mtext><table><mglyph><style><!--</style><img title="--&gt;&lt;/mglyph&gt;&lt;img src=1 onerror=alert(1)&gt;">',
  '<a href="javascript:alert(1)">Click me</a>',
  
   // Add advanced payloads
  ...advancedPayloads
  // Add more payloads as you discover them

];

// Test endpoints
const endpoints = [
  { url: 'http://localhost:3000/reflect?input=PAYLOAD', name: 'Reflection Endpoint' },
  { url: 'http://localhost:3000/safe-reflect?input=PAYLOAD', name: 'DOMPurify Protected Endpoint' },
  // Add more endpoints as you create them
];

async function runTests() {
  const browser = await chromium.launch({ headless: false });
  const results = [];
  
  console.log('Starting XSS payload tests...');
  
  for (const endpoint of endpoints) {
    console.log(`\nTesting ${endpoint.name}:`);
    
    for (const payload of payloads) {
      const testUrl = endpoint.url.replace('PAYLOAD', encodeURIComponent(payload));
      console.log(`Testing payload: ${payload.substring(0, 50)}${payload.length > 50 ? '...' : ''}`);
      
      const context = await browser.newContext();
      const page = await context.newPage();
      
      // Setup alert detection
      let alertTriggered = false;
      page.on('dialog', async dialog => {
        alertTriggered = true;
        console.log(`  - Alert triggered: ${dialog.message()}`);
        await dialog.dismiss();
      });
      
      try {
        await page.goto(testUrl);
        // Give time for any delayed XSS to execute
        await page.waitForTimeout(1000);
        
        results.push({
          endpoint: endpoint.name,
          payload,
          success: alertTriggered,
          notes: alertTriggered ? 'XSS successful' : 'No XSS detected'
        });
        
        console.log(`  - Result: ${alertTriggered ? 'VULNERABLE' : 'PROTECTED'}`);
      } catch (error) {
        console.error(`  - Error testing ${testUrl}: ${error.message}`);
        results.push({
          endpoint: endpoint.name,
          payload,
          success: false,
          notes: `Error: ${error.message}`
        });
      } finally {
        await context.close();
      }
    }
  }
  
  // Save results to file
  fs.writeFileSync(
    path.join(__dirname, 'test-results.json'), 
    JSON.stringify(results, null, 2)
  );
  
  console.log('\nTests completed! Results saved to research/test-results.json');
  await browser.close();
}

runTests().catch(console.error);