const hre = require("hardhat");

async function main() {
  console.log("\n🧬 Autophage Protocol Demo");
  console.log("=".repeat(50));
  
  // Get signers
  const [owner, alice, bob, charlie] = await hre.ethers.getSigners();
  
  console.log("\n📍 Demo Accounts:");
  console.log("Owner:", owner.address);
  console.log("Alice:", alice.address);
  console.log("Bob:", bob.address);
  console.log("Charlie:", charlie.address);
  
  // Deploy contracts
  console.log("\n📦 Deploying contracts...");
  
  const AutophageToken = await hre.ethers.getContractFactory("AutophageToken");
  const autophageToken = await AutophageToken.deploy();
  await autophageToken.waitForDeployment();
  
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const mockUSDC = await MockERC20.deploy();
  await mockUSDC.waitForDeployment();
  
  const ReservoirContract = await hre.ethers.getContractFactory("ReservoirContract");
  const reservoir = await ReservoirContract.deploy(
    await autophageToken.getAddress(),
    await mockUSDC.getAddress()
  );
  await reservoir.waitForDeployment();
  
  const VerificationEngine = await hre.ethers.getContractFactory("VerificationEngine");
  const verificationEngine = await VerificationEngine.deploy(
    await autophageToken.getAddress(),
    await reservoir.getAddress()
  );
  await verificationEngine.waitForDeployment();
  
  console.log("✅ All contracts deployed!");
  
  // Setup roles
  console.log("\n🔐 Setting up roles...");
  const MINTER_ROLE = await autophageToken.MINTER_ROLE();
  await autophageToken.grantRole(MINTER_ROLE, await verificationEngine.getAddress());
  await autophageToken.grantRole(MINTER_ROLE, owner.address); // For demo
  
  const VERIFIER_ROLE = await verificationEngine.VERIFIER_ROLE();
  await verificationEngine.grantRole(VERIFIER_ROLE, owner.address);
  
  // Demo 1: Alice receives tokens and watches them decay
  console.log("\n🏃 Demo 1: Alice receives Rhythm tokens (RHY - 5% daily decay)");
  
  // Mint tokens directly for demo
  await autophageToken.mint(alice.address, 0, hre.ethers.parseEther("1000"));
  
  let aliceBalance = await autophageToken.balanceOf(alice.address, 0);
  console.log(`✅ Alice received ${hre.ethers.formatEther(aliceBalance)} Rhythm tokens`);
  
  // Demo 2: Time passes and tokens decay
  console.log("\n⏰ Demo 2: Fast-forward 1 day to see token decay");
  
  await hre.network.provider.send("evm_increaseTime", [86400]); // 1 day
  await hre.network.provider.send("evm_mine");
  
  // Force balance update by doing a zero transfer
  await autophageToken.connect(alice).transfer(alice.address, 0, 0);
  
  const aliceBalanceAfterDecay = await autophageToken.balanceOf(alice.address, 0);
  const decayAmount = aliceBalance - aliceBalanceAfterDecay;
  console.log(`📉 After 1 day: ${hre.ethers.formatEther(aliceBalanceAfterDecay)} tokens`);
  console.log(`   (${hre.ethers.formatEther(decayAmount)} tokens decayed - 5% daily decay rate)`);
  
  // Demo 3: Bob locks tokens in wellness vault
  console.log("\n🔒 Demo 3: Bob locks tokens in wellness vault for reduced decay");
  
  // First give Bob some tokens
  await autophageToken.mint(bob.address, 0, hre.ethers.parseEther("1000"));
  console.log("Bob received 1000 RHYTHM tokens");
  
  // Lock half in vault
  await autophageToken.connect(bob).lockInVault(0, hre.ethers.parseEther("500"), 30);
  console.log("✅ Bob locked 500 Rhythm tokens for 30 days (reduced decay rate)");
  console.log(`   Locked amount: 500 Rhythm tokens`);
  console.log(`   Lock duration: 30 days`);
  console.log(`   These tokens will decay at ~4.25% instead of 5% daily`);
  
  // Demo 4: Activity rewards through VerificationEngine
  console.log("\n💪 Demo 4: Charlie completes a workout and earns tokens");
  
  // Update base reward for exercise
  await verificationEngine.updateBaseReward(0, hre.ethers.parseEther("50")); // EXERCISE reward
  
  // Mint tokens to Charlie through verification engine
  // For demo purposes, we'll mint directly since full verification requires more setup
  await autophageToken.mint(charlie.address, 0, hre.ethers.parseEther("50"));
  
  const charlieBalance = await autophageToken.balanceOf(charlie.address, 0);
  console.log(`✅ Charlie earned ${hre.ethers.formatEther(charlieBalance)} Rhythm tokens for exercise`);
  
  // Demo 5: Different token species with different decay rates
  console.log("\n🌈 Demo 5: Multiple token species with different decay rates");
  
  // Mint different species to Alice
  await autophageToken.mint(alice.address, 1, hre.ethers.parseEther("1000")); // HEALING
  await autophageToken.mint(alice.address, 2, hre.ethers.parseEther("1000")); // FOUNDATION
  
  console.log("\nAlice now holds:");
  console.log(`  Rhythm (RHY): ${hre.ethers.formatEther(await autophageToken.balanceOf(alice.address, 0))} tokens (5% daily decay)`);
  console.log(`  Healing (HLN): ${hre.ethers.formatEther(await autophageToken.balanceOf(alice.address, 1))} tokens (0.75% daily decay)`);
  console.log(`  Foundation (FDN): ${hre.ethers.formatEther(await autophageToken.balanceOf(alice.address, 2))} tokens (0.1% daily decay)`);
  
  // Demo 6: Token transfers
  console.log("\n💸 Demo 6: Token transfers between users");
  
  await autophageToken.connect(alice).transfer(bob.address, 0, hre.ethers.parseEther("100"));
  console.log("✅ Alice sent 100 Rhythm tokens to Bob");
  
  console.log(`Alice's Rhythm balance: ${hre.ethers.formatEther(await autophageToken.balanceOf(alice.address, 0))} tokens`);
  console.log(`Bob's Rhythm balance: ${hre.ethers.formatEther(await autophageToken.balanceOf(bob.address, 0))} tokens`);
  
  // Demo 7: Healthcare claims (simplified)
  console.log("\n🏥 Demo 7: Healthcare claim submission");
  
  // Add USDC to reservoir
  await mockUSDC.mint(await reservoir.getAddress(), hre.ethers.parseEther("100000"));
  console.log("✅ Added 100,000 USDC to reservoir for healthcare claims");
  
  // Note: In production, healthcare claims would be submitted through the verification engine
  console.log("   Healthcare claims require verification engine setup");
  console.log("   Claims are prioritized by urgency score (0-100)");
  console.log("   Triple-coverage solvency requirements ensure fund security");
  
  // Summary
  console.log("\n📊 Final Summary");
  console.log("=".repeat(50));
  
  const species = ["Rhythm (RHY)", "Healing (HLN)", "Foundation (FDN)", "Catalyst (CTL)"];
  for (const [name, account] of [["Alice", alice], ["Bob", bob], ["Charlie", charlie]]) {
    console.log(`\n${name} (${account.address}):`);
    
    for (let i = 0; i < 4; i++) {
      const balance = await autophageToken.balanceOf(account.address, i);
      if (balance > 0) {
        console.log(`  ${species[i]}: ${hre.ethers.formatEther(balance)} tokens`);
      }
    }
    
    // Note: Vault info is stored privately in the contract
  }
  
  console.log("\n✨ Demo complete! The Autophage Protocol demonstrates:");
  console.log("- 📉 Automatic token decay (metabolic economy)");
  console.log("- 🏃 Activity-based rewards");
  console.log("- 🔒 Wellness vault for reduced decay");
  console.log("- 🌈 Multiple token species with different decay rates");
  console.log("- 💸 Token transfers and exchange");
  console.log("- 🏥 Healthcare claim system");
  console.log("\n🚀 Ready for local testing and experimentation!");
  console.log("\nTry the interactive console: npm run interact");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });