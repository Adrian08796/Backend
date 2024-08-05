// middleware/auth.js

const jwt = require('jsonwebtoken');
const CustomError = require('../utils/customError');

module.exports = function(req, res, next) {
  const token = req.header('x-auth-token');
  if (!token) {
    return next(new CustomError('No token, authorization denied', 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.id;
    next();
  } catch (error) {
    next(new CustomError('Token is not valid', 401));
  }
};