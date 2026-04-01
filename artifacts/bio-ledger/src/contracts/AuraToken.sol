// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * AURA Token — Sovereign Wellness Rewards
 * Minted by Bio-Ledger when users complete verified health challenges.
 * 1 XP = 1 AURA token.
 * Deployed on Flow EVM Testnet (Chain ID: 545)
 */
contract AuraToken is ERC20 {
    address public minter;

    constructor() ERC20("AURA Wellness Token", "AURA") {
        minter = msg.sender;
    }

    modifier onlyMinter() {
        require(msg.sender == minter, "Only minter can call this");
        _;
    }

    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
    }

    function setMinter(address newMinter) external onlyMinter {
        minter = newMinter;
    }
}
