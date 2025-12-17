/**
 * MongoDB Connection Utility
 * 
 * This module handles the connection to MongoDB using Mongoose.
 * It implements connection pooling and reconnection logic for production reliability.
 */

import mongoose from 'mongoose';

// Connection state tracking
let isConnected = false;

/**
 * Establishes connection to MongoDB
 * Uses connection pooling and caches the connection to avoid multiple connections
 * 
 * @returns {Promise<mongoose.Connection>} MongoDB connection instance
 */
export async function connectToDatabase() {
  // Return existing connection if already connected
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // Check if MongoDB URI is configured
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  try {
    // Connect to MongoDB
    const db = await mongoose.connect(process.env.MONGODB_URI, {
      // Connection options for production reliability
      maxPoolSize: 10, // Maximum number of connections in the pool
      minPoolSize: 2, // Keep minimum connections alive
      serverSelectionTimeoutMS: 5000, // Timeout for server selection
      socketTimeoutMS: 45000, // Timeout for socket operations
      maxIdleTimeMS: 30000, // Close idle connections after 30s
      retryWrites: true,
      retryReads: true,
    });

    isConnected = db.connections[0].readyState === 1;

    // Event listeners for connection monitoring
    mongoose.connection.on('connected', () => {
      console.log('✅ MongoDB connected successfully');
      isConnected = true;
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
      isConnected = false;
    });

    return mongoose.connection;
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    throw error;
  }
}

/**
 * Closes the MongoDB connection
 * Useful for cleanup in testing or graceful shutdown
 */
export async function closeDatabaseConnection() {
  if (isConnected) {
    await mongoose.connection.close();
    isConnected = false;
    console.log('MongoDB connection closed');
  }
}

