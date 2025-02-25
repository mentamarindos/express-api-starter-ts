import app from './app';
import { config } from './config';
import { initializeDatabase } from './db/schema';

const startServer = async () => {
  try {
    await initializeDatabase();
    
    app.listen(config.port, () => {
      console.log(`🚀 Server is running at http://localhost:${config.port}`);
      console.log(`👻 Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
  process.exit(1);
});

startServer();
