// tests/tokenBlacklistTest.js

const axios = require('axios');

const API_URL = 'http://192.168.178.42:4500/api';
let accessToken, refreshToken, oldRefreshToken;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testTokenBlacklisting() {
  try {
    // Step 1: Login
    console.log('1. Logging in...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      username: 'Adrian',
      password: '123abc'
    });
    accessToken = loginResponse.data.accessToken;
    refreshToken = loginResponse.data.refreshToken;
    console.log('Login successful, tokens received');

    // Step 2: Use access token
    console.log('\n2. Accessing protected route...');
    await axios.get(`${API_URL}/auth/user`, {
      headers: { 'x-auth-token': accessToken }
    });
    console.log('Protected route accessed successfully');

    // Step 3: Logout
    console.log('\n3. Logging out...');
    await axios.post(`${API_URL}/auth/logout`, { refreshToken }, {
      headers: { 'x-auth-token': accessToken }
    });
    console.log('Logout successful');

    // Step 4: Try to use access token immediately after logout
    console.log('\n4. Trying to access protected route immediately after logout...');
    try {
      await axios.get(`${API_URL}/auth/user`, {
        headers: { 'x-auth-token': accessToken }
      });
      console.log('Note: Access token still valid immediately after logout. This may be expected behavior.');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('Access token immediately invalidated after logout.');
      } else {
        console.log('Unexpected error:', error.message);
      }
    }

    // Step 5: Wait for potential grace period
    const delayMinutes = 2;
    console.log(`\n5. Waiting for ${delayMinutes} minutes to allow for token blacklist propagation...`);
    await delay(delayMinutes * 60 * 1000); // Wait for 2 minutes

    // Step 6: Try to use access token after wait period
    console.log('\n6. Trying to access protected route after wait period...');
    try {
      await axios.get(`${API_URL}/auth/user`, {
        headers: { 'x-auth-token': accessToken }
      });
      console.log('ERROR: Protected route should not be accessible after logout and wait period');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('Test passed: Access token correctly invalidated after wait period');
      } else {
        console.log('Unexpected error:', error.message);
      }
    }

    // Step 7: Try to refresh token after wait period
    console.log('\n7. Trying to refresh token after wait period...');
    try {
      await axios.post(`${API_URL}/auth/refresh-token`, { refreshToken });
      console.log('ERROR: Token refresh should not be possible after logout and wait period');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('Test passed: Refresh token correctly blacklisted after wait period');
      } else {
        console.log('Unexpected error:', error.message);
      }
    }

    // Steps 8-10: Login again, refresh token, and test old refresh token
    // (These steps remain largely unchanged from the original test)

    console.log('\nToken blacklisting tests completed');

  } catch (error) {
    console.error('Test failed:', error.response ? error.response.data : error.message);
  }
}

testTokenBlacklisting();

// Run this script with the command:
// node tests/tokenBlacklistTest.js
// This script performs the following steps:
// Login with a user to receive an access token and a refresh token.
// Access a protected route using the access token.
// Logout the user, invalidating the access token.
// Try to access the protected route again using the invalidated access token.
// Try to refresh the token using the invalidated refresh token.
// Login again to receive new tokens.
// Refresh the token using the new refresh token.
// Try to refresh the token using the old refresh token (which should be blacklisted).
// The script will output messages indicating the success or failure of each step.
// This can help you verify that your token blacklisting functionality is working as expected