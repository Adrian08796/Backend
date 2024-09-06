const axios = require('axios');

const API_URL = 'http://localhost:4500/api'; // Adjust this to your server URL
let accessToken, refreshToken;

// Helper function to simulate delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testSessionPersistence() {
  try {
    // Login
    console.log('Logging in...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      username: 'Adrian',
      password: '123abc'
    });
    accessToken = loginResponse.data.accessToken;
    refreshToken = loginResponse.data.refreshToken;
    console.log('Login successful, tokens received');

    // Simulate a long-running session
    for (let i = 0; i < 10000; i++) {
      console.log(`\nIteration ${i + 1}`);

      // Simulate passage of time
      await delay(60000); // Wait for 60 seconds

      try {
        // Try to access a protected route
        const userResponse = await axios.get(`${API_URL}/auth/user`, {
          headers: { 'x-auth-token': accessToken }
        });
        console.log('Protected route accessed successfully');
      } catch (error) {
        if (error.response && error.response.status === 401 && error.response.data.tokenExpired) {
          console.log('Access token expired, refreshing...');
          // Refresh token
          const refreshResponse = await axios.post(`${API_URL}/auth/refresh-token`, {
            refreshToken: refreshToken
          });
          accessToken = refreshResponse.data.accessToken;
          refreshToken = refreshResponse.data.refreshToken;
          console.log('Token refreshed successfully');

          // Try the protected route again with the new token
          const retryResponse = await axios.get(`${API_URL}/auth/user`, {
            headers: { 'x-auth-token': accessToken }
          });
          console.log('Protected route accessed successfully after token refresh');
        } else {
          throw error; // Re-throw if it's not a token expiration issue
        }
      }
    }

    console.log('\nSession persistence test completed successfully');

  } catch (error) {
    console.error('Test failed:', error.response ? error.response.data : error.message);
  }
}

testSessionPersistence();

// This script simulates a long-running session with token refreshes to maintain user authentication.
// It logs in a user, then repeatedly accesses a protected route every 3 seconds for 100 iterations.
// If the access token expires during the session, it automatically refreshes the token and continues.
// This demonstrates how to handle session persistence and token refresh in a client application.
// You can adjust the delay time, number of iterations, and error handling logic as needed.
// node tests/sessionPersistenceTest.js