// middleware/auth.js

const jwt = require('jsonwebtoken');
const CustomError = require('../utils/customError');
const User = require('../models/User');
const TokenBlacklist = require('../models/TokenBlacklist');

module.exports = async function(req, res, next) {
  const token = req.header('x-auth-token');
  console.log('Received token:', token);

  if (!token) {
    return next(new CustomError('No token, authorization denied', 401));
  }

  try {
    // Check if the token is blacklisted
    const blacklistedToken = await TokenBlacklist.findOne({ token });
    if (blacklistedToken) {
      return next(new CustomError('Token is blacklisted', 401));
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    console.log('Decoded token:', decoded);
    
    const user = await User.findById(decoded.id);
    if (!user) {
      console.log('User not found for id:', decoded.id);
      return next(new CustomError('User not found', 404));
    }

    req.user = {
      id: decoded.id,
      username: user.username
    };
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired', tokenExpired: true });
    }
    next(new CustomError('Token is not valid', 401));
  }
};