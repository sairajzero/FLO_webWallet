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
                lastSync = lastSync | 0;
                getNewTxs(addr, lastSync).then(APIresult => {
                    compactIDB.readData('transactions', addr).then(IDBresult => {
                        if (IDBresult === undefined)
                            var promise1 = compactIDB.addData('transactions', APIresult.items, addr)
                        else
                            var promise1 = compactIDB.writeData('transactions', IDBresult.concat(APIresult.items), addr)
                        var promise2 = compactIDB.writeData('lastSync', APIresult.totalItems, addr)
                        Promise.all([promise1, promise2]).then(values => resolve(APIresult.items))
                    })
                })
            }).catch(error => reject(error))
        })
    }

    //Get new Tx in blockchain since last sync using API
    function getNewTxs(addr, ignoreOld) {
        return new Promise((resolve, reject) => {
            floBlockchainAPI.readTxs(addr, 0, 1).then(response => {
                var newItems = response.totalItems - ignoreOld;
                if (newItems) {
                    floBlockchainAPI.readTxs(addr, 0, newItems * 2).then(response => {
                        var filteredData = [];
                        for (let i = 0; i < newItems; i++) {
                            var item = {
                                time: response.items[i].time,
                                txid: response.items[i].txid,
                                floData: response.items[i].floData
                            }
                            if (response.items[i].isCoinBase) {
                                item.sender = '(mined)' + response.items[i].vin[0].coinbase;
                                item.receiver = addr;
                            } else {
                                item.sender = response.items[i].vin[0].addr;
                                item.receiver = response.items[i].vout[0].scriptPubKey.addresses[0];
                            }
                            filteredData.unshift(item);
                        }
                        resolve({
                            totalItems: response.totalItems,
                            items: filteredData
                        });
                    }).catch(error => {
                        reject(error);
                    });
                } else
                    resolve({
                        totalItems: response.totalItems,
                        items: []
                    })
            }).catch(error => {
                reject(error);
            });
        });
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

})(window.floWebWallet = {});