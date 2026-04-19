const Transaction = require('./wallet/transaction');
const Wallet = require('./wallet');

class Miner{
    constructor(blockchain, transactionpool, wallet, p2pServer){
        this.blockchain = blockchain;
        this.transactionpool = transactionpool;
        this.wallet = wallet;
        this.p2pServer = p2pServer
    }

    mine(){
        const validTransactions = this.transactionpool.validTransaction();
        // Include a reward for the miner
        validTransactions.push(
            Transaction.rewardTransaction(this.wallet, Wallet.blockchainWallet())
        );
        // Create a block consisting of the valid transactions
        const block = this.blockchain.addBlock(validTransactions);
        // Synchronize the chains in the peer-to-peer server
        this.p2pServer.syncChain();
        // Clear the transaction pool
        this.transactionpool.clear();
        // Broadcast to every miner to clear their transaction pools
        this.p2pServer.broadcastClearTransactions();

        return block;
    }
}

module.exports = Miner