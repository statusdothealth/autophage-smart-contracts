const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Basic Autophage Protocol Functionality", function () {
  let autophageToken;
  let mockUSDC;
  let reservoir;
  let verificationEngine;
  let governance;
  let owner;
  let user1;
  let user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    // Deploy contracts
    const AutophageToken = await ethers.getContractFactory("AutophageToken");
    autophageToken = await AutophageToken.deploy();
    await autophageToken.waitForDeployment();
    
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockUSDC = await MockERC20.deploy();
    await mockUSDC.waitForDeployment();
    
    const ReservoirContract = await ethers.getContractFactory("ReservoirContract");
    reservoir = await ReservoirContract.deploy(
      await autophageToken.getAddress(),
      await mockUSDC.getAddress()
    );
    await reservoir.waitForDeployment();
    
    const VerificationEngine = await ethers.getContractFactory("VerificationEngine");
    verificationEngine = await VerificationEngine.deploy(
      await autophageToken.getAddress(),
      await reservoir.getAddress()
    );
    await verificationEngine.waitForDeployment();
    
    const GovernanceContract = await ethers.getContractFactory("GovernanceContract");
    governance = await GovernanceContract.deploy(
      await autophageToken.getAddress(),
      await autophageToken.getAddress()
    );
    await governance.waitForDeployment();
    
    // Setup roles
    const MINTER_ROLE = await autophageToken.MINTER_ROLE();
    await autophageToken.grantRole(MINTER_ROLE, owner.address);
    await autophageToken.grantRole(MINTER_ROLE, await verificationEngine.getAddress());
  });

  describe("Core Token Functionality", function () {
    it("Should mint tokens correctly", async function () {
      const amount = ethers.parseEther("100");
      await autophageToken.mint(user1.address, 0, amount);
      
      const balance = await autophageToken.balanceOf(user1.address, 0);
      expect(balance).to.equal(amount);
    });

    it("Should transfer tokens between users", async function () {
      const amount = ethers.parseEther("100");
      await autophageToken.mint(user1.address, 0, amount);
      
      const transferAmount = ethers.parseEther("50");
      await autophageToken.connect(user1).transfer(user2.address, 0, transferAmount);
      
      expect(await autophageToken.balanceOf(user2.address, 0)).to.equal(transferAmount);
      expect(await autophageToken.balanceOf(user1.address, 0)).to.equal(amount - transferAmount);
    });

    it("Should apply decay over time", async function () {
      const amount = ethers.parseEther("1000");
      await autophageToken.mint(user1.address, 0, amount); // RHYTHM tokens
      
      // Advance time by 1 day
      await time.increase(86400);
      
      // Force balance update
      await autophageToken.connect(user1).transfer(user1.address, 0, 0);
      
      const balance = await autophageToken.balanceOf(user1.address, 0);
      expect(balance).to.be.lt(amount); // Balance should be less due to decay
      expect(balance).to.be.closeTo(ethers.parseEther("950"), ethers.parseEther("10")); // ~5% decay
    });
  });

  describe("Wellness Vault", function () {
    it("Should allow locking tokens", async function () {
      const amount = ethers.parseEther("1000");
      await autophageToken.mint(user1.address, 0, amount);
      
      const lockAmount = ethers.parseEther("500");
      await autophageToken.connect(user1).lockInWellnessVault(0, lockAmount, 30);
      
      const vaultInfo = await autophageToken.getWellnessVaultInfo(user1.address, 0);
      expect(vaultInfo.amount).to.equal(lockAmount);
      expect(vaultInfo.duration).to.equal(30);
    });
  });

  describe("Verification Engine Basic Operations", function () {
    it("Should update base rewards", async function () {
      const newReward = ethers.parseEther("75");
      await verificationEngine.updateBaseReward(0, newReward);
      
      expect(await verificationEngine.baseRewards(0)).to.equal(newReward);
    });

    it("Should stake tokens for app registration", async function () {
      // First mint catalyst tokens for staking
      await autophageToken.mint(user1.address, 3, ethers.parseEther("10000"));
      
      // Approve verification engine
      await autophageToken.connect(user1).setApprovalForAll(await verificationEngine.getAddress(), true);
      
      // Register app with stake
      await verificationEngine.connect(user1).registerApp("TestApp");
      
      // Check app is registered
      const isRegistered = await verificationEngine.registeredApps(user1.address);
      expect(isRegistered).to.be.true;
    });
  });

  describe("Healthcare Claims", function () {
    beforeEach(async function () {
      // Grant necessary role
      const CLAIM_SUBMITTER_ROLE = await reservoir.CLAIM_SUBMITTER_ROLE();
      await reservoir.grantRole(CLAIM_SUBMITTER_ROLE, owner.address);
      
      // Add USDC to reservoir
      await mockUSDC.mint(await reservoir.getAddress(), ethers.parseEther("100000"));
    });

    it("Should submit healthcare claims", async function () {
      await reservoir.submitHealthcareClaim(
        user1.address,
        ethers.parseEther("1000"),
        80,
        "Medical procedure"
      );
      
      const claims = await reservoir.getActiveClaims();
      expect(claims.length).to.equal(1);
      expect(claims[0].patient).to.equal(user1.address);
    });
  });

  describe("Basic Governance", function () {
    it("Should create proposals", async function () {
      // Give proposer some tokens to have voting power
      await autophageToken.mint(user1.address, 0, ethers.parseEther("1000"));
      
      await governance.connect(user1).createProposal(
        "Test Proposal",
        "Description",
        "Hypothesis",
        0 // PARAMETER_CHANGE
      );
      
      const proposal = await governance.getProposal(0);
      expect(proposal.title).to.equal("Test Proposal");
      expect(proposal.proposer).to.equal(user1.address);
    });

    it("Should allow voting", async function () {
      // Setup proposal
      await autophageToken.mint(user1.address, 0, ethers.parseEther("1000"));
      await governance.connect(user1).createProposal("Test", "Desc", "Hyp", 0);
      
      // Vote
      await governance.connect(user1).vote(0, true);
      
      const vote = await governance.getVote(0, user1.address);
      expect(vote.hasVoted).to.be.true;
      expect(vote.support).to.be.true;
    });
  });

  describe("Token Exchange", function () {
    beforeEach(async function () {
      // Setup approvals
      await autophageToken.connect(user1).setApprovalForAll(await reservoir.getAddress(), true);
      
      // Mint tokens
      await autophageToken.mint(user1.address, 0, ethers.parseEther("1000"));
      await mockUSDC.mint(user1.address, ethers.parseEther("10000"));
      await mockUSDC.mint(await reservoir.getAddress(), ethers.parseEther("100000"));
    });

    it("Should get exchange rates", async function () {
      const rate = await reservoir.getExchangeRate(0);
      expect(rate).to.be.gt(0);
    });

    it("Should allow selling tokens for USDC", async function () {
      const sellAmount = ethers.parseEther("100");
      const initialUSDC = await mockUSDC.balanceOf(user1.address);
      
      await reservoir.connect(user1).sellAutophageTokens(0, sellAmount);
      
      const finalUSDC = await mockUSDC.balanceOf(user1.address);
      expect(finalUSDC).to.be.gt(initialUSDC);
    });
  });

  describe("Emergency Functions", function () {
    it("Should pause contracts", async function () {
      await autophageToken.pause();
      
      await expect(
        autophageToken.mint(user1.address, 0, ethers.parseEther("100"))
      ).to.be.revertedWith("Pausable: paused");
      
      await autophageToken.unpause();
      
      // Should work after unpause
      await autophageToken.mint(user1.address, 0, ethers.parseEther("100"));
    });
  });
});