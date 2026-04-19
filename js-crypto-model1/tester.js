// const Block = require('./Block/block')

// const block = new Block('foo', 'bar', 'zoo', 'baz')
// console.log(block.toString())
// console.log(Block.genesis().toString())

// console.log(Block.mineBlock(Block.genesis(),'fooo').toString())

const Wallet = require('./wallet')
const wallet = new Wallet;
console.log(wallet.toString())