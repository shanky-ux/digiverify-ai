const TransactionPool  = require('./transaction-pool');
const Transaction = require('./transaction');
const Wallet = require('./index')

describe('TransactionPool', ()=> {
    let tp, wallet, transaction;

    beforeEach(()=>{
        tp = new TransactionPool();
        wallet  = new Wallet();
        // transaction = Transaction.newTransaction(wallet, 'rAnd-4ddr355', 30);
        // tp.updateOrAddTransaction(transaction);
        transaction = wallet.createTransaction('r4nd-4dr355', 30, tp);
    })

    it('adds transactions to the pool', ()=>{
        expect(tp.transactions.find(t => t.id === transaction.id)).toEqual(transaction);
    });

    it('updates transaction in the pool', ()=>{
        const oldTransaction = JSON.stringify(transaction);
        const newTransaction = transaction.update(wallet, 'foo-4ddr355', 40);
        tp.updateOrAddTransaction(newTransaction);

        expect(JSON.stringify(tp.transactions.find(t => t.id === newTransaction.id )))
        .not.toEqual(oldTransaction);
    });
    it('clones the `sendAmount` output for the recipient',()=>{
        const recipient = 'r4nd-4dr355';
        const sendAmount = 30;
        transaction.update(wallet, recipient, sendAmount);
        expect(transaction.outputs.filter(output => output.address === recipient)
            .map(output => output.amount)).toEqual([sendAmount, sendAmount])
    })

    describe('mixing valid and corrupt transactions', ()=>{
        let validTransaction;
        beforeEach(()=>{
            validTransaction = [transaction]
            for(let i = 0; i <6; i ++){
                wallet = new Wallet();
                transaction = wallet.createTransaction('r4nd-4ddr355', 30, tp)
                if(i%2== 0){
                    transaction.input.amount = 99999;
                } else {
                    validTransaction.push(transaction);
                }
            }
        })

        it('shows difference between valid and invalid transactions', ()=>{
            expect(JSON.stringify(tp.transaction)).not.toEqual(JSON.stringify(validTransaction));
        })

        it('grabs valid transactions', () => {
            expect(tp.validTransaction()).toEqual(validTransaction)
        })

    })
})