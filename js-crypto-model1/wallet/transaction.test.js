const Transaction = require('./transaction')
const Wallet = require('./index')

describe('Transaction', ()=>{
    let transaction, wallet, recipient, amount;

    beforeEach(()=>{
        wallet = new Wallet();
        amount = 50;
        recipient = 'r3c1p13nt';
        transaction = Transaction.newTransaction(wallet, recipient, amount);
    });
    it(`outputs the amount subtracted from the wallet balance`, ()=>{
        expect(transaction.outputs.find(output => output.address === wallet.publicKey).amount)
        .toEqual(wallet.balance - amount) 
    })

    it('inputs the balance of the wallet', ()=>{
        expect(transaction.input.amount).toEqual(wallet.balance)
    })
    it(`outputs the amount added to the recipient`, ()=>{
        expect(transaction.outputs.find(output => output.address === recipient).amount).toEqual(amount);
    })

    it('validates the valid transaction', ()=>{
        expect(Transaction.verifyTransaction(transaction)).toBe(true);
    })
    it('invalidates the corrupt transactions', ()=>{
        transaction.outputs[0] = 5000
        expect(Transaction.verifyTransaction(transaction)).toBe(false)
    })
    describe('and Updating a transactions', ()=>{
        let nextAmount, nextRecipient;
        beforeEach(()=>{
            nextAmount = 20;
            nextRecipient= 'n3xt-4ddr355';
            transaction = transaction.update(wallet, nextRecipient, nextAmount)
        })

        it('subtracts next amount fron senders output',()=>{
            expect(transaction.outputs.find(output => output.address === wallet.publicKey ).amount )
                .toEqual(wallet.balance - amount - nextAmount);
       })

       it('it outputs ammount for next receipient', ()=>{
        expect(transaction.outputs.find(output => output.address === nextRecipient).amount)
        .toEqual(nextAmount);
       })
    })

})