aller dans  /Bridge-contract
npm i 
remplir le .env

deployer le contrat bridge 
sur holesky : source .env                    
forge script script/DeployTokenBridge.s.sol:DeployTokenBridge --rpc-url $HOLESKY_RPC_URL --broadcast

sur l'adresse target:  source .env                    
forge script script/DeployTokenBridge.s.sol:DeployTokenBridge --rpc-url $TARGET_CHAIN_RPC_URL --broadcast


deployer le test token :
sur holesky : source .env                    
forge script script/DeployTestToken.s.sol:DeployTestToken --rpc-url $HOLESKY_RPC_URL --broadcast

sur la chain target (exemple sepolia):
 source .env                    
forge script script/DeployTestToken.s.sol:DeployTestToken --rpc-url $TARGET_CHAIN_RPC_URL --broadcast

remplir le .env avec les adresses de deployement 

sur ethersacn : 
pour chaque token crée approver le bridgetoken associé (de la meme chain)
apres avoir approuver chque bridge, transferer des tokens sur le bridge correspondant pour creer de la liquidité.

aller dans /bridge indexer, 
npm i 
remplir le .env (meme que celui d'avant )
lancer l'indexer
 npx ts-node src/index.ts   

aller sur un des deux bridgettoken, faire un deposit et observer que tout fonctionne.