import sequelize from "./database";
import { DepositEvent } from "./models/DepositEvent";
import { DistributionEvent } from "./models/DistributionEvent";
import { startPollingEvents } from "./eventListener";
import { startDistributionService } from "./distributionService";

// Maximum number of retry attempts
const MAX_RETRY_ATTEMPTS = 5;
// Delay between retry attempts in milliseconds
const RETRY_DELAY = 10000;

const startApp = async (retryAttempt = 0) => {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log("✅ PostgreSQL database connected");

    // Force: true will recreate tables if necessary
    await sequelize.sync({ force: true });
    console.log("✅ Models synchronized and tables recreated");

    // Use only event polling method (more robust for HTTP connections)
    console.log("Starting event polling...");
    startPollingEvents().catch((err) => {
      console.error("❌ Error during event polling:", err);
      // Restart polling on error
      setTimeout(() => startPollingEvents(), RETRY_DELAY);
    });
    
    // Start distribution service to automatically process deposits
    console.log("Starting automatic distribution service...");
    startDistributionService(60000).catch((err) => {
      console.error("❌ Error in distribution service:", err);
      // Restart service on error
      setTimeout(() => startDistributionService(60000), RETRY_DELAY);
    });
    
    console.log("🚀 Indexer successfully started!");
    
    // Clean shutdown handling
    process.on('SIGINT', async () => {
      console.log('Shutting down indexer...');
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Error starting the application:", error);
    
    if (retryAttempt < MAX_RETRY_ATTEMPTS) {
      const nextRetryAttempt = retryAttempt + 1;
      console.log(`Retry attempt ${nextRetryAttempt}/${MAX_RETRY_ATTEMPTS} in ${RETRY_DELAY/1000} seconds...`);
      
      // Wait before retrying
      setTimeout(() => startApp(nextRetryAttempt), RETRY_DELAY);
    } else {
      console.error("Maximum retry attempts reached. Exiting.");
      process.exit(1);
    }
  }
};

// Start the application
startApp();



