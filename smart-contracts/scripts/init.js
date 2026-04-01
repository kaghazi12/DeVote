const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const configPath = path.join(__dirname, "deployedAddress.json");

  if (!fs.existsSync(configPath)) {
    console.error("Deployed address not found. Please run 'npx hardhat run scripts/deploy.js' first.");
    process.exitCode = 1;
    return;
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const votingAddress = config.votingAddress;

  console.log("Initializing contract at:", votingAddress);

  const Voting = await hre.ethers.getContractFactory("Voting");
  const voting = Voting.attach(votingAddress);

  // The contract hardcodes an admin address; find a signer that matches it
  /*const HARD_CODED_ADMIN = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8".toLowerCase();
  const signers = await hre.ethers.getSigners();
  const adminSigner = signers.find(s => s.address.toLowerCase() === HARD_CODED_ADMIN);
  
  if (!adminSigner) {
    console.error("No local signer matches the hardcoded on-chain admin:", HARD_CODED_ADMIN);
    console.error("Please import the admin private key into your local node or update the contract admin.");
    process.exitCode = 1;
    return;
  }*/
  const [adminSigner] = await hre.ethers.getSigners();
  console.log("Using admin account:", adminSigner.address);

  // Get current blockchain timestamp
  const currentBlock = await hre.ethers.provider.getBlock('latest');
  const currentTimestamp = currentBlock.timestamp;
  console.log("Current blockchain timestamp:", currentTimestamp);

  // Election durations (in seconds)
  const election1Duration = 600; // 10 minutes for testing
  const election2Duration = 94672800; // 3 years

  const tx1 = await voting.connect(adminSigner).createElection("Student Council 2025", ["Alice", "Bob", "Charlie"], election1Duration);
  await tx1.wait();
  console.log("First election created (10 seconds duration)");

  const tx2 = await voting.connect(adminSigner).createElection("Best Coding Language", ["JavaScript", "Python", "Rust", "Go"], election2Duration);
  await tx2.wait();
  console.log("Second election created (1 hour duration)");

  // Save election metadata to file for frontend to use
  const electionsMetadata = [
    {
      id: 1,
      name: "Student Council 2025",
      duration: election1Duration,
      endTime: currentTimestamp + election1Duration
    },
    {
      id: 2,
      name: "Best Coding Language",
      duration: election2Duration,
      endTime: currentTimestamp + election2Duration
    }
  ];

  const metadataPath = path.join(__dirname, "..", "..", "client", "public", "electionsMetadata.json");
  fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
  fs.writeFileSync(metadataPath, JSON.stringify(electionsMetadata, null, 2));
  console.log("Election metadata saved to:", metadataPath);

  console.log("Election and candidates initialized successfully!");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
