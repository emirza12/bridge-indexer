// script/DeployTokenBridge.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/TokenBridge.sol";
import "../src/TestToken.sol";

contract DeployTokenBridge is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        TokenBridge bridge = new TokenBridge();
        
        vm.stopBroadcast();
        
        console.log("TokenBridge deployed to:", address(bridge));

        vm.startBroadcast(deployerPrivateKey);

        TestToken token = new TestToken();
        
        vm.stopBroadcast();
        
        console.log("TestToken deployed to:", address(token));
    }
}