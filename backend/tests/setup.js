/**
 * Test setup file - Global MongoDB Memory Server setup for all tests
 * This file is required by mocha before running tests
 */

// Load test environment variables
const path = require('path');
const fs = require('fs');

const envTestPath = path.join(__dirname, '..', '.env.test');
if (fs.existsSync(envTestPath)) {
  require('dotenv').config({ path: envTestPath });
}

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

/**
 * Initialize MongoDB Memory Server once at startup
 * This runs when the file is loaded, before any tests execute
 */
async function initializeMongoMemoryServer() {
  try {
    console.log('⏳ Initializing MongoDB Memory Server...');
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Set environment variable for tests to use
    process.env.MONGODB_URI = mongoUri;

    // Try to connect if not already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
    }

    console.log('✅ MongoDB Memory Server initialized');
  } catch (error) {
    console.error('❌ Failed to initialize MongoDB Memory Server:', error);
    process.exit(1);
  }
}

/**
 * Cleanup MongoDB Memory Server when tests complete
 */
async function cleanupMongoMemoryServer() {
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }

    if (mongoServer) {
      await mongoServer.stop();
      console.log('✅ MongoDB Memory Server cleaned up');
    }
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// Initialize on load
initializeMongoMemoryServer();

// Cleanup on process exit
process.on('exit', () => {
  cleanupMongoMemoryServer();
});

// Export for use in tests if needed
module.exports = {
  mongoServer,
  initializeMongoMemoryServer,
  cleanupMongoMemoryServer
};
