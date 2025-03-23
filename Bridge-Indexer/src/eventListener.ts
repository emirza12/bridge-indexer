// src/eventListener.ts
import { ethers } from "ethers";
import dotenv from "dotenv";
import TokenBridgeABI from "../TokenBridge.abi";
import { DepositEvent } from "./models/DepositEvent";

dotenv.config();

// Function to create providers based on environment
function createProviders() {
  // Check if RPC URLs are present
  if (!process.env.HOLESKY_RPC_URL || !process.env.TARGET_CHAIN_RPC_URL) {
    throw new Error("RPC URLs are missing in the .env file");
  }

  // Only use HTTP providers to avoid WebSocket authentication issues
  const holeskyProvider = new ethers.JsonRpcProvider(process.env.HOLESKY_RPC_URL);
  const targetProvider = new ethers.JsonRpcProvider(process.env.TARGET_CHAIN_RPC_URL);
  return { holeskyProvider, targetProvider };
}

// Check if contract addresses are present
if (!process.env.HOLESKY_BRIDGE_ADDRESS || !process.env.TARGET_CHAIN_BRIDGE_ADDRESS) {
  throw new Error("Contract addresses are missing in the .env file");
}

// Create providers
const { holeskyProvider, targetProvider } = createProviders();

// Contract addresses on respective chains
const holeskyBridgeContract = new ethers.Contract(
  process.env.HOLESKY_BRIDGE_ADDRESS,
  TokenBridgeABI,
  holeskyProvider
);

const targetBridgeContract = new ethers.Contract(
  process.env.TARGET_CHAIN_BRIDGE_ADDRESS,
  TokenBridgeABI,
  targetProvider
);

// Function to wait for transaction confirmation
async function waitForConfirmation(txHash: string, provider: ethers.Provider) {
    console.log("⏳ Waiting for transaction confirmation:", txHash);
    
    try {
        // Wait for transaction receipt
        const receipt = await provider.waitForTransaction(txHash);
        
        if (receipt) {
            console.log("✅ Transaction confirmed:", txHash);
            return receipt;
        } else {
            throw new Error("Transaction not confirmed");
        }
    } catch (error) {
        console.error("❌ Error while waiting for confirmation:", error);
        throw error;
    }
}

// Function to handle a deposit event
async function handleDepositEvent(
  token: string,
  from: string,
  to: string,
  amount: bigint,
  nonce: bigint,
  chainId: string,
  transactionHash: string
) {
  console.log(`🔍 New deposit event detected on ${chainId}:`, {
    token,
    from,
    to,
    amount: amount.toString(),
    nonce: nonce.toString(),
    transactionHash,
  });

  try {
    // Store the event - composite unique index will prevent duplicates
    await DepositEvent.create({
      token,
      from,
      to,  // Recipient who will receive tokens on the destination chain
      amount: amount.toString(),
      nonce: nonce.toString(),
      chainId,
      transactionHash,
    });
    console.log("✅ Event stored in database.");
  } catch (error: any) {
    // Check if it's a duplication error (unique constraint violation)
    if (error.name === 'SequelizeUniqueConstraintError') {
      console.log("⚠️ Event already processed, skipping.");
    } else {
      console.error("❌ Error storing event:", error);
      throw error; // Propagate error for other types of errors
    }
  }
}

async function startPollingEvents() {
  // Get initial block numbers without duplicating "Starting" message
  let holeskyLastBlock = await holeskyProvider.getBlockNumber();
  let targetLastBlock = await targetProvider.getBlockNumber();

  console.log("Initial blocks - Holesky:", holeskyLastBlock, "Target:", targetLastBlock);

  // Periodically query for deposit events
  setInterval(async () => {
    try {
      // Check if providers are responsive
      try {
        // Try getting the block number to verify the connection is still working
        await holeskyProvider.getBlockNumber();
        await targetProvider.getBlockNumber();
      } catch (connectionError) {
        // Reconnect if there was an error
        console.log("Connection issue detected, reconnecting providers...");
        const { holeskyProvider: newHoleskyProvider, targetProvider: newTargetProvider } = createProviders();
        console.log("Providers reconnected");
      }

      // Get the latest block number
      const holeskyCurrentBlock = await holeskyProvider.getBlockNumber();
      const targetCurrentBlock = await targetProvider.getBlockNumber();

      // If new blocks have been created since the last check
      if (holeskyCurrentBlock > holeskyLastBlock) {
        // Limit the number of blocks to process at once to avoid timeouts
        const blocksToProcess = Math.min(holeskyCurrentBlock - holeskyLastBlock, 100);
        const endBlock = holeskyLastBlock + blocksToProcess;
        
        console.log(`🔍 Checking Holesky blocks ${holeskyLastBlock + 1} to ${endBlock} (current: ${holeskyCurrentBlock})`);
        
        // Get deposit events
        const holeskyFilter = holeskyBridgeContract.filters.Deposit();
        const holeskyLogs = await holeskyBridgeContract.queryFilter(
          holeskyFilter,
          holeskyLastBlock + 1,
          endBlock
        );

        if (holeskyLogs.length > 0) {
          console.log(`Found ${holeskyLogs.length} events in Holesky blocks`);
        }

        // Process events
        for (const log of holeskyLogs) {
          try {
            // Convert Log to EventLog with ethers interface
            const parsedLog = holeskyBridgeContract.interface.parseLog({
              topics: log.topics as string[],
              data: log.data
            });
            
            if (parsedLog && parsedLog.name === 'Deposit' && parsedLog.args) {
              const { token, from, to, amount, nonce } = parsedLog.args;
              
              // Include transaction hash with the event
              const txHash = log.transactionHash || "unknown";
              await handleDepositEvent(token, from, to, amount, nonce, "holesky", txHash);
            }
          } catch (error) {
            console.error("Error parsing Holesky event:", error);
          }
        }

        // Update the last checked block
        holeskyLastBlock = endBlock;
      }

      // Same process for the target chain
      if (targetCurrentBlock > targetLastBlock) {
        // Limit the number of blocks to process at once to avoid timeouts
        const blocksToProcess = Math.min(targetCurrentBlock - targetLastBlock, 100);
        const endBlock = targetLastBlock + blocksToProcess;
        
        console.log(`🔍 Checking Target blocks ${targetLastBlock + 1} to ${endBlock} (current: ${targetCurrentBlock})`);
        
        const targetFilter = targetBridgeContract.filters.Deposit();
        const targetLogs = await targetBridgeContract.queryFilter(
          targetFilter,
          targetLastBlock + 1,
          endBlock
        );

        if (targetLogs.length > 0) {
          console.log(`Found ${targetLogs.length} events in Target blocks`);
        }

        for (const log of targetLogs) {
          try {
            // Convert Log to EventLog with ethers interface
            const parsedLog = targetBridgeContract.interface.parseLog({
              topics: log.topics as string[],
              data: log.data
            });
            
            if (parsedLog && parsedLog.name === 'Deposit' && parsedLog.args) {
              const { token, from, to, amount, nonce } = parsedLog.args;
              
              // Include transaction hash with the event
              const txHash = log.transactionHash || "unknown";
              await handleDepositEvent(token, from, to, amount, nonce, "target_chain", txHash);
            }
          } catch (error) {
            console.error("Error parsing Target Chain event:", error);
          }
        }

        // Update the last checked block
        targetLastBlock = endBlock;
      }
    } catch (error) {
      console.error("❌ Error polling events:", error);
      
      // Wait a bit longer before the next attempt if there was an error
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }, 15000); // Check every 15 seconds
}

// Export functions
export {startPollingEvents };
