/**
 * Test setup file - configures MongoDB Memory Server for model tests
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

/**
 * Connect to in-memory MongoDB before tests
 */
before(async function() {
  this.timeout(60000); // Allow 60 seconds for MongoDB Memory Server to start

  try {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to in-memory MongoDB for testing');
  } catch (error) {
    console.error('❌ Failed to setup MongoDB Memory Server:', error);
    throw error;
  }
});

/**
 * Disconnect and cleanup after all tests
 */
after(async function() {
  this.timeout(10000);

  try {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
    console.log('✅ Disconnected from MongoDB and cleaned up');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
});

/**
 * Clear database between test suites
 */
afterEach(async function() {
  try {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  } catch (error) {
    console.error('Error clearing database:', error);
  }
});
