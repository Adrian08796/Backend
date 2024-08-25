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

// Refresh Token
router.post('/refresh-token', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return next(new CustomError('Refresh token is required', 400));
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new CustomError('User not found', 404));
    }

    const accessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    console.error('Error refreshing token:', error);
    if (error.name === 'JsonWebTokenError') {
      return next(new CustomError('Invalid refresh token', 401));
    }
    next(new CustomError('Error refreshing token', 500));
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

// Refresh Token
router.post('/refresh-token', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return next(new CustomError('Refresh token is required', 400));
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new CustomError('User not found', 404));
    }

    const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const newRefreshToken = jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    console.error('Error refreshing token:', error);
    next(new CustomError('Error refreshing token', 500));
  }
});

module.exports = router;