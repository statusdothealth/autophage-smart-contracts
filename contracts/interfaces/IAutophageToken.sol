// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.19;

interface IAutophageToken {
    function balanceOf(address user, uint8 species) external view returns (uint256);
    function transfer(address to, uint8 species, uint256 amount) external returns (bool);
    function mint(address to, uint8 species, uint256 amount) external;
    function burn(address from, uint8 species, uint256 amount) external;
    function getAllBalances(address user) external view returns (uint256[4] memory);
    function collectDecay(address[] calldata users, uint8[] calldata species) external returns (uint256);
    function calculateDecayAmount(address user, uint8 species) external view returns (uint256);
    function applyDecay(address user, uint8 species) external;
}