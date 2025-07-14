const hre = require("hardhat");

async function main() {
  console.log("Starting Autophage Protocol deployment...\n");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());
  console.log();

  // Deploy AutophageToken
  console.log("1. Deploying AutophageToken...");
  const AutophageToken = await hre.ethers.getContractFactory("AutophageToken");
  const autophageToken = await AutophageToken.deploy();
  await autophageToken.waitForDeployment();
  console.log("AutophageToken deployed to:", await autophageToken.getAddress());

  // Deploy mock USDC for testing
  console.log("\n2. Deploying mock USDC...");
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const mockUSDC = await MockERC20.deploy();
  await mockUSDC.waitForDeployment();
  console.log("Mock USDC deployed to:", await mockUSDC.getAddress());

  // Deploy ReservoirContract
  console.log("\n3. Deploying ReservoirContract...");
  const ReservoirContract = await hre.ethers.getContractFactory("ReservoirContract");
  const reservoir = await ReservoirContract.deploy(
    await autophageToken.getAddress(),
    await mockUSDC.getAddress()
  );
  await reservoir.waitForDeployment();
  console.log("ReservoirContract deployed to:", await reservoir.getAddress());

  // Deploy VerificationEngine
  console.log("\n4. Deploying VerificationEngine...");
  const VerificationEngine = await hre.ethers.getContractFactory("VerificationEngine");
  const verificationEngine = await VerificationEngine.deploy(
    await autophageToken.getAddress(),
    await reservoir.getAddress()
  );
  await verificationEngine.waitForDeployment();
  console.log("VerificationEngine deployed to:", await verificationEngine.getAddress());

  // Deploy GovernanceContract
  console.log("\n5. Deploying GovernanceContract...");
  const GovernanceContract = await hre.ethers.getContractFactory("GovernanceContract");
  const governance = await GovernanceContract.deploy(
    await autophageToken.getAddress(),
    await autophageToken.getAddress() // Using same token as catalyst for testing
  );
  await governance.waitForDeployment();
  console.log("GovernanceContract deployed to:", await governance.getAddress());

  // Setup roles
  console.log("\n6. Setting up roles...");
  
  const MINTER_ROLE = await autophageToken.MINTER_ROLE();
  const RESERVOIR_ROLE = await autophageToken.RESERVOIR_ROLE();

  await autophageToken.grantRole(MINTER_ROLE, await verificationEngine.getAddress());
  console.log("- Granted MINTER_ROLE to VerificationEngine");

  await autophageToken.grantRole(RESERVOIR_ROLE, await reservoir.getAddress());
  console.log("- Granted RESERVOIR_ROLE to ReservoirContract");

  // Mint some initial USDC to reservoir for testing
  console.log("\n7. Minting initial USDC to Reservoir...");
  await mockUSDC.mint(await reservoir.getAddress(), hre.ethers.parseEther("1000000")); // 1M USDC
  console.log("- Minted 1,000,000 USDC to Reservoir");

  // Save deployment addresses
  const deployment = {
    network: hre.network.name,
    contracts: {
      AutophageToken: await autophageToken.getAddress(),
      MockUSDC: await mockUSDC.getAddress(),
      ReservoirContract: await reservoir.getAddress(),
      VerificationEngine: await verificationEngine.getAddress(),
      GovernanceContract: await governance.getAddress()
    },
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };

  // Write deployment info to file
  const fs = require("fs");
  const deploymentPath = `./deployments/${hre.network.name}.json`;
  
  if (!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments");
  }
  
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log(`\nDeployment info saved to ${deploymentPath}`);

  console.log("\n========================================");
  console.log("Deployment Summary:");
  console.log("========================================");
  console.log("AutophageToken:", deployment.contracts.AutophageToken);
  console.log("Mock USDC:", deployment.contracts.MockUSDC);
  console.log("ReservoirContract:", deployment.contracts.ReservoirContract);
  console.log("VerificationEngine:", deployment.contracts.VerificationEngine);
  console.log("GovernanceContract:", deployment.contracts.GovernanceContract);
  console.log("========================================\n");

  console.log("✅ Deployment complete!");
  console.log("\nTo interact with the contracts, run:");
  console.log("  npx hardhat console --network", hre.network.name);
  console.log("  or");
  console.log("  npm run interact\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });