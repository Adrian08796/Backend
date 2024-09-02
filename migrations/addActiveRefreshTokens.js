// migrations/addActiveRefreshTokens.js

const mongoose = require('mongoose');
const User = require('../models/User'); // Adjust the path as needed
require('dotenv').config(); // Make sure this path is correct

async function migrateUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    const result = await User.updateMany(
      { activeRefreshTokens: { $exists: false } },
      { $set: { activeRefreshTokens: [] } }
    );

    console.log(`Migration complete. ${result.modifiedCount} users updated.`);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

migrateUsers();