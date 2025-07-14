const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Color codes for better terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m"
};

function log(message, color = "reset") {
  console.log(colors[color] + message + colors.reset);
}

async function deployContracts() {
  const [deployer] = await hre.ethers.getSigners();
  
  log("\n📦 Deploying contracts...", "yellow");
  
  // Deploy AutophageToken
  const AutophageToken = await hre.ethers.getContractFactory("AutophageToken");
  const autophageToken = await AutophageToken.deploy();
  await autophageToken.waitForDeployment();
  
  // Deploy mock USDC
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const mockUSDC = await MockERC20.deploy();
  await mockUSDC.waitForDeployment();
  
  // Deploy ReservoirContract
  const ReservoirContract = await hre.ethers.getContractFactory("ReservoirContract");
  const reservoir = await ReservoirContract.deploy(
    await autophageToken.getAddress(),
    await mockUSDC.getAddress()
  );
  await reservoir.waitForDeployment();
  
  // Deploy VerificationEngine
  const VerificationEngine = await hre.ethers.getContractFactory("VerificationEngine");
  const verificationEngine = await VerificationEngine.deploy(
    await autophageToken.getAddress(),
    await reservoir.getAddress()
  );
  await verificationEngine.waitForDeployment();
  
  // Deploy catalyst token for governance
  const catalystToken = await MockERC20.deploy();
  await catalystToken.waitForDeployment();
  
  // Deploy GovernanceContract
  const GovernanceContract = await hre.ethers.getContractFactory("GovernanceContract");
  const governance = await GovernanceContract.deploy(
    await autophageToken.getAddress(),
    await catalystToken.getAddress()
  );
  await governance.waitForDeployment();
  
  // Setup roles
  const MINTER_ROLE = await autophageToken.MINTER_ROLE();
  const RESERVOIR_ROLE = await autophageToken.RESERVOIR_ROLE();
  
  await autophageToken.grantRole(MINTER_ROLE, await verificationEngine.getAddress());
  await autophageToken.grantRole(RESERVOIR_ROLE, await reservoir.getAddress());
  
  // Mint initial USDC
  await mockUSDC.mint(await reservoir.getAddress(), hre.ethers.parseEther("1000000"));
  
  log("✅ All contracts deployed!", "green");
  
  return {
    network: hre.network.name,
    contracts: {
      AutophageToken: await autophageToken.getAddress(),
      MockUSDC: await mockUSDC.getAddress(),
      CatalystToken: await catalystToken.getAddress(),
      ReservoirContract: await reservoir.getAddress(),
      VerificationEngine: await verificationEngine.getAddress(),
      GovernanceContract: await governance.getAddress()
    },
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };
}

async function loadDeployment() {
  const deploymentPath = path.join(__dirname, `../deployments/${hre.network.name}.json`);
  
  if (!fs.existsSync(deploymentPath)) {
    log("❌ No deployment found for network: " + hre.network.name, "yellow");
    log("🚀 Deploying contracts now...", "green");
    
    // Deploy contracts if not found
    const deployment = await deployContracts();
    
    // Save deployment
    if (!fs.existsSync(path.join(__dirname, "../deployments"))) {
      fs.mkdirSync(path.join(__dirname, "../deployments"));
    }
    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
    
    return deployment;
  }
  
  return JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
}

async function getContracts(deployment) {
  const contracts = {};
  
  // Load contract factories and attach to deployed addresses
  contracts.autophageToken = await hre.ethers.getContractAt(
    "AutophageToken",
    deployment.contracts.AutophageToken
  );
  
  contracts.mockUSDC = await hre.ethers.getContractAt(
    "MockERC20",
    deployment.contracts.MockUSDC
  );
  
  // Add catalyst token if it exists
  if (deployment.contracts.CatalystToken) {
    contracts.catalystToken = await hre.ethers.getContractAt(
      "MockERC20",
      deployment.contracts.CatalystToken
    );
  }
  
  contracts.reservoir = await hre.ethers.getContractAt(
    "ReservoirContract",
    deployment.contracts.ReservoirContract
  );
  
  contracts.verificationEngine = await hre.ethers.getContractAt(
    "VerificationEngine",
    deployment.contracts.VerificationEngine
  );
  
  contracts.governance = await hre.ethers.getContractAt(
    "GovernanceContract",
    deployment.contracts.GovernanceContract
  );
  
  return contracts;
}

