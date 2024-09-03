// middleware/auth.js

const jwt = require('jsonwebtoken');
const CustomError = require('../utils/customError');
const User = require('../models/User');
const TokenBlacklist = require('../models/TokenBlacklist');

module.exports = async function(req, res, next) {
  const token = req.header('x-auth-token');
  if (!token) {
    return next(new CustomError('No token, authorization denied', 401));
  }

  try {
    // Check if the token is blacklisted
    const blacklistedToken = await TokenBlacklist.findOne({ token });
    if (blacklistedToken) {
      return next(new CustomError('Token is no longer valid', 401));
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new CustomError('User not found', 404));
    }

    req.user.id = {
      id: decoded.id,
      username: user.username
    };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired', tokenExpired: true });
    }
    next(new CustomError('Token is not valid', 401));
  }
};