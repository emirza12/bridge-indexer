// script/DeployTestToken.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/TestToken.sol";

contract DeployTestToken is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        TestToken token = new TestToken();
        
        vm.stopBroadcast();
        
        console.log("TestToken deployed to:", address(token));
        console.log("Total supply:", token.totalSupply() / 1e18, "TST");
    }
} 