async function displayMenu() {
  console.log("\n" + "=".repeat(50));
  log("🧬 Autophage Protocol - Interactive Console", "bright");
  console.log("=".repeat(50));
  console.log("\n1. Token Operations");
  console.log("2. Health Activities & Verification");
  console.log("3. Healthcare Claims");
  console.log("4. Governance");
  console.log("5. View Balances & Stats");
  console.log("6. Advanced Operations");
  console.log("0. Exit\n");
}

async function tokenOperations(contracts, signer) {
  console.log("\n--- Token Operations ---");
  console.log("1. Mint tokens");
  console.log("2. Transfer tokens");
  console.log("3. Check decay");
  console.log("4. Lock in wellness vault");
  console.log("0. Back\n");
  
  const choice = await getUserInput("Select operation: ");
  
  switch (choice) {
    case "1":
      await mintTokens(contracts, signer);
      break;
    case "2":
      await transferTokens(contracts, signer);
      break;
    case "3":
      await checkDecay(contracts, signer);
      break;
    case "4":
      await lockInVault(contracts, signer);
      break;
  }
}

async function mintTokens(contracts, signer) {
  // First verify we can read balances before allowing minting
  try {
    const testBalance = await contracts.autophageToken.balanceOf(signer.address, 0);
  } catch (error) {
    log("\n❌ Cannot connect to contracts!", "yellow");
    log("\nTo fix this issue:", "cyan");
    log("1. Make sure local node is running: npm run node", "green");
    log("2. Deploy contracts: npm run deploy:localhost", "green");
    log("3. Restart this console: npm run interact", "green");
    log("\nError details: " + error.message, "yellow");
    return;
  }

  const address = await getUserInput("Recipient address (or 'me' for your address): ");
  const recipient = address === "me" ? signer.address : address;
  
  console.log("\nToken species:");
  console.log("0 - Rhythm (RHY) - 5% daily decay");
  console.log("1 - Healing (HLN) - 0.75% daily decay");
  console.log("2 - Foundation (FDN) - 0.1% daily decay");
  console.log("3 - Catalyst (CTL) - 2-10% dynamic decay");
  
  const species = await getUserInput("Select species (0-3): ");
  const amount = await getUserInput("Amount to mint (in ETH units): ");
  
  try {
    log("\n⏳ Minting tokens...", "yellow");
    const tx = await contracts.autophageToken.mint(
      recipient,
      parseInt(species),
      hre.ethers.parseEther(amount)
    );
    await tx.wait();
    log("✅ Tokens minted successfully!", "green");
    log(`Transaction hash: ${tx.hash}`, "cyan");
    
    // Immediately verify the balance was updated
    const newBalance = await contracts.autophageToken.balanceOf(recipient, parseInt(species));
    log(`New balance: ${hre.ethers.formatEther(newBalance)} tokens`, "green");
  } catch (error) {
    log("❌ Error: " + error.message, "yellow");
    if (error.message.includes("MINTER_ROLE")) {
      log("You don't have permission to mint. Contact admin for MINTER_ROLE.", "cyan");
    }
  }
}

async function transferTokens(contracts, signer) {
  const to = await getUserInput("Recipient address: ");
  const species = await getUserInput("Token species (0-3): ");
  const amount = await getUserInput("Amount to transfer: ");
  
  try {
    log("\n⏳ Transferring tokens...", "yellow");
    const tx = await contracts.autophageToken.transfer(
      to,
      parseInt(species),
      hre.ethers.parseEther(amount)
    );
    await tx.wait();
    log("✅ Transfer successful!", "green");
  } catch (error) {
    log("❌ Error: " + error.message, "yellow");
  }
}

