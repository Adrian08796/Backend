const axios = require('axios');

const API_URL = 'http://localhost:4500/api'; // Adjust this to your server URL
let accessToken, refreshToken; 

async function testAuth() {
  try {
    // Login
    console.log('Testing login...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      username: 'Adrian',
      password: '123abc'
    });
    accessToken = loginResponse.data.accessToken;
    refreshToken = loginResponse.data.refreshToken;
    console.log('Login successful, tokens received');

    // Access protected route
    console.log('\nTesting protected route access...');
    const userResponse = await axios.get(`${API_URL}/auth/user`, {
      headers: { 'x-auth-token': accessToken }
    });
    console.log('Protected route accessed successfully');

    // Refresh token
    console.log('\nTesting token refresh...');
    const refreshResponse = await axios.post(`${API_URL}/auth/refresh-token`, {
      refreshToken: refreshToken
    });
    const newAccessToken = refreshResponse.data.accessToken;
    const newRefreshToken = refreshResponse.data.refreshToken;
    console.log('Token refreshed successfully');

    // Test blacklisted token
    console.log('\nTesting blacklisted token...');
    try {
      await axios.post(`${API_URL}/auth/refresh-token`, {
        refreshToken: refreshToken // Using old refresh token
      });
    } catch (error) {
      console.log('Blacklisted token rejected successfully');
    }

    // Logout
    console.log('\nTesting logout...');
    await axios.post(`${API_URL}/auth/logout`, {
      refreshToken: newRefreshToken
    }, {
      headers: { 'x-auth-token': newAccessToken }
    });
    console.log('Logout successful');

    // Try to use logged out token
    console.log('\nTesting logged out token...');
    try {
      await axios.get(`${API_URL}/auth/user`, {
        headers: { 'x-auth-token': newAccessToken }
      });
    } catch (error) {
      console.log('Logged out token rejected successfully');
    }

  } catch (error) {
    console.error('Test failed:', error.response ? error.response.data : error.message);
  }
}

testAuth();

// Run this script using Node.js to test the authentication routes of your server. Make sure to adjust the API_URL variable to match your server's URL. This script will perform the following actions:
// 1. Login with a valid username and password.
// 2. Access a protected route using the received access token.
// 3. Refresh the access token using the refresh token.
// 4. Attempt to use the old refresh token (which should be blacklisted).
// 5. Logout using the new access and refresh tokens.
// 6. Attempt to access a protected route using the logged out access token.
// The script will output the results of each step, indicating success or failure. This can help you verify that your authentication endpoints are functioning correctly.
// node tests/authTest.js