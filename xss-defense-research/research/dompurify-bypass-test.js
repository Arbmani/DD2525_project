const { chromium } = require('playwright');

const domPurifyBypassAttempts = [
  // Test DOMPurify with mXSS attacks
  '<math><mtext><table><mglyph><style><!--</style><img title="--&gt;&lt;/mglyph&gt;&lt;img src=1 onerror=alert(1)&gt;">',
  
  // href javascript protocol
  '<a href="javascript:alert(1)">Click me</a>',
  
  // SVG animate (may be blocked depending on DOMPurify version)
  '<svg><animate xlink:href="#xss" attributeName="href" values="javascript:alert(1)" /><a id="xss">click</a>',
  
  // DOM clobbering attack
  '<form><input name="innerHTML" value="XSS"><input name="nodeName"></form>',
  
  // Testing if DOMPurify is configured to allow certain tags
  '<iframe src="javascript:alert(1)"></iframe>',
  
  // Test if script type is being properly filtered
  '<script type="text/javascript">alert(1)</script>',
  
  // Test with custom data attributes
  '<div data-custom="javascript:alert(1)" onclick="eval(this.dataset.custom)">Click me</div>'
];

async function testDOMPurifyBypasses() {
  const browser = await chromium.launch({ headless: false });
  
  console.log('Testing DOMPurify bypass attempts...');
  
  for (const payload of domPurifyBypassAttempts) {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    console.log(`\nTesting payload: ${payload.substring(0, 50)}...`);
    
    // Setup alert detection
    let alertTriggered = false;
    page.on('dialog', async dialog => {
      alertTriggered = true;
      console.log(`  - Alert triggered: ${dialog.message()}`);
      await dialog.dismiss();
    });
    
    try {
      // Navigate to our sanitize endpoint
      await page.goto('http://localhost:3000/');
      
      // Input the payload
      await page.fill('#input-text', payload);
      
      // Submit the form
      await page.click('#sanitize-form button');
      
      // Wait a moment to see the results
      await page.waitForTimeout(1000);
      
      // Get the sanitized output
      const sanitizedOutput = await page.textContent('#sanitized-output');
      
      console.log(`  - Sanitized output: ${sanitizedOutput.substring(0, 100)}...`);
      console.log(`  - Result: ${alertTriggered ? 'BYPASS SUCCESSFUL' : 'PROTECTED'}`);
      
      // Try to execute the sanitized content
      await page.evaluate((sanitized) => {
        const div = document.createElement('div');
        div.innerHTML = sanitized;
        document.body.appendChild(div);
        
        // Try to trigger any potential event handlers
        const elements = div.querySelectorAll('*');
        elements.forEach(el => {
          try {
            el.click();
            if (el.href) location.href = el.href;
          } catch (e) {}
        });
      }, sanitizedOutput);
      
      // Wait a moment to see if anything triggers
      await page.waitForTimeout(1000);
      
    } catch (error) {
      console.error(`  - Error: ${error.message}`);
    } finally {
      await context.close();
    }
  }
  
  await browser.close();
  console.log('\nDOMPurify bypass tests completed!');
}

testDOMPurifyBypasses().catch(console.error);