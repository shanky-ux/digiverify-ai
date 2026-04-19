const Block = require('./block')
const {DIFFICULTY} = require('../config');
describe('Block', ()=>{
    let data, lastBlock, block;
     beforeEach(()=>{
        data = 'bar';
        lastBlock = Block.genesis();
        block = Block.mineBlock(lastBlock, data)
     })

     it('sets the `data` to match the input', ()=>{
        expect(block.data).toEqual(data)
     })

     it("set the `lastHash` to match the hash of the last block", ()=>{
        expect(block.lastHash).toEqual(lastBlock.hash)
      })
      it("it generates the hash that matches the difficulty", ()=>{
         expect(block.hash.substring(0, DIFFICULTY))
         .toEqual('0'.repeat(DIFFICULTY));

         console.log(block.toString());
      })
      it('lowers the difficulty for slow mined block', ()=>{
         expect(Block.adjustDifficulty(block, block.timestamp+360000)).toEqual(block.difficulty-1)
      })

})