# Token Bridge Installation and Deployment Guide

## Initial Setup
1. Navigate to the `/Bridge-Contract` directory
2. Install dependencies: `forge install`
3. Configure the `.env` file properly


### Holesky Network
Deploy the test token and the bridge 

```bash
source .env
forge script script/DeployTokenBridge.s.sol:DeployTokenBridge --rpc-url $HOLESKY_RPC_URL --broadcast --verify
```

## Post-Deployment Configuration
1. Update the `.env` file with the deployment addresses

## Actions on Etherscan
1. On the token contract approve the associated BridgeToken contract (on the same chain)
2. After approving the bridge, transfer tokens to it bridge to create liquidity




### Target Network
follow the exact same steps :

```bash
forge script script/DeployTokenBridge.s.sol:DeployTokenBridge --rpc-url $TARGET_CHAIN_RPC_URL --broadcast --verify
```
## Post-Deployment Configuration
1. Update the `.env` file with the deployment addresses

## Actions on Etherscan
1. On the token contract approve the associated BridgeToken contract (on the same chain)
2. After approving the bridge, transfer tokens to it bridge to create liquidity



## Launching the Indexer
1. Navigate to the `/Bridge-Indexer` directory
2. Install dependencies: `npm i`
3. Configure the `.env` file (same configuration as before)
4. Start the indexer: `npx ts-node src/index.ts`

## Testing the Bridge
1. Access one of the two BridgeToken contracts
2. Add the token from the same chain as a supported token
3. Make a deposit of this token to the bridge
4. Observe in the console that the bridge is functioning correctly