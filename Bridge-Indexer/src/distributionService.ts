import { ethers } from "ethers";
import dotenv from "dotenv";
import TokenBridgeABI from "../TokenBridge.abi";
import { DepositEvent } from "./models/DepositEvent";
import { DistributionEvent } from "./models/DistributionEvent";
import { Op } from "sequelize";

dotenv.config();

// Function to create providers based on environment
function createProviders() {
  // Check if RPC URLs are present
  if (!process.env.HOLESKY_RPC_URL || !process.env.TARGET_CHAIN_RPC_URL) {
    throw new Error("RPC URLs are missing in the .env file");
  }

  // Only use HTTP providers for reliable connections
  console.log("Connecting via HTTP RPC...");
  const holeskyProvider = new ethers.JsonRpcProvider(process.env.HOLESKY_RPC_URL);
  const targetProvider = new ethers.JsonRpcProvider(process.env.TARGET_CHAIN_RPC_URL);
  return { holeskyProvider, targetProvider };
}

// Create providers and contract instances
const { holeskyProvider, targetProvider } = createProviders();

// Check if contract addresses are present
if (!process.env.HOLESKY_BRIDGE_ADDRESS || !process.env.TARGET_CHAIN_BRIDGE_ADDRESS) {
  throw new Error("Contract addresses are missing in the .env file");
}

// Get signer for writing transactions
async function getSigner(provider: ethers.Provider) {
  // In production, this would use a secure wallet or key management solution
  // For development, we'll use a private key from .env
  if (!process.env.PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY is missing in the .env file");
  }
  return new ethers.Wallet(process.env.PRIVATE_KEY, provider);
}

// Create contract interfaces for the bridge contracts
const holeskyBridgeInterface = new ethers.Interface(TokenBridgeABI);
const targetBridgeInterface = new ethers.Interface(TokenBridgeABI);

// Contract instances for read-only operations
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

// Get confirmation thresholds from environment or use default values
const holeskyConfirmationBlocks = process.env.HOLESKY_CONFIRMATION_BLOCKS 
  ? parseInt(process.env.HOLESKY_CONFIRMATION_BLOCKS) 
  : 15;
  
const targetChainConfirmationBlocks = process.env.TARGET_CHAIN_CONFIRMATION_BLOCKS 
  ? parseInt(process.env.TARGET_CHAIN_CONFIRMATION_BLOCKS) 
  : 6;

// Function to check if a transaction has enough confirmations
async function hasEnoughConfirmations(txHash: string, provider: ethers.Provider, requiredConfirmations: number) {
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) return false;
    
    const currentBlock = await provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber + 1;
    
    console.log(`Transaction ${txHash} has ${confirmations}/${requiredConfirmations} confirmations`);
    return confirmations >= requiredConfirmations;
  } catch (error) {
    console.error("Error checking confirmations:", error);
    return false;
  }
}

// Function to check if a token is supported on the bridge contract
async function isTokenSupported(token: string, contract: ethers.Contract): Promise<boolean> {
  try {
    // Check if the contract has a function to verify supported tokens
    // If the contract doesn't have this function, we'll assume the token is not supported
    if (contract.isTokenSupported) {
      return await contract.isTokenSupported(token);
    }
    
    console.log(`No direct way to check if token ${token} is supported, will try to add it`);
    return false;
  } catch (error) {
    console.error(`Error checking if token is supported:`, error);
    return false;
  }
}

// Function to add a token as supported
async function addSupportedToken(token: string, contract: ethers.Contract): Promise<boolean> {
  try {
    console.log(`Attempting to add token ${token} as supported`);
    const tx = await contract.addSupportedToken(token);
    await tx.wait();
    console.log(`✅ Token ${token} added as supported`);
    return true;
  } catch (error) {
    console.error(`Failed to add token as supported:`, error);
    // If the error is "OwnableUnauthorizedAccount" or similar, it means the user
    // is not the owner of the contract and doesn't have the rights to add a token
    console.log(`Please manually add the token ${token} as supported on the contract at ${contract.target}`);
    return false;
  }
}

