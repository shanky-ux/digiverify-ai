const express = require('express')
const bodyParser = require('body-parser')
const P2pServer = require('./p2p-server')
const Blockchain = require('./blockchain.js/blockchain')
const Wallet = require('./wallet');
const TransactionPool = require('./wallet/transaction-pool')
const Miner = require('./miner');

const app = express()
app.use(bodyParser.json())

const bc = new Blockchain()
const wallet = new Wallet();
const tp = new TransactionPool();
const p2pServer = new P2pServer(bc, tp);
const miner = new Miner(bc, tp, wallet, p2pServer);
app.get("/blocks", async(req, resp)=>{
    resp.json(bc.chain)
})

app.post('/mine',(req, resp)=>{
    const block = bc.addBlock(req.body.data);
    console.log("new block added", block.toString());
    p2pServer.syncChain();
    resp.redirect('/blocks')
})
app.listen(3001, ()=>{
    console.log("app is running on the port 3001")
})

app.get('/transactions', (req, resp)=>{
    resp.json(tp.transactions);
})

app.post('/transact', (req,resp)=>{
    const {recipient, amount} = req.body;
    const transaction = wallet.createTransaction(recipient, amount, tp); 
    P2pServer.broadcastTransaction(transaction)
    resp.redirect('/transactions')
})

app.get('/public-key',(req, resp)=>{
    resp.json({ publickey: wallet.publicKey});
})

app.get('/mine-transactions', (req, resp)=>{
    const block = miner.mine();
    console.log(`New block added: ${block.toString()}`);
    resp.redirect('/blocks');
})

p2pServer.listen();