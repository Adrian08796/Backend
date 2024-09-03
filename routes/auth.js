const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const CustomError = require('../utils/customError');
const auth = require('../middleware/auth');
const { generateAccessToken, generateRefreshToken } = require('../utils/tokenUtils');
const TokenBlacklist = require('../models/TokenBlacklist');

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

// Login route
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

    // Clear all existing refresh tokens and add the new one
    user.activeRefreshTokens = [];
    user.addRefreshToken(refreshToken);
    await user.save();

    console.log('Login successful. Active refresh tokens:', user.activeRefreshTokens);

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
    next(error);
  }
});


// Refresh token
router.post('/refresh-token', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    console.log('Received refresh token:', refreshToken);

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if the token is in the active list
    const tokenIndex = user.activeRefreshTokens.indexOf(refreshToken);
    if (tokenIndex === -1) {
      console.log('Refresh token not found in active tokens');
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    // Remove the used refresh token
    user.activeRefreshTokens.splice(tokenIndex, 1);

    // Generate new tokens
    const accessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    // Add the new refresh token
    user.addRefreshToken(newRefreshToken);

    await user.save();

    console.log('New refresh token generated:', newRefreshToken);
    console.log('Active refresh tokens:', user.activeRefreshTokens);

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


// Logout route
router.post('/logout', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new CustomError('User not found', 404));
    }

    const refreshToken = req.body.refreshToken;
    if (refreshToken) {
      user.removeRefreshToken(refreshToken);
    }

    // Blacklist the current access token
    const accessToken = req.header('x-auth-token');
    await TokenBlacklist.create({ token: accessToken });

    await user.save();

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(new CustomError('Error logging out', 500));
  }
});

// Get current user
router.get('/user', auth, async (req, res, next) => {
  try {
    console.log('Fetching user data for user ID:', req.user.id);
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      console.log('User not found for ID:', req.user.id);
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
    const user = await User.findById(req.user.id);
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