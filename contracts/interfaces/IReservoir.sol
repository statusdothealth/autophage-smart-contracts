// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.19;

interface IReservoir {
    function collectDecayedTokens(address[] calldata users, uint8[] calldata species) external;
    function distributeReward(address recipient, uint8 species, uint256 amount) external;
    function submitHealthcareClaim(uint256 amount, uint8 urgencyScore, string calldata claimType, bytes32 verificationHash) external returns (uint256);
    function depositUSDC(uint256 amount) external;
    function calculateMetabolicPrice() external view returns (uint256);
    function receiveStake(address from, uint256 amount) external;
    function slashStake(address app, uint256 amount) external;
}