async function checkDecay(contracts, signer) {
  const address = await getUserInput("Address to check (or 'me'): ");
  const targetAddress = address === "me" ? signer.address : address;
  
  console.log("\n📊 Token Balances (with decay applied):");
  
  const species = ["Rhythm (RHY)", "Healing (HLN)", "Foundation (FDN)", "Catalyst (CTL)"];
  for (let i = 0; i < 4; i++) {
    const balance = await contracts.autophageToken.balanceOf(targetAddress, i);
    if (balance > 0) {
      log(`${species[i]}: ${hre.ethers.formatEther(balance)} tokens`, "cyan");
    }
  }
}

async function lockInVault(contracts, signer) {
  console.log("\n🔒 Lock Tokens in Wellness Vault");
  console.log("Locked tokens have reduced decay rates!");
  
  const species = await getUserInput("Token species to lock (0-3): ");
  const currentBalance = await contracts.autophageToken.balanceOf(signer.address, parseInt(species));
  
  if (currentBalance === 0n) {
    log("❌ You don't have any tokens of this species to lock", "yellow");
    return;
  }
  
  log(`Current balance: ${hre.ethers.formatEther(currentBalance)} tokens`, "cyan");
  const amount = await getUserInput("Amount to lock: ");
  const duration = await getUserInput("Lock duration in days (30-365): ");
  
  try {
    log("\n⏳ Locking tokens...", "yellow");
    const tx = await contracts.autophageToken.lockInVault(
      parseInt(species),
      hre.ethers.parseEther(amount),
      parseInt(duration)
    );
    await tx.wait();
    
    const reductionPercent = Math.min(parseInt(duration) * 0.5, 50); // 0.5% per day, max 50%
    log("✅ Tokens locked successfully!", "green");
    log(`   Locked amount: ${amount} tokens`, "cyan");
    log(`   Lock duration: ${duration} days`, "cyan");
    log(`   Decay reduction: ${reductionPercent}%`, "green");
  } catch (error) {
    log("❌ Error: " + error.message, "yellow");
  }
}


async function healthActivities(contracts, signer) {
  console.log("\n--- Health Activities ---");
  console.log("1. Submit exercise activity");
  console.log("2. Submit therapy session");
  console.log("3. Submit nutrition log");
  console.log("4. Submit health checkup");
  console.log("5. View activity stats");
  console.log("0. Back\n");
  
  const choice = await getUserInput("Select operation: ");
  
  switch (choice) {
    case "1":
      await submitActivity(contracts, signer, 0, "Exercise");
      break;
    case "2":
      await submitActivity(contracts, signer, 1, "Therapy");
      break;
    case "3":
      await submitActivity(contracts, signer, 2, "Nutrition");
      break;
    case "4":
      await submitActivity(contracts, signer, 3, "Checkup");
      break;
    case "5":
      await viewActivityStats(contracts, signer);
      break;
  }
}

async function submitActivity(contracts, signer, activityType, activityName) {
  console.log(`\n📱 Submitting ${activityName} Activity`);
  
  const duration = await getUserInput("Duration in minutes: ");
  const intensity = await getUserInput("Intensity (1-100): ");
  
  try {
    log("\n⏳ Recording activity...", "yellow");
    
    // For demo purposes, mint tokens directly
    // In production, this would go through the verification engine with ZK proofs
    const baseReward = hre.ethers.parseEther("50");
    const durationMultiplier = Math.min(parseInt(duration) / 30, 2); // Up to 2x for longer activities
    const intensityMultiplier = parseInt(intensity) / 100;
    const totalReward = baseReward * BigInt(Math.floor(durationMultiplier * intensityMultiplier * 100)) / 100n;
    
    await contracts.autophageToken.mint(signer.address, activityType, totalReward);
    
    log("✅ Activity recorded and rewards distributed!", "green");
    log(`   Duration: ${duration} minutes`, "cyan");
    log(`   Intensity: ${intensity}/100`, "cyan");
    const tokenNames = ["Rhythm", "Healing", "Foundation", "Catalyst"];
    log(`   Reward: ${hre.ethers.formatEther(totalReward)} ${tokenNames[activityType]} tokens`, "green");
    
    // Check new balance
    const balance = await contracts.autophageToken.balanceOf(signer.address, activityType);
    log(`\nTotal ${tokenNames[activityType]} token balance: ${hre.ethers.formatEther(balance)}`, "cyan");
  } catch (error) {
    log("❌ Error: " + error.message, "yellow");
  }
}

