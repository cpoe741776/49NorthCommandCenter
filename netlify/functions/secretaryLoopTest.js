exports.handler = async (event) => {
  console.log("TEST_FUNCTION_START", new Date().toISOString());
  
  try {
    console.log("Step 1: Basic function works");
    
    // Test requiring googleapis
    console.log("Step 2: Trying to require googleapis...");
    const googleapis = require("googleapis");
    console.log("Step 3: googleapis loaded successfully");
    
    // Test requiring your utils
    console.log("Step 4: Trying to require secrets...");
    const secrets = require("./_utils/secrets");
    console.log("Step 5: secrets loaded successfully");
    
    console.log("Step 6: Trying to require google auth...");
    const googleUtils = require("./_utils/google");
    console.log("Step 7: google auth loaded successfully");
    
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, message: "All modules loaded successfully" })
    };
  } catch (err) {
    console.error("TEST_FUNCTION_ERROR", err.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message, stack: err.stack })
    };
  }
};
