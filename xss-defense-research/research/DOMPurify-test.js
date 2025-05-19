const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

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
  
  // DOM Clobbering attacks
  '<form id="test"><input id="nodeType"><input name="firstChild"><input name="nodeName"></form>',
  
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
];

// Test endpoints
const endpoints = [
  { url: 'http://localhost:3000/reflect?input=PAYLOAD', name: 'Reflection Endpoint' },
  { url: 'http://localhost:3000/safe-reflect?input=PAYLOAD', name: 'DOMPurify Protected Endpoint' }
];

async function runTests() {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-xss-auditor', '--no-sandbox'] // Disable built-in protections for testing
  });
  
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
        // Add detection helper
        await page.addInitScript(() => {
          window._xssDetected = false;
          
          // Hook document.write
          const originalDocWrite = document.write;
          document.write = function() {
            window._xssDetected = true;
            return originalDocWrite.apply(this, arguments);
          };
        });
        
        await page.goto(testUrl);
        
        // Wait initial load time
        await page.waitForTimeout(500);
        
        // Perform interactions based on payload type
        
        // Test hover-based XSS
        if (payload.includes('onmouseover') || payload.includes('onhover')) {
          const hoverElements = await page.$$('[onmouseover], [onhover]');
          for (const element of hoverElements) {
            await element.hover();
            await page.waitForTimeout(300);
          }
        }
        
        // Test click-based XSS
        if (payload.includes('javascript:') && payload.includes('Click me')) {
          const clickableElements = await page.$$('a[href^="javascript"], a[href*="colon"]');
          for (const element of clickableElements) {
            await element.click({ force: true }).catch(e => {});
            await page.waitForTimeout(300);
          }
        }
        
        // Give time for any delayed XSS to execute
        await page.waitForTimeout(500);
        
        // Check for DOM manipulation
        const domCheck = await page.evaluate(() => {
          return {
            xssDetected: window._xssDetected === true,
            injectedScript: document.querySelectorAll('script:not([src])').length > 0,
            hasEventHandlers: document.querySelectorAll('[onerror], [onload], [onclick], [onmouseover]').length > 0
          };
        });
        
        // Determine if vulnerable
        const isVulnerable = alertTriggered || domCheck.xssDetected;
        
        results.push({
          endpoint: endpoint.name,
          payload,
          success: isVulnerable,
          notes: isVulnerable ? 'XSS successful' : 'No XSS detected'
        });
        
        console.log(`  - Result: ${isVulnerable ? 'VULNERABLE' : 'PROTECTED'}`);
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
  
  console.log('\nTests completed! Results saved to test-results.json');
  await browser.close();
}

runTests().catch(console.error);