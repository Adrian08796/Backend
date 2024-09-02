// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const CustomError = require('../utils/customError');
const auth = require('../middleware/auth');
const { generateAccessToken, generateRefreshToken } = require('../utils/tokenUtils');

// Registration
router.post('/register', async (req, res, next) => {
  try {
    console.log('Received registration request:', req.body);
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      console.log('User already exists:', existingUser.username);
      return next(new CustomError('User already exists', 400));
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      username,
      email,
      password: hashedPassword
    });

    await user.save();
    console.log('User created successfully:', user.username);

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Error registering user:', error);
    next(new CustomError('Error registering user', 500));
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    console.log('Received login request:', req.body);
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      console.log('Invalid credentials: User not found');
      return next(new CustomError('Invalid credentials', 400));
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Invalid credentials: Password does not match');
      return next(new CustomError('Invalid credentials', 400));
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.json({ 
      accessToken, 
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    next(new CustomError('Error logging in', 500));
  }
});

router.post('/refresh-token', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    console.log('Received refresh token:', refreshToken);

    if (!refreshToken) {
      console.log('No refresh token provided');
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      console.log('Decoded refresh token:', decoded);
    } catch (error) {
      console.error('Error verifying refresh token:', error);
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const user = await User.findById(decoded.id);
    console.log('User found:', user ? user._id : 'Not found');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if the token is in the blacklist
    const tokenIndex = user.blacklistedTokens.indexOf(refreshToken);
    if (tokenIndex !== -1) {
      // If the token is blacklisted, check if it's recent (within the last 5 minutes)
      const blacklistedTime = new Date(user.blacklistedTokens[tokenIndex + 1]); // Assuming you store the blacklist time
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (blacklistedTime > fiveMinutesAgo) {
        console.log('Recent blacklisted token, allowing reuse');
        // Remove the token from the blacklist
        user.blacklistedTokens.splice(tokenIndex, 2);
      } else {
        console.log('Refresh token is blacklisted');
        return res.status(401).json({ message: 'Invalid refresh token' });
      }
    }

    const accessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    // Add the old refresh token to the blacklist with the current timestamp
    user.blacklistedTokens.push(refreshToken, new Date());
    if (user.blacklistedTokens.length > 10) { // Keep last 5 blacklisted tokens (2 entries per token)
      user.blacklistedTokens.shift();
      user.blacklistedTokens.shift();
    }
    await user.save();

    console.log('New tokens generated successfully');
    res.json({ 
      accessToken, 
      refreshToken: newRefreshToken,
      expiresIn: 900 // 15 minutes in seconds
    });
  } catch (error) {
    console.error('Error in refresh token route:', error);
    next(error);
  }
});

router.post('/logout', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user);
    if (!user) {
      return next(new CustomError('User not found', 404));
    }

    const accessToken = req.header('x-auth-token');
    user.blacklistedTokens.push(accessToken);
    
    // Also blacklist the refresh token if it's provided
    const refreshToken = req.body.refreshToken;
    if (refreshToken) {
      user.blacklistedTokens.push(refreshToken);
    }

    await user.save();

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error logging out:', error);
    next(new CustomError('Error logging out', 500));
  }
});

// Get current user
router.get('/user', auth, async (req, res, next) => {
  try {
    console.log('Fetching user data for user ID:', req.user);
    const user = await User.findById(req.user).select('-password');
    if (!user) {
      console.log('User not found for ID:', req.user);
      return next(new CustomError('User not found', 404));
    }
    console.log('User data fetched successfully:', user.username);
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    next(new CustomError('Error fetching user', 500));
  }
});

// Logout
router.post('/logout', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user);
    if (!user) {
      return next(new CustomError('User not found', 404));
    }

    // Optionally, you can blacklist the current refresh token here
    // This depends on how you're sending the refresh token in the request
    const refreshToken = req.body.refreshToken;
    if (refreshToken) {
      user.blacklistedTokens.push(refreshToken);
      await user.save();
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error logging out:', error);
    next(new CustomError('Error logging out', 500));
  }
});

module.exports = router;