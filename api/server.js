const express = require('express');
const app = express();
const port = 3000;

// Assuming your index.js exports a function called 'getTransactions' or similar
const getTransactions = require('./getBitcoinAddressTransactions');

app.get('/transactions', async (req, res) => {
    // Directly use the exported function from index.js
    await getTransactions(req, res);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
