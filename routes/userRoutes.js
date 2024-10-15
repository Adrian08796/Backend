// routes/userRoutes.js

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');

router.put('/experience-level', auth, userController.updateExperienceLevel);

module.exports = router;