async function viewActivityStats(contracts, signer) {
  console.log("\n📊 Activity Statistics");
  console.log("=".repeat(40));
  
  const species = ["Rhythm (RHY) - Exercise", "Healing (HLN) - Therapy", "Foundation (FDN) - Preventive", "Catalyst (CTL) - Market"];
  
  for (let i = 0; i < 4; i++) {
    const balance = await contracts.autophageToken.balanceOf(signer.address, i);
    if (balance > 0) {
      log(`${species[i]}: ${hre.ethers.formatEther(balance)} tokens`, "cyan");
    }
  }
  
  // Note: Vault info is stored privately in the contract
  log(`\n🔒 Note: Wellness vault details are stored privately`, "yellow");
}

async function governanceOperations(contracts, signer) {
  console.log("\n--- Governance ---");
  console.log("1. Create proposal");
  console.log("2. Vote on proposal");
  console.log("3. View proposals");
  console.log("4. Execute proposal");
  console.log("0. Back\n");
  
  const choice = await getUserInput("Select operation: ");
  
  switch (choice) {
    case "1":
      await createProposal(contracts, signer);
      break;
    case "2":
      await voteOnProposal(contracts, signer);
      break;
    case "3":
      await viewProposals(contracts);
      break;
    case "4":
      await executeProposal(contracts, signer);
      break;
  }
}

async function createProposal(contracts, signer) {
  console.log("\n📝 Create New Proposal");
  
  const title = await getUserInput("Title: ");
  const description = await getUserInput("Description: ");
  
  console.log("\nProposal Types:");
  console.log("0 - Parameter Change");
  console.log("1 - Feature Toggle");
  console.log("2 - Protocol Upgrade");
  
  const proposalType = await getUserInput("Select type (0-2): ");
  
  try {
    // Check if user has catalyst tokens and approve if needed
    if (contracts.catalystToken) {
      const balance = await contracts.catalystToken.balanceOf(signer.address);
      if (balance === 0n) {
        log("\n❌ You need Catalyst tokens to create proposals", "yellow");
        log("Minting some Catalyst tokens for you...", "cyan");
        await contracts.catalystToken.mint(signer.address, hre.ethers.parseEther("100"));
      }
      
      // Approve governance contract to spend catalyst tokens
      await contracts.catalystToken.approve(contracts.governance.target, hre.ethers.parseEther("10000"));
    }
    
    log("\n⏳ Creating proposal...", "yellow");
    
    // The contract expects proposalType, title, description, and callData
    const tx = await contracts.governance.createProposal(
      parseInt(proposalType),
      title,
      description,
      "0x" // Empty call data for now
    );
    await tx.wait();
    log("✅ Proposal created successfully!", "green");
    
    // The proposalId is returned from the transaction
    const receipt = await tx.wait();
    const event = receipt.logs.find(log => {
      try {
        const parsed = contracts.governance.interface.parseLog(log);
        return parsed.name === "ProposalCreated";
      } catch (e) {
        return false;
      }
    });
    
    if (event) {
      const parsed = contracts.governance.interface.parseLog(event);
      log(`Proposal ID: ${parsed.args.proposalId}`, "cyan");
    }
  } catch (error) {
    log("❌ Error: " + error.message, "yellow");
  }
}