// Function to get the corresponding token on the destination chain
function getCorrespondingToken(sourceToken: string, sourceChain: string): string {
  // Read token addresses from environment variables
  const holeskyToken = process.env.HOLESKY_TEST_TOKEN;
  const targetToken = process.env.TARGET_CHAIN_TEST_TOKEN;
  
  if (!holeskyToken || !targetToken) {
    console.warn("⚠️ Token addresses are not defined in .env file (HOLESKY_TEST_TOKEN, TARGET_CHAIN_TEST_TOKEN)");
    // If addresses are not defined, use the source token address
    // This is not ideal, but it's better than nothing for development
    return sourceToken;
  }
  
  // If the deposit comes from Holesky, use the token address on the target chain
  if (sourceChain === "holesky") {
    console.log(`Mapping token from Holesky (${sourceToken}) to Target chain (${targetToken})`);
    return targetToken;
  } 
  // If the deposit comes from the target chain, use the token address on Holesky
  else {
    console.log(`Mapping token from Target chain (${sourceToken}) to Holesky (${holeskyToken})`);
    return holeskyToken;
  }
}

// Function to create a distribution transaction
async function distributeTokens(
  token: string,
  to: string,
  amount: string,
  nonce: string,
  sourceChain: string,
  from: string
) {
  try {
    // Determine which chain to send the distribution on
    const isFromHolesky = sourceChain === "holesky";
    const provider = isFromHolesky ? targetProvider : holeskyProvider;
    
    // Get signer for the contract
    const signer = await getSigner(provider);
    console.log(`Using signer with address: ${await signer.getAddress()}`);
    
    // Create contract with signer
    const contract = isFromHolesky 
      ? new ethers.Contract(
          process.env.TARGET_CHAIN_BRIDGE_ADDRESS as string, 
          TokenBridgeABI, 
          signer
        )
      : new ethers.Contract(
          process.env.HOLESKY_BRIDGE_ADDRESS as string, 
          TokenBridgeABI, 
          signer
        );
    
    // Get the corresponding token address on the destination chain
    const destinationToken = getCorrespondingToken(token, sourceChain);
    
    console.log(`Initiating distribution on ${isFromHolesky ? "target chain" : "holesky"}`);
    
    // IMPORTANT: Use 'from' as the final recipient (the address that made the deposit)
    // instead of 'to' (the address specified in the deposit)
    const finalRecipient = from;
    
    console.log({
      sourceToken: token,
      destinationToken,
      originalSender: from, // The original sender
      originalRecipient: to, // The recipient specified in the deposit
      finalRecipient: finalRecipient, // The actual recipient of the distribution (original sender)
      amount,
      nonce,
      contractAddress: contract.target
    });

    // Verify that the destination address is correct and valid
    if (!ethers.isAddress(finalRecipient)) {
      throw new Error(`Destination address '${finalRecipient}' is not a valid Ethereum address`);
    }
    
    console.log(`✅ Address validation check passed for recipient: ${finalRecipient}`);

    // Check if the token is supported before attempting distribution
    console.log(`Checking if token ${destinationToken} is supported on destination chain...`);
    
    // Try to add the token as supported before distribution
    await addSupportedToken(destinationToken, contract);
    
    console.log("Proceeding with distribution...");
    console.log(`IMPORTANT - Distribution parameters:
    - Token: ${destinationToken}
    - Final recipient (from): ${finalRecipient}
    - Amount: ${amount}
    - Nonce: ${nonce}
    `);

    // Call the distribute function on the bridge contract with the destination token
    const tx = await contract.distribute(
      destinationToken,
      finalRecipient, // Use the FROM address as the final recipient
      BigInt(amount),
      BigInt(nonce)
    );

    console.log(`Distribution transaction sent: ${tx.hash}`);
    
    // Wait for transaction receipt
    const receipt = await tx.wait();
    console.log(`Distribution confirmed in block ${receipt.blockNumber}`);
    
    // Update database to mark deposit as processed
    await DepositEvent.update(
      { processed: true },
      { 
        where: { 
          nonce: nonce,
          chainId: sourceChain 
        } 
      }
    );
    
    // Record distribution event
    await DistributionEvent.create({
      token: destinationToken, // Use the destination token in the record
      to: finalRecipient,     // Use the FROM address as the final recipient in the event
      amount,
      nonce,
      chainId: isFromHolesky ? "target_chain" : "holesky",
      processed: true
    });
    
    return receipt;
  } catch (error) {
    console.error("Distribution failed:", error);
    
    // If the error is about the token not being supported, display a clearer message
    if (error instanceof Error && error.message.includes("token not supported")) {
      console.log("\nERROR: The token is not supported on the Bridge contract.");
      console.log("You must manually add the token as 'supported' on the contract by calling the addSupportedToken function with the token address.");
      console.log(`Token address: ${getCorrespondingToken(token, sourceChain)}`);
      console.log("Use this function on Etherscan or via another interface to add the token.");
    }
    
    throw error;
  }
}

