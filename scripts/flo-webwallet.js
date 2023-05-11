(function (EXPORTS) {
    /*FLO Web Wallet operations*/
    'use strict';
    const floWebWallet = EXPORTS;

    //generate a new Address triplet : resolves Object(floID,pubKey,privKey)
    floWebWallet.generateNewAddr = function () {
        return new Promise((resolve, reject) => {
            try {
                var triplet = floCrypto.generateNewID();
                resolve(triplet);
            } catch (error) {
                reject(error);
            }
        })
    }

    //recover triplet from given privKey : resolves Object(floID,pubKey,privKey)
    floWebWallet.recoverAddr = function (privKey) {
        return new Promise((resolve, reject) => {
            try {
                var triplet = {}
                triplet.privKey = privKey;
                triplet.pubKey = floCrypto.getPubKeyHex(triplet.privKey);
                triplet.floID = floCrypto.getFloID(triplet.pubKey);
                resolve(triplet);
            } catch (error) {
                reject(error);
            }
        })
    }

    //get balance of addr using API : resolves (balance)
    floWebWallet.getBalance = function (addr) {
        return new Promise((resolve, reject) => {
            floBlockchainAPI.getBalance(addr)
                .then(txid => resolve(txid))
                .catch(error => reject(error))
        })
    }

    //send transaction to the blockchain using API : resolves (txid)
    floWebWallet.sendTransaction = function (sender, receiver, amount, floData, privKey) {
        return new Promise((resolve, reject) => {
            floBlockchainAPI.sendTx(sender, receiver, amount, privKey, floData)
                .then(txid => resolve(txid))
                .catch(error => reject(error))
        })
    }

    //sync new transactions from blockchain using API and stores in IDB : resolves Array(newItems)
    floWebWallet.syncTransactions = function (addr) {
        return new Promise((resolve, reject) => {
            compactIDB.readData('lastSync', addr).then(lastSync => {
                const old_support = Number.isInteger(lastSync); //backward support
                let fetch_options = {};
                if (typeof lastSync == 'string' && /^[a-f0-9]{64}$/i.test(lastSync))    //txid as lastSync
                    fetch_options.after = lastSync;
                floBlockchainAPI.readAllTxs(addr, fetch_options).then(response => {
                    let newItems = response.items.map(({ time, txid, floData, isCoinBase, vin, vout }) => ({
                        time, txid, floData, isCoinBase,
                        sender: isCoinBase ? `(mined)${vin[0].coinbase}` : vin[0].addr,
                        receiver: isCoinBase ? addr : vout[0].scriptPubKey.addresses[0]
                    })).reverse();
                    compactIDB.readData('transactions', addr).then(IDBresult => {
                        if ((IDBresult === undefined || old_support))//backward support
                            IDBresult = [];
                        compactIDB.writeData('transactions', IDBresult.concat(newItems), addr).then(result => {
                            compactIDB.writeData('lastSync', response.lastItem, addr)
                                .then(result => resolve(newItems))
                                .catch(error => reject(error))
                        }).catch(error => reject(error))
                    })

                }).catch(error => reject(error))
            }).catch(error => reject(error))
        })
    }

    //read transactions stored in IDB : resolves Array(storedItems)
    floWebWallet.readTransactions = function (addr) {
        return new Promise((resolve, reject) => {
            compactIDB.readData('transactions', addr)
                .then(IDBresult => resolve(IDBresult))
                .catch(error => reject(error))
        })
    }

    //get address-label pairs from IDB : resolves Object(addr:label)
    floWebWallet.getLabels = function () {
        return new Promise((resolve, reject) => {
            compactIDB.readAllData('labels')
                .then(IDBresult => resolve(IDBresult))
                .catch(error => reject(error))
        })
    }

    //bulk transfer tokens
    floWebWallet.bulkTransferTokens = function (sender, privKey, token, receivers) {
        return new Promise((resolve, reject) => {
            floTokenAPI.bulkTransferTokens(sender, privKey, token, receivers)
                .then(result => resolve(result))
                .catch(error => reject(error))
        })
    }

})(window.floWebWallet = {});