async function voteOnProposal(contracts, signer) {
  const proposalId = await getUserInput("Proposal ID: ");
  const support = await getUserInput("Support proposal? (yes/no): ");
  
  try {
    log("\n⏳ Casting vote...", "yellow");
    const tx = await contracts.governance.vote(
      parseInt(proposalId),
      support.toLowerCase() === "yes"
    );
    await tx.wait();
    log("✅ Vote cast successfully!", "green");
  } catch (error) {
    log("❌ Error: " + error.message, "yellow");
  }
}

async function viewProposals(contracts) {
  console.log("\n📋 Governance Proposals");
  console.log("=".repeat(40));
  
  try {
    // Try to get proposals by ID, starting from 0
    // Since we don't have a proposalCount, we'll try a few IDs
    log("Checking recent proposals...", "cyan");
    
    let foundProposal = false;
    for (let i = 0; i < 10; i++) {
      try {
        const proposal = await contracts.governance.getProposal(i);
        // Check if proposal exists (proposer !== zero address)
        if (proposal.proposer !== "0x0000000000000000000000000000000000000000") {
          foundProposal = true;
          console.log(`\nProposal #${i}:`);
          log(`  Proposer: ${proposal.proposer}`, "cyan");
          log(`  Type: ${["Parameter Change", "Feature Toggle", "Protocol Upgrade", "Emergency Action"][proposal.proposalType]}`, "green");
          log(`  Votes For: ${hre.ethers.formatEther(proposal.votesFor)}`, "green");
          log(`  Votes Against: ${hre.ethers.formatEther(proposal.votesAgainst)}`, "yellow");
          log(`  Executed: ${proposal.executed}`, proposal.executed ? "green" : "yellow");
          log(`  Cancelled: ${proposal.cancelled}`, proposal.cancelled ? "red" : "green");
        }
      } catch (e) {
        // Proposal doesn't exist, continue
      }
    }
    
    if (!foundProposal) {
      log("No proposals found", "yellow");
    }
  } catch (error) {
    log("❌ Error fetching proposals: " + error.message, "yellow");
  }
}

async function executeProposal(contracts, signer) {
  const proposalId = await getUserInput("Proposal ID to execute: ");
  
  try {
    log("\n⏳ Executing proposal...", "yellow");
    const tx = await contracts.governance.executeProposal(parseInt(proposalId));
    await tx.wait();
    log("✅ Proposal executed successfully!", "green");
  } catch (error) {
    log("❌ Error: " + error.message, "yellow");
    log("Note: Proposals must pass voting and be within execution window", "cyan");
  }
}

async function viewBalances(contracts, signer) {
  console.log("\n💰 Account Summary");
  console.log("=".repeat(40));
  
  const address = signer.address;
  log(`Address: ${address}`, "cyan");
  
  // Token balances
  console.log("\n📊 Token Balances:");
  const species = ["Rhythm (RHY)", "Healing (HLN)", "Foundation (FDN)", "Catalyst (CTL)"];
  
  for (let i = 0; i < 4; i++) {
    try {
      const balance = await contracts.autophageToken.balanceOf(address, i);
      log(`  ${species[i]}: ${hre.ethers.formatEther(balance)} tokens`, balance > 0 ? "green" : "yellow");
    } catch (error) {
      log(`  ${species[i]}: ERROR - ${error.message}`, "red");
      if (i === 0) {
        // Only show detailed error once
        log("\n❌ Cannot read token balances!", "yellow");
        log("This usually means:", "cyan");
        log("1. Contracts are not deployed to your current network", "yellow");
        log("2. You're connected to the wrong network", "yellow");
        log("3. The deployment file is outdated", "yellow");
        log("\nTry these steps:", "green");
        log("1. Stop this console (Ctrl+C)", "cyan");
        log("2. In terminal 1: npm run node", "cyan");
        log("3. In terminal 2: npm run deploy:localhost", "cyan");
        log("4. In terminal 3: npm run interact", "cyan");
        break;
      }
    }
  }
  
  // USDC balance
  try {
    const usdcBalance = await contracts.mockUSDC.balanceOf(address);
    log(`  USDC: ${hre.ethers.formatEther(usdcBalance)}`, usdcBalance > 0 ? "green" : "yellow");
  } catch (error) {
    log(`  USDC: ERROR - ${error.message}`, "red");
  }
  
  // Note: Wellness vault info is stored privately in the contract
  
  // Check if user has zero balances and offer to mint
  let hasTokens = false;
  try {
    for (let i = 0; i < 4; i++) {
      const balance = await contracts.autophageToken.balanceOf(address, i);
      if (balance > 0) {
        hasTokens = true;
        break;
      }
    }
  } catch (e) {
    // Ignore errors
  }
  
  if (!hasTokens) {
    console.log("\n💡 Tip: You have no tokens. Use option 1 to mint some tokens!");
  }
  
  console.log("\n" + "=".repeat(40));
}

