const mongoose = require('mongoose');
const User = require('./models/User'); // Adjust the path as needed
require('dotenv').config();

async function updateUserSchema() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const result = await User.updateMany(
      { hasSeenGuide: { $exists: false } },
      { $set: { hasSeenGuide: false } }
    );

    console.log(`Updated ${result.modifiedCount} users`);
  } catch (error) {
    console.error('Error updating user schema:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

updateUserSchema(); 