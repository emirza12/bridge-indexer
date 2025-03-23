import sequelize from "./database";
import { DepositEvent } from "./models/DepositEvent";
import { DistributionEvent } from "./models/DistributionEvent";
import { startPollingEvents } from "./eventListener";
import { startDistributionService } from "./distributionService";

// Maximum number of retry attempts
const MAX_RETRY_ATTEMPTS = 5;
// Delay between retry attempts in milliseconds
const RETRY_DELAY = 10000;  // 10 seconds between retries

// To track if services are already running
let isPollingStarted = false;
let isDistributionStarted = false;

const startApp = async (retryAttempt = 0) => {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log("✅ PostgreSQL database connected");

    // Force: true will recreate tables if necessary
    await sequelize.sync({ force: true });
    console.log("✅ Models synchronized and tables recreated");

    // Start event polling if not already running
    if (!isPollingStarted) {
      console.log("Starting event polling service...");
      isPollingStarted = true;
      startPollingEvents().catch((err) => {
        console.error("❌ Error during event polling:", err);
        isPollingStarted = false;
        // Restart polling on error
        setTimeout(() => startPollingEvents(), RETRY_DELAY);
      });
    }
    
    // Start distribution service if not already running
    if (!isDistributionStarted) {
      console.log("Starting automatic distribution service...");
      isDistributionStarted = true;
      startDistributionService(60000).catch((err) => {
        console.error("❌ Error in distribution service:", err);
        isDistributionStarted = false;
        // Restart service on error
        setTimeout(() => startDistributionService(60000), RETRY_DELAY);
      });
    }
    
    console.log("🚀 Indexer successfully started!");
    
    // Clean shutdown handling
    process.on('SIGINT', async () => {
      console.log('Shutting down indexer...');
      try {
        // Close database connection cleanly
        await sequelize.close();
        console.log('Database connection closed.');
      } catch (err) {
        console.error('Error while closing database connection:', err);
      }
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



