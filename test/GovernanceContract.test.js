const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("GovernanceContract", function () {
  let governance;
  let autophageToken;
  let owner;
  let proposer;
  let voter1;
  let voter2;
  let voter3;

  beforeEach(async function () {
    [owner, proposer, voter1, voter2, voter3] = await ethers.getSigners();
    
    // Deploy AutophageToken
    const AutophageToken = await ethers.getContractFactory("AutophageToken");
    autophageToken = await AutophageToken.deploy();
    await autophageToken.waitForDeployment();
    
    // Deploy GovernanceContract
    const GovernanceContract = await ethers.getContractFactory("GovernanceContract");
    governance = await GovernanceContract.deploy(
      await autophageToken.getAddress(),
      await autophageToken.getAddress() // Using same token as catalyst for testing
    );
    await governance.waitForDeployment();
    
    // Setup roles and contributions
    const MINTER_ROLE = await autophageToken.MINTER_ROLE();
    await autophageToken.grantRole(MINTER_ROLE, owner.address);
    
    // Give contributors some tokens to represent contributions
    await autophageToken.mint(proposer.address, 0, ethers.parseEther("1000"));
    await autophageToken.mint(voter1.address, 0, ethers.parseEther("500"));
    await autophageToken.mint(voter2.address, 0, ethers.parseEther("500"));
    await autophageToken.mint(voter3.address, 0, ethers.parseEther("500"));
  });

  describe("Deployment", function () {
    it("Should set the correct token addresses", async function () {
      expect(await governance.autophageToken()).to.equal(await autophageToken.getAddress());
      expect(await governance.catalystToken()).to.equal(await autophageToken.getAddress());
    });

    it("Should initialize with correct parameters", async function () {
      expect(await governance.votingPeriod()).to.equal(3 * 86400); // 3 days
      expect(await governance.quorumPercentage()).to.equal(10);
      expect(await governance.minimumImprovement()).to.equal(5);
    });
  });

  describe("Proposal Creation", function () {
    it("Should create a new proposal", async function () {
      const title = "Increase Exercise Rewards";
      const description = "Boost exercise rewards by 20% to increase engagement";
      const hypothesis = "Higher rewards will lead to 10% more daily active users";
      
      await governance.connect(proposer).createProposal(
        title,
        description,
        hypothesis,
        0 // ProposalType.PARAMETER_CHANGE
      );
      
      const proposal = await governance.getProposal(0);
      expect(proposal.title).to.equal(title);
      expect(proposal.proposer).to.equal(proposer.address);
      expect(proposal.status).to.equal(0); // VOTING
    });

    it("Should emit ProposalCreated event", async function () {
      await expect(
        governance.connect(proposer).createProposal(
          "Test Proposal",
          "Description",
          "Hypothesis",
          0
        )
      ).to.emit(governance, "ProposalCreated")
        .withArgs(0, proposer.address, "Test Proposal");
    });

    it("Should require minimum contribution to propose", async function () {
      const noContributor = (await ethers.getSigners())[5];
      
      await expect(
        governance.connect(noContributor).createProposal(
          "Bad Proposal",
          "Description",
          "Hypothesis",
          0
        )
      ).to.be.revertedWith("Insufficient contribution score");
    });
  });

  describe("Voting", function () {
    beforeEach(async function () {
      await governance.connect(proposer).createProposal(
        "Test Proposal",
        "Description",
        "Hypothesis",
        0
      );
    });

    it("Should allow voting on proposals", async function () {
      await governance.connect(voter1).vote(0, true);
      
      const vote = await governance.getVote(0, voter1.address);
      expect(vote.hasVoted).to.be.true;
      expect(vote.support).to.be.true;
    });

    it("Should weight votes by contribution", async function () {
      await governance.connect(voter1).vote(0, true);
      await governance.connect(voter2).vote(0, false);
      
      const proposal = await governance.getProposal(0);
      expect(proposal.forVotes).to.equal(await governance.getVotingPower(voter1.address));
      expect(proposal.againstVotes).to.equal(await governance.getVotingPower(voter2.address));
    });

    it("Should prevent double voting", async function () {
      await governance.connect(voter1).vote(0, true);
      
      await expect(
        governance.connect(voter1).vote(0, false)
      ).to.be.revertedWith("Already voted");
    });

    it("Should emit VoteCast event", async function () {
      const votingPower = await governance.getVotingPower(voter1.address);
      
      await expect(governance.connect(voter1).vote(0, true))
        .to.emit(governance, "VoteCast")
        .withArgs(voter1.address, 0, true, votingPower);
    });
  });

  describe("Proposal Execution", function () {
    beforeEach(async function () {
      await governance.connect(proposer).createProposal(
        "Parameter Change",
        "Update voting period",
        "Shorter voting will increase participation",
        0
      );
      
      // Vote to pass the proposal
      await governance.connect(proposer).vote(0, true);
      await governance.connect(voter1).vote(0, true);
      await governance.connect(voter2).vote(0, true);
      
      // Advance past voting period
      await time.increase(4 * 86400);
    });

    it("Should execute passed proposals", async function () {
      await governance.executeProposal(0);
      
      const proposal = await governance.getProposal(0);
      expect(proposal.status).to.equal(2); // EXECUTED
    });

    it("Should require quorum for execution", async function () {
      // Create new proposal with insufficient votes
      await governance.connect(proposer).createProposal(
        "Low Support",
        "Description",
        "Hypothesis",
        0
      );
      
      // Only one small vote
      await governance.connect(voter3).vote(1, true);
      
      await time.increase(4 * 86400);
      
      await expect(governance.executeProposal(1))
        .to.be.revertedWith("Proposal did not pass");
    });

    it("Should reject proposals with more against votes", async function () {
      // Create new proposal
      await governance.connect(proposer).createProposal(
        "Unpopular",
        "Description",
        "Hypothesis",
        0
      );
      
      // Vote against
      await governance.connect(proposer).vote(1, false);
      await governance.connect(voter1).vote(1, false);
      
      await time.increase(4 * 86400);
      
      await expect(governance.executeProposal(1))
        .to.be.revertedWith("Proposal did not pass");
    });
  });

  describe("A/B Testing", function () {
    let proposalId;

    beforeEach(async function () {
      await governance.connect(proposer).createProposal(
        "A/B Test Rewards",
        "Test new reward structure",
        "New structure will improve retention by 10%",
        1 // FEATURE_TOGGLE
      );
      proposalId = 0;
      
      // Pass the proposal
      await governance.connect(proposer).vote(proposalId, true);
      await governance.connect(voter1).vote(proposalId, true);
      await time.increase(4 * 86400);
      await governance.executeProposal(proposalId);
    });

    it("Should start A/B test after execution", async function () {
      await governance.startABTest(proposalId, 1000); // 1000 users in test
      
      const testInfo = await governance.getABTestInfo(proposalId);
      expect(testInfo.isActive).to.be.true;
      expect(testInfo.targetUsers).to.equal(1000);
    });

    it("Should track test metrics", async function () {
      await governance.startABTest(proposalId, 1000);
      
      // Submit test results
      await governance.submitTestResults(
        proposalId,
        true, // isTestGroup
        500, // participants
        55 // 10% improvement (55 vs baseline 50)
      );
      
      const testInfo = await governance.getABTestInfo(proposalId);
      expect(testInfo.testGroupSize).to.equal(500);
      expect(testInfo.testGroupMetric).to.equal(55);
    });

    it("Should validate statistical significance", async function () {
      await governance.startABTest(proposalId, 1000);
      
      // Submit test group results
      await governance.submitTestResults(proposalId, true, 500, 55);
      
      // Submit control group results
      await governance.submitTestResults(proposalId, false, 500, 50);
      
      const isSignificant = await governance.isStatisticallySignificant(proposalId);
      expect(isSignificant).to.be.true;
    });

    it("Should finalize successful tests", async function () {
      await governance.startABTest(proposalId, 1000);
      
      // Submit positive results
      await governance.submitTestResults(proposalId, true, 500, 60);
      await governance.submitTestResults(proposalId, false, 500, 50);
      
      // Advance time past test period
      await time.increase(15 * 86400);
      
      await governance.finalizeABTest(proposalId);
      
      const proposal = await governance.getProposal(proposalId);
      expect(proposal.status).to.equal(3); // SUCCESSFUL
    });
  });

  describe("Feature Sunset", function () {
    it("Should automatically sunset features after 180 days", async function () {
      // Create and execute a feature
      await governance.connect(proposer).createProposal(
        "Temporary Feature",
        "Description",
        "Hypothesis",
        1
      );
      
      await governance.connect(proposer).vote(0, true);
      await governance.connect(voter1).vote(0, true);
      await time.increase(4 * 86400);
      await governance.executeProposal(0);
      
      // Check feature is active
      expect(await governance.isFeatureActive(0)).to.be.true;
      
      // Advance time past sunset period
      await time.increase(181 * 86400);
      
      // Feature should be sunset
      expect(await governance.isFeatureActive(0)).to.be.false;
    });

    it("Should emit FeatureSunset event", async function () {
      await governance.connect(proposer).createProposal(
        "Feature",
        "Description",
        "Hypothesis",
        1
      );
      
      await governance.connect(proposer).vote(0, true);
      await time.increase(4 * 86400);
      await governance.executeProposal(0);
      
      await time.increase(181 * 86400);
      
      await expect(governance.checkFeatureSunset(0))
        .to.emit(governance, "FeatureSunset")
        .withArgs(0);
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow emergency pause", async function () {
      await governance.pause();
      
      await expect(
        governance.connect(proposer).createProposal(
          "During Pause",
          "Description",
          "Hypothesis",
          0
        )
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should allow cancelling proposals in emergency", async function () {
      await governance.connect(proposer).createProposal(
        "To Cancel",
        "Description",
        "Hypothesis",
        0
      );
      
      await governance.cancelProposal(0, "Security issue discovered");
      
      const proposal = await governance.getProposal(0);
      expect(proposal.status).to.equal(4); // CANCELLED
    });
  });

  describe("Contribution Tracking", function () {
    it("Should calculate voting power from contributions", async function () {
      const power = await governance.getVotingPower(proposer.address);
      expect(power).to.be.gt(0);
      
      // Should be based on token holdings
      const balance = await autophageToken.balanceOf(proposer.address, 0);
      expect(power).to.be.related(balance);
    });

    it("Should track historical contributions", async function () {
      const contributions = await governance.getUserContributions(voter1.address);
      expect(contributions.proposals).to.equal(0);
      expect(contributions.votes).to.equal(0);
      
      await governance.connect(voter1).vote(0, true);
      
      const updatedContributions = await governance.getUserContributions(voter1.address);
      expect(updatedContributions.votes).to.equal(1);
    });
  });
});