// Main function to process pending deposits
async function processPendingDeposits() {
  try {
    // Find all unprocessed deposits
    const pendingDeposits = await DepositEvent.findAll({
      where: {
        processed: false
      }
    });
    
    if (pendingDeposits.length === 0) {
      console.log("No pending deposits to process");
      return;
    }
    
    console.log(`Found ${pendingDeposits.length} pending deposits to process`);
    
    for (const deposit of pendingDeposits) {
      try {
        console.log(`\n======== Processing deposit ${deposit.nonce} from ${deposit.chainId} ========`);
        console.log(`From: ${deposit.from}`);
        console.log(`To: ${deposit.to}`);
        console.log(`Amount: ${deposit.amount} tokens`);
        console.log(`Transaction: ${deposit.transactionHash}`);
        
        // Check transaction confirmations before processing
        const provider = deposit.chainId === "holesky" ? holeskyProvider : targetProvider;
        const requiredConfirmations = deposit.chainId === "holesky" 
          ? holeskyConfirmationBlocks 
          : targetChainConfirmationBlocks;
        
        // We need to have the transaction hash stored to check confirmations
        if (deposit.transactionHash) {
          const hasConfirmations = await hasEnoughConfirmations(
            deposit.transactionHash, 
            provider, 
            requiredConfirmations
          );
          
          if (hasConfirmations) {
            // Process the deposit by distributing tokens on the other chain
            console.log(`Distribution to ${deposit.from} (the sender of the original deposit)...`);
            await distributeTokens(
              deposit.token,
              deposit.to,
              deposit.amount,
              deposit.nonce,
              deposit.chainId,
              deposit.from
            );
            
            console.log(`✅ Successfully processed deposit with nonce ${deposit.nonce}`);
          } else {
            console.log(`⏳ Deposit ${deposit.nonce} doesn't have enough confirmations yet (needs ${requiredConfirmations})`);
          }
        } else {
          console.log(`❓ Deposit ${deposit.nonce} is missing transaction hash, cannot verify confirmations`);
          console.log(`Marking as processed to avoid indefinite retries`);
          
          // Mark as processed to avoid infinite retries
          await DepositEvent.update(
            { processed: true },
            { where: { id: deposit.id } }
          );
        }
      } catch (error) {
        console.error(`❌ Error processing deposit ${deposit.nonce}:`, error);
        // Continue with next deposit
      }
    }
  } catch (error) {
    console.error("Error in processPendingDeposits:", error);
  }
}

// Function to start the distribution service
async function startDistributionService(interval = 60000) {
  console.log("🚀 Starting automatic distribution service");
  console.log(`Using confirmation thresholds: Holesky=${holeskyConfirmationBlocks}, Target Chain=${targetChainConfirmationBlocks}`);
  
  // Immediately process any pending deposits
  await processPendingDeposits();
  
  // Set up recurring processing
  setInterval(async () => {
    await processPendingDeposits();
  }, interval);
}

export { startDistributionService }; 