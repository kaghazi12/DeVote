require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();  // ← make sure this line is there

module.exports = {
  solidity: "0.8.28",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts: {
        mnemonic: "test test test test test test test test test test test junk"
      }
    },
    sepolia: {                              // ADD THIS BLOCK
      url: process.env.SEPOLIA_RPC_URL,
      accounts: [`0x${process.env.PRIVATE_KEY}`]
    }
  }
};
