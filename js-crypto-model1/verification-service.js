/**
 * DigiVerify Blockchain Microservice
 *
 * Built directly on top of js-crypto-model1's existing classes:
 *   Blockchain  → Block.mineBlock (Proof-of-Work, SHA256)
 *   Wallet      → secp256k1 EC key pair, signs every event
 *   ChainUtil   → hash(), verifySignature(), genKeyPair()
 *
 * Every identity verification, document submission, approval, rejection, and
 * scheme application is mined into its own block, creating an immutable,
 * tamper-proof audit trail for the DigiVerify Government Scheme platform.
 *
 * Port: 3001  (override with BLOCKCHAIN_PORT env var)
 *
 * Endpoints:
 *   POST /chain/record           – Mine a new block for an event
 *   GET  /chain/blocks           – Full chain
 *   GET  /chain/stats            – Statistics
 *   GET  /chain/user/:userId     – Blocks for a user
 *   GET  /chain/verify/:hash     – Prove a hash exists in the chain
 *   GET  /chain/block/:index     – Single block by index
 *   GET  /chain/validate         – Validate chain integrity
 */

const express    = require('express');
const Blockchain = require('./blockchain.js/blockchain');
const Wallet     = require('./wallet');
const ChainUtil  = require('./chain-util');

const app = express();
app.use(express.json());

/* ── CORS: allow Flask (5000) and React (5173) to call us ──────────────────── */
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

/* ── Core instances (in-memory chain — persists until service restarts) ───── */
const blockchain   = new Blockchain();
const systemWallet = new Wallet();   // DigiVerify authority wallet — signs all events

console.log(`[DigiVerify Chain] System wallet: ${systemWallet.publicKey.substring(0,20)}...`);
console.log(`[DigiVerify Chain] Genesis block: ${blockchain.chain[0].hash}`);

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function parseRecord(block) {
  try {
    return typeof block.data === 'string' ? JSON.parse(block.data) : block.data;
  } catch {
    return block.data;
  }
}

function blockView(block, index) {
  return {
    index,
    timestamp:  block.timestamp,
    lastHash:   block.lastHash,
    hash:       block.hash,
    nonce:      block.nonce,
    difficulty: block.difficulty,
    record:     index === 0 ? { type: 'GENESIS', message: 'DigiVerify Blockchain Genesis' } : parseRecord(block),
  };
}

/* ── POST /chain/record ─────────────────────────────────────────────────────
 * Mine a new block containing the event record.
 * Body: { type, userId, data, recordedBy }
 * Returns: { blockHash, blockIndex, nonce, dataHash, issuerPublicKey, record }
 */
app.post('/chain/record', (req, res) => {
  const { type, userId, data, recordedBy } = req.body;

  if (!type || userId === undefined || userId === null) {
    return res.status(400).json({ error: 'type and userId are required' });
  }

  /* Build the event payload that will be stored in the block */
  const eventPayload = {
    type,
    userId:      Number(userId),
    data:        data || {},
    recordedBy:  recordedBy || 'system',
    issuedAt:    new Date().toISOString(),
    dataHash:    ChainUtil.hash({ type, userId: Number(userId), data: data || {} }),
  };

  /* Sign with system (DigiVerify authority) wallet */
  const contentHash = ChainUtil.hash(eventPayload);
  const sig         = systemWallet.sign(contentHash);
  eventPayload.signature     = { r: sig.r.toString(16), s: sig.s.toString(16) };
  eventPayload.issuerPublicKey = systemWallet.publicKey;

  /* Mine the block — calls Block.mineBlock (PoW, DIFFICULTY=4) */
  const block      = blockchain.addBlock(JSON.stringify(eventPayload));
  const blockIndex = blockchain.chain.length - 1;

  console.log(
    `[Block #${blockIndex}] type=${type} userId=${userId} ` +
    `hash=${block.hash.substring(0, 16)}... nonce=${block.nonce}`
  );

  res.json({
    success:         true,
    blockHash:       block.hash,
    blockIndex,
    nonce:           block.nonce,
    difficulty:      block.difficulty,
    timestamp:       block.timestamp,
    dataHash:        eventPayload.dataHash,
    issuerPublicKey: systemWallet.publicKey,
    record:          eventPayload,
  });
});

/* ── GET /chain/blocks ──────────────────────────────────────────────────────── */
app.get('/chain/blocks', (req, res) => {
  const chain = blockchain.chain.map(blockView);
  res.json({ length: blockchain.chain.length, chain });
});

/* ── GET /chain/stats ───────────────────────────────────────────────────────── */
app.get('/chain/stats', (req, res) => {
  const blocks = blockchain.chain.slice(1);
  const byType = {};

  blocks.forEach(b => {
    const rec = parseRecord(b);
    if (rec && rec.type) byType[rec.type] = (byType[rec.type] || 0) + 1;
  });

  const last = blockchain.chain[blockchain.chain.length - 1];

  res.json({
    chainLength:     blockchain.chain.length,
    totalRecords:    blocks.length,
    byType,
    lastBlockHash:   last.hash,
    lastBlockIndex:  blockchain.chain.length - 1,
    isValid:         blockchain.isValidChain(blockchain.chain),
    systemPublicKey: systemWallet.publicKey,
  });
});

/* ── GET /chain/user/:userId ─────────────────────────────────────────────────── */
app.get('/chain/user/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid userId' });

  const userBlocks = blockchain.chain
    .map(blockView)
    .slice(1)
    .filter(b => b.record && b.record.userId === userId);

  res.json({ userId, count: userBlocks.length, blocks: userBlocks });
});

/* ── GET /chain/verify/:hash ──────────────────────────────────────────────────
 * Prove a block hash exists in the immutable chain. */
app.get('/chain/verify/:hash', (req, res) => {
  const { hash } = req.params;
  const idx      = blockchain.chain.findIndex(b => b.hash === hash);

  if (idx === -1) {
    return res.json({ valid: false, message: 'Hash not found in blockchain' });
  }

  const block  = blockchain.chain[idx];
  const record = parseRecord(block);

  res.json({
    valid:      true,
    blockIndex: idx,
    timestamp:  block.timestamp,
    nonce:      block.nonce,
    difficulty: block.difficulty,
    record,
    message:    `Hash verified — exists as Block #${idx} in the DigiVerify chain`,
  });
});

/* ── GET /chain/block/:index ──────────────────────────────────────────────────── */
app.get('/chain/block/:index', (req, res) => {
  const index = parseInt(req.params.index);
  const block = blockchain.chain[index];
  if (!block) return res.status(404).json({ error: 'Block not found' });
  res.json(blockView(block, index));
});

/* ── GET /chain/validate ──────────────────────────────────────────────────────── */
app.get('/chain/validate', (req, res) => {
  const isValid = blockchain.isValidChain(blockchain.chain);
  res.json({
    valid:       isValid,
    chainLength: blockchain.chain.length,
    message:     isValid
      ? 'Chain integrity verified — all blocks are valid and linked'
      : 'WARNING: Chain integrity check FAILED — possible tampering detected',
  });
});

/* ── Start ───────────────────────────────────────────────────────────────────── */
const PORT = process.env.BLOCKCHAIN_PORT || 3001;
app.listen(PORT, () => {
  console.log('\n+--------------------------------------------+');
  console.log('|  DigiVerify Blockchain Service             |');
  console.log(`|  http://localhost:${PORT}                       |`);
  console.log('|  Proof-of-Work (SHA256) + secp256k1 sigs  |');
  console.log('+--------------------------------------------+\n');
});
