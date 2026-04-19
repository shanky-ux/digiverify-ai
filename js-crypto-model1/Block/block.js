const ChainUtil = require('../chain-util')

const {DIFFICULTY, MINE_RATE} = require('../config');

class Block{
    constructor(timestamp, lastHash, hash, data, nonce){
        this.timestamp = timestamp;
        this.lastHash= lastHash;
        this.hash = hash;
        this.data = data;
        this.nonce = nonce;
        this.difficulty = this.difficulty || DIFFICULTY;
    }

    toString(){
        return(`Block -
            Timestamp: ${this.timestamp}
            Last Hash: ${this.lastHash.substring(0,10)}
            Hash     : ${this.hash.substring(0,10)}
            Nonce    : ${this.nonce}
            Difficulty: ${this.difficulty}
            Data     : ${this.data}`);
    }

    static genesis(){
        return( new this('Genesis time', '_____', 'f1r57-h45h', [], 0))
    }

    static mineBlock(lastBlock, data){
        let hash, timestamp    
        const lastHash = lastBlock.hash;
        let {difficulty} = lastBlock
        let nonce = 0;
        do{
        nonce++;
        timestamp = Date.now();
        difficulty = Block.adjustDifficulty(lastBlock, timestamp);
        hash = Block.hash(timestamp, lastHash, data,nonce)
        }while(hash.substring(0, DIFFICULTY) !== '0'.repeat(DIFFICULTY));
        return new this(timestamp, lastHash, hash, data, nonce);
    }

    static hash(timestamp,lastHash, data, nonce, difficulty){
        return (ChainUtil.hash(`${timestamp}${lastHash}${data}${nonce}${difficulty}`).toString());
    }

    static blockHash(block){
        const {timestamp, lastHash, data, nonce} = block
        return Block.hash(timestamp, lastHash, data, nonce);
    }

    static adjustDifficulty(lastBlock, currentTime){
        let {difficulty} = lastBlock;
        difficulty = lastBlock.timestamp + MINE_RATE > currentTime ? difficulty + 1 : difficulty - 1;
        return difficulty;
    }
}

module.exports = Block;