async function getUserInput(prompt) {
  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    readline.question(prompt, (answer) => {
      readline.close();
      resolve(answer);
    });
  });
}

async function main() {
  log("\n🚀 Starting Autophage Protocol Interactive Console...", "bright");
  
  // Load deployment
  const deployment = await loadDeployment();
  log(`\n✅ Loaded deployment from ${deployment.timestamp}`, "green");
  log(`📍 Network: ${deployment.network}`, "cyan");
  log(`📝 Contracts deployed by: ${deployment.deployer}`, "cyan");
  
  // Get signer
  const [signer] = await hre.ethers.getSigners();
  log(`🔑 Using account: ${signer.address}`, "cyan");
  
  // Get contracts
  const contracts = await getContracts(deployment);
  log("📄 Contracts loaded successfully", "green");
  
  // Test contract connectivity
  try {
    const testBalance = await contracts.autophageToken.balanceOf(signer.address, 0);
    log("✅ Contract connectivity verified", "green");
  } catch (e) {
    log("⚠️  Warning: Cannot connect to contracts. Make sure:", "yellow");
    log("   1. Local node is running (npm run node)", "cyan");
    log("   2. Contracts are deployed (npm run deploy:localhost)", "cyan");
    log("   Some features may not work properly.", "yellow");
  }
  
  // Grant initial roles for demo
  try {
    const MINTER_ROLE = await contracts.autophageToken.MINTER_ROLE();
    await contracts.autophageToken.grantRole(MINTER_ROLE, signer.address);
    
    // Also mint some initial USDC for testing
    await contracts.mockUSDC.mint(signer.address, hre.ethers.parseEther("10000"));
    log("💵 Minted 10,000 USDC for testing", "green");
    
    // Mint catalyst tokens for governance if available
    if (contracts.catalystToken) {
      await contracts.catalystToken.mint(signer.address, hre.ethers.parseEther("1000"));
      await contracts.catalystToken.approve(contracts.governance.target, hre.ethers.parseEther("10000"));
      log("🗳️ Minted 1,000 Catalyst tokens for governance", "green");
    }
  } catch (e) {
    // Roles might already be granted
  }
  
  // Main loop
  while (true) {
    await displayMenu();
    const choice = await getUserInput("Select option: ");
    
    switch (choice) {
      case "1":
        await tokenOperations(contracts, signer);
        break;
      case "2":
        await healthActivities(contracts, signer);
        break;
      case "3":
        log("\n⚕️ Healthcare claims functionality coming soon!", "yellow");
        log("Use the demo script to see healthcare claims in action.", "cyan");
        break;
      case "4":
        await governanceOperations(contracts, signer);
        break;
      case "5":
        await viewBalances(contracts, signer);
        break;
      case "6":
        log("\n🔧 Advanced operations:", "yellow");
        log("- Use 'npx hardhat console' for direct contract interaction", "cyan");
        log("- Check TEST_GUIDE.md for advanced examples", "cyan");
        break;
      case "0":
        log("\n👋 Goodbye!", "bright");
        process.exit(0);
      default:
        log("\n❌ Invalid choice", "yellow");
    }
    
    await getUserInput("\nPress Enter to continue...");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });