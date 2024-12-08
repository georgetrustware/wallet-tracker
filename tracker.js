require('dotenv').config();
const axios = require('axios');

// Load environment variables
const API_KEY = process.env.BASESCAN_API_KEY;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS;
const BASESCAN_API_URL = 'https://api.basescan.org/api';

// Store the most recent transaction hash to avoid duplicate processing
let lastTxHash = null;

// Function to fetch and analyze recent token transfers
async function fetchTokenTransfers() {
  try {
    const response = await axios.get(BASESCAN_API_URL, {
      params: {
        module: 'account',
        action: 'tokentx',
        address: WALLET_ADDRESS,
        sort: 'desc',
        apikey: API_KEY,
      },
    });

    const transactions = response.data.result;

    if (!transactions || transactions.length === 0) {
      console.log('No transactions found.');
      return;
    }

    // Find the index of the last processed transaction
    let startIndex = 0;
    if (lastTxHash) {
      startIndex = transactions.findIndex((tx) => tx.hash === lastTxHash);
      startIndex = startIndex === -1 ? 0 : startIndex + 1;
    }

    const newTransactions = transactions.slice(startIndex).reverse();

    // Process the new transactions
    for (const tx of newTransactions) {
      if (tx.to.toLowerCase() === WALLET_ADDRESS.toLowerCase()) {
        console.log(`\nToken Purchase Detected:`);
        console.log(`Transaction Hash: ${tx.hash}`);
        console.log(`Token: ${tx.tokenName} (${tx.tokenSymbol})`);
        console.log(`Amount: ${tx.value / Math.pow(10, tx.tokenDecimal)}`);
        console.log(`From: ${tx.from}`);
        console.log(`To: ${tx.to}`);
        console.log(`Timestamp: ${new Date(tx.timeStamp * 1000).toLocaleString()}`);
      }
    }

    // Update the last processed transaction hash
    if (transactions.length > 0) {
      lastTxHash = transactions[0].hash;
    }
  } catch (error) {
    console.error(`Error fetching token transfers: ${error.message}`);
  }
}

// Schedule the function to run periodically (e.g., every 30 seconds)
setInterval(fetchTokenTransfers, 30000);

// Initial run
fetchTokenTransfers();
