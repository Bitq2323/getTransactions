const axios = require('axios');

// Function to check if a transaction supports RBF
function supportsRBF(vin) {
    return vin.some(input => input.sequence < 0xffffffff - 1);
}

module.exports = async (req, res) => {
    const address = req.query.address;
    if (!address) {
        res.status(400).send('Address parameter is required');
        return;
    }

    try {
        const url = `https://mempool.space/api/address/${address}/txs`;
        const response = await axios.get(url);

        const transformedData = response.data.map(tx => {
            const outputsValueToAddress = tx.vout
                .filter(output => output.scriptpubkey_address === address)
                .reduce((sum, output) => sum + output.value, 0);

            const inputsValueFromAddress = tx.vin
                .filter(input => input.prevout && input.prevout.scriptpubkey_address === address)
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

        res.status(200).json(transformedData);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
};
