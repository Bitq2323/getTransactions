const axios = require('axios');

// Function to check if a transaction supports RBF
function supportsRBF(vin) {
    return vin.some(input => input.sequence < 0xffffffff - 1);
}

module.exports = async (req, res) => {
    const addresses = req.query.address;
    if (!addresses) {
        res.status(400).send('Address parameter is required');
        return;
    }

    try {
        // Split the addresses string into an array of addresses
        const addressList = addresses.split(',');

        // Function to fetch transactions for a single address
        async function fetchTransactionsForAddress(address) {
            const url = `https://mempool.space/api/address/${address}/txs`;
            const response = await axios.get(url);
            return response.data;
        }

        // Fetch transactions for all addresses
        let allTransactions = [];
        for (const address of addressList) {
            const transactions = await fetchTransactionsForAddress(address);
            // Transform and add to the allTransactions array
            const transformed = transactions.map(tx => {
                const outputsValueToAddress = tx.vout
                    .filter(output => addressList.includes(output.scriptpubkey_address))
                    .reduce((sum, output) => sum + output.value, 0);

                const inputsValueFromAddress = tx.vin
                    .filter(input => input.prevout && addressList.includes(input.prevout.scriptpubkey_address))
                    .reduce((sum, input) => sum + input.prevout.value, 0);

                const balanceDiff = outputsValueToAddress - inputsValueFromAddress;

                return {
                    txid: tx.txid,
                    fee: tx.fee,
                    status: {
                        confirmed: tx.status.confirmed,
                        block_time: tx.status.block_time
                    },
                    vin: tx.vin.map(input => ({
                        prevout: {
                            scriptpubkey_address: input.prevout?.scriptpubkey_address
                        }
                    })),
                    vout: tx.vout.map(output => ({
                        scriptpubkey_address: output.scriptpubkey_address
                    })),
                    balance_diff: balanceDiff,
                    supportsRBF: supportsRBF(tx.vin)
                };
            });
            allTransactions = allTransactions.concat(transformed);
        }

        // Sort the transactions by block_time, unconfirmed first
        allTransactions.sort((a, b) => {
            if (a.status.confirmed && !b.status.confirmed) return 1;
            if (!a.status.confirmed && b.status.confirmed) return -1;
            return a.status.block_time - b.status.block_time;
        });

        res.status(200).json(allTransactions);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
};
