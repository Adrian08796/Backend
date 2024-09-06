// tests/tokenBlacklistTest.js

const axios = require('axios');

// const API_URL = 'https://walrus-app-lqhsg.ondigitalocean.app/backend';
const API_URL = 'http://192.168.178.42:4500/api';
let accessToken, refreshToken, oldRefreshToken;

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

    // Step 4: Try to use access token after logout
    console.log('\n4. Trying to access protected route after logout...');
    try {
      await axios.get(`${API_URL}/auth/user`, {
        headers: { 'x-auth-token': accessToken }
      });
      console.log('ERROR: Protected route should not be accessible after logout');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('Test passed: Access token correctly invalidated after logout');
      } else {
        throw error;
      }
    }

    // Step 5: Try to refresh token after logout
    console.log('\n5. Trying to refresh token after logout...');
    try {
      await axios.post(`${API_URL}/auth/refresh-token`, { refreshToken });
      console.log('ERROR: Token refresh should not be possible after logout');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('Test passed: Refresh token correctly blacklisted after logout');
      } else {
        throw error;
      }
    }

    // Step 6: Login again
    console.log('\n6. Logging in again...');
    const newLoginResponse = await axios.post(`${API_URL}/auth/login`, {
      username: 'Adrian',
      password: '123abc'
    });
    accessToken = newLoginResponse.data.accessToken;
    refreshToken = newLoginResponse.data.refreshToken;
    console.log('New login successful, new tokens received');
    console.log('New refresh token:', refreshToken);

    // Step 7: Refresh token
    console.log('\n7. Refreshing token...');
    try {
      oldRefreshToken = refreshToken;
      const refreshResponse = await axios.post(`${API_URL}/auth/refresh-token`, { refreshToken });
      console.log('Refresh response:', refreshResponse.data);
      refreshToken = refreshResponse.data.refreshToken;
      accessToken = refreshResponse.data.accessToken;
      console.log('Token refreshed successfully');
      console.log('New refresh token:', refreshToken);
      console.log('Old refresh token:', oldRefreshToken);

      // Add a small delay to ensure the server has time to process the token refresh
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error('Error refreshing token:', error.response ? error.response.data : error.message);
      throw error;
    }

    // Step 8: Try to use old refresh token
    console.log('\n8. Trying to use old refresh token...');
    try {
      const oldRefreshResponse = await axios.post(`${API_URL}/auth/refresh-token`, { refreshToken: oldRefreshToken });
      console.log('ERROR: Old refresh token should not be usable');
      console.log('Unexpected response:', oldRefreshResponse.data);
      throw new Error('Old refresh token was accepted when it should have been rejected');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('Test passed: Old refresh token correctly rejected');
      } else {
        console.error('Unexpected error when using old refresh token:', error.response ? error.response.data : error.message);
        throw error;
      }
    }

    console.log('\nAll token blacklisting tests completed successfully');

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