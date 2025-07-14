const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ReservoirContract", function () {
  let reservoir;
  let autophageToken;
  let mockUSDC;
  let owner;
  let user1;
  let user2;
  let verificationEngine;

  beforeEach(async function () {
    [owner, user1, user2, verificationEngine] = await ethers.getSigners();
    
    // Deploy AutophageToken
    const AutophageToken = await ethers.getContractFactory("AutophageToken");
    autophageToken = await AutophageToken.deploy();
    await autophageToken.waitForDeployment();
    
    // Deploy mock USDC
    const MockToken = await ethers.getContractFactory("AutophageToken");
    mockUSDC = await MockToken.deploy();
    await mockUSDC.waitForDeployment();
    
    // Deploy ReservoirContract
    const ReservoirContract = await ethers.getContractFactory("ReservoirContract");
    reservoir = await ReservoirContract.deploy(
      await autophageToken.getAddress(),
      await mockUSDC.getAddress()
    );
    await reservoir.waitForDeployment();
    
    // Setup roles
    const MINTER_ROLE = await autophageToken.MINTER_ROLE();
    const RESERVOIR_ROLE = await autophageToken.RESERVOIR_ROLE();
    await autophageToken.grantRole(MINTER_ROLE, owner.address);
    await autophageToken.grantRole(RESERVOIR_ROLE, await reservoir.getAddress());
    
    // Mint some USDC for testing
    await mockUSDC.grantRole(MINTER_ROLE, owner.address);
    await mockUSDC.mint(owner.address, 0, ethers.parseEther("1000000")); // 1M USDC
  });

  describe("Deployment", function () {
    it("Should set the correct token addresses", async function () {
      expect(await reservoir.autophageToken()).to.equal(await autophageToken.getAddress());
      expect(await reservoir.usdcToken()).to.equal(await mockUSDC.getAddress());
    });

    it("Should initialize with correct default values", async function () {
      expect(await reservoir.minimumSolvency()).to.equal(ethers.parseEther("1000000")); // 1M USDC
      expect(await reservoir.urgencyThreshold()).to.equal(7 * 86400); // 7 days
    });
  });

  describe("Decay Collection", function () {
    beforeEach(async function () {
      // Mint tokens to users
      await autophageToken.mint(user1.address, 0, ethers.parseEther("1000"));
      await autophageToken.mint(user2.address, 0, ethers.parseEther("2000"));
    });

    it("Should collect decayed tokens", async function () {
      // Advance time by 1 day
      await time.increase(86400);
      
      // Trigger some activity to update balances
      await autophageToken.connect(user1).transfer(user2.address, 0, ethers.parseEther("1"));
      
      const decayBalance = await reservoir.getDecayBalance(0);
      expect(decayBalance).to.be.gt(0);
    });

    it("Should track decay accumulation over time", async function () {
      // Advance time by 5 days
      await time.increase(5 * 86400);
      
      // Force balance updates
      await autophageToken.connect(user1).transfer(user1.address, 0, 0);
      await autophageToken.connect(user2).transfer(user2.address, 0, 0);
      
      const decayBalance = await reservoir.getDecayBalance(0);
      // With 5% daily decay over 5 days on 3000 total tokens
      expect(decayBalance).to.be.gt(ethers.parseEther("500"));
    });
  });

  describe("Healthcare Claims", function () {
    beforeEach(async function () {
      // Grant claim submitter role
      const CLAIM_SUBMITTER_ROLE = await reservoir.CLAIM_SUBMITTER_ROLE();
      await reservoir.grantRole(CLAIM_SUBMITTER_ROLE, verificationEngine.address);
      
      // Add USDC to reservoir
      await mockUSDC.transfer(await reservoir.getAddress(), 0, ethers.parseEther("100000"));
    });

    it("Should submit healthcare claim", async function () {
      const claimAmount = ethers.parseEther("1000");
      const urgencyScore = 80;
      
      await reservoir.connect(verificationEngine).submitHealthcareClaim(
        user1.address,
        claimAmount,
        urgencyScore,
        "Medical procedure"
      );
      
      const activeClaims = await reservoir.getActiveClaims();
      expect(activeClaims.length).to.equal(1);
      expect(activeClaims[0].patient).to.equal(user1.address);
      expect(activeClaims[0].amount).to.equal(claimAmount);
    });

    it("Should prioritize claims by urgency", async function () {
      // Submit multiple claims with different urgency scores
      await reservoir.connect(verificationEngine).submitHealthcareClaim(
        user1.address,
        ethers.parseEther("1000"),
        50,
        "Regular checkup"
      );
      
      await reservoir.connect(verificationEngine).submitHealthcareClaim(
        user2.address,
        ethers.parseEther("2000"),
        90,
        "Emergency procedure"
      );
      
      const activeClaims = await reservoir.getActiveClaims();
      // Higher urgency claim should be prioritized
      expect(activeClaims[0].urgencyScore).to.be.gt(activeClaims[1].urgencyScore);
    });

    it("Should process claims when solvency is sufficient", async function () {
      const claimAmount = ethers.parseEther("1000");
      
      await reservoir.connect(verificationEngine).submitHealthcareClaim(
        user1.address,
        claimAmount,
        80,
        "Medical procedure"
      );
      
      const initialBalance = await mockUSDC.balanceOf(user1.address, 0);
      
      // Process claims
      await reservoir.processClaims(1);
      
      const finalBalance = await mockUSDC.balanceOf(user1.address, 0);
      expect(finalBalance - initialBalance).to.equal(claimAmount);
    });

    it("Should reject claims exceeding solvency requirements", async function () {
      // Try to claim more than available considering triple coverage requirement
      const excessiveAmount = ethers.parseEther("40000"); // More than 1/3 of available funds
      
      await expect(
        reservoir.connect(verificationEngine).submitHealthcareClaim(
          user1.address,
          excessiveAmount,
          80,
          "Expensive procedure"
        )
      ).to.be.revertedWith("Insufficient solvency for claim");
    });
  });

  describe("Token Exchange", function () {
    beforeEach(async function () {
      // Setup tokens and prices
      await autophageToken.mint(user1.address, 0, ethers.parseEther("1000"));
      await mockUSDC.transfer(user1.address, 0, ethers.parseEther("10000"));
      
      // Approve reservoir for transfers
      await mockUSDC.connect(user1).setApprovalForAll(await reservoir.getAddress(), true);
      await autophageToken.connect(user1).setApprovalForAll(await reservoir.getAddress(), true);
    });

    it("Should allow buying autophage tokens with USDC", async function () {
      const usdcAmount = ethers.parseEther("100");
      
      await reservoir.connect(user1).buyAutophageTokens(0, usdcAmount);
      
      const autophageBalance = await autophageToken.balanceOf(user1.address, 0);
      expect(autophageBalance).to.be.gt(ethers.parseEther("1000")); // Original + purchased
    });

    it("Should allow selling autophage tokens for USDC", async function () {
      const tokenAmount = ethers.parseEther("100");
      const initialUSDCBalance = await mockUSDC.balanceOf(user1.address, 0);
      
      await reservoir.connect(user1).sellAutophageTokens(0, tokenAmount);
      
      const finalUSDCBalance = await mockUSDC.balanceOf(user1.address, 0);
      expect(finalUSDCBalance).to.be.gt(initialUSDCBalance);
    });

    it("Should update exchange rates based on activity", async function () {
      const initialRate = await reservoir.getExchangeRate(0);
      
      // Simulate activity affecting rates
      await reservoir.connect(user1).buyAutophageTokens(0, ethers.parseEther("1000"));
      
      const newRate = await reservoir.getExchangeRate(0);
      expect(newRate).to.not.equal(initialRate);
    });
  });

  describe("Redistribution", function () {
    beforeEach(async function () {
      // Setup decay collection
      await autophageToken.mint(user1.address, 0, ethers.parseEther("10000"));
      await time.increase(10 * 86400); // 10 days of decay
      await autophageToken.connect(user1).transfer(user1.address, 0, 0); // Force decay update
    });

    it("Should redistribute decayed tokens to active users", async function () {
      // Mark user2 as active contributor
      const CONTRIBUTOR_ROLE = await reservoir.CONTRIBUTOR_ROLE();
      await reservoir.grantRole(CONTRIBUTOR_ROLE, user2.address);
      
      const initialBalance = await autophageToken.balanceOf(user2.address, 0);
      
      await reservoir.redistributeDecayedTokens(0, [user2.address], [100]);
      
      const finalBalance = await autophageToken.balanceOf(user2.address, 0);
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("Should emit RedistributionComplete event", async function () {
      const CONTRIBUTOR_ROLE = await reservoir.CONTRIBUTOR_ROLE();
      await reservoir.grantRole(CONTRIBUTOR_ROLE, user2.address);
      
      await expect(reservoir.redistributeDecayedTokens(0, [user2.address], [100]))
        .to.emit(reservoir, "RedistributionComplete");
    });
  });

  describe("Emergency Functions", function () {
    it("Should pause contract in emergency", async function () {
      await reservoir.pause();
      
      await expect(
        reservoir.connect(verificationEngine).submitHealthcareClaim(
          user1.address,
          ethers.parseEther("1000"),
          80,
          "Claim during pause"
        )
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should allow emergency withdrawal", async function () {
      await mockUSDC.transfer(await reservoir.getAddress(), 0, ethers.parseEther("10000"));
      
      const initialBalance = await mockUSDC.balanceOf(owner.address, 0);
      
      await reservoir.emergencyWithdraw(await mockUSDC.getAddress(), ethers.parseEther("5000"));
      
      const finalBalance = await mockUSDC.balanceOf(owner.address, 0);
      expect(finalBalance - initialBalance).to.equal(ethers.parseEther("5000"));
    });
  });

  describe("Price Discovery", function () {
    it("Should calculate metabolic price based on activity", async function () {
      const price = await reservoir.getMetabolicPrice(0);
      expect(price).to.be.gt(0);
    });

    it("Should adjust prices based on token velocity", async function () {
      // Simulate high velocity
      for (let i = 0; i < 5; i++) {
        await autophageToken.mint(user1.address, 0, ethers.parseEther("100"));
        await autophageToken.connect(user1).transfer(user2.address, 0, ethers.parseEther("50"));
        await time.increase(3600); // 1 hour between transfers
      }
      
      const price = await reservoir.getMetabolicPrice(0);
      expect(price).to.be.gt(0);
    });
  });
});