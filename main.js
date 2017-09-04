'use strict';
var CryptoJS = require('crypto-js');
var express = require('express');
var bodyParser = require('body-parser');
var WebSocket = require('ws');
var Colors = require('colors');

// Connection parameters
var http_port = process.env.HTTP_PORT || 3001;
var p2p_port = process.env.P2P_PORT || 6001;
var initialPeers = process.env.PEERS ? process.env.PEERS.split(',') : [];

// Class definition
class Block {
    constructor(index, previousHash, timestamp, data, hash) {
        this.index = index;
        this.previousHash = previousHash.toString();
        this.timestamp = timestamp;
        this.data = data;
        this.hash = hash.toString();
    }
}

// Array of available sockets
var sockets = [];

// Messages definition
var MessageType = {
    QUERY_LATEST: 0,
    QUERY_ALL: 1,
    RESPONSE_BLOCKCHAIN: 2
};

// Genesis block generator
var getGenesisBlock = () => {
    return new Block(
      0,
      "0",
      1465154705,
      "Genesis Block",
      "816534932c2b7154836da6afc367695e6337db8a921823784c14378abed4f7d7");
};

// In-memory blockchain storage
var blockchain = [getGenesisBlock()];

// HTTP server
var initHttpServer = () => {
    var app = express();
    app.use(bodyParser.json());

    app.get('/blocks', (req, res) => res.send(JSON.stringify(blockchain)));
    app.post('/mineBlock', (req, res) => {
        var newBlock = generateNextBlock(req.body.data);
        addBlock(newBlock);
        broadcast(responseLatestMsg());
        console.log('Block added: '.green + JSON.stringify(newBlock) + '\n');
        res.send();
    });
    app.post('/mineBlocks', (req, res) => {
        var body = req.body;
        for (var i = 0; i < body.length; i++) {
            var newBlock = generateNextBlock(body[i].data);
            addBlock(newBlock);
            broadcast(responseLatestMsg());
            console.log('Block added: '.green + JSON.stringify(newBlock) + '\n');
        }
        res.send();
    });
    app.get('/peers', (req, res) => {
        res.send(sockets.map(s => s._socket.remoteAddress + ':' + s._socket.remotePort));
    });
    app.post('/addPeer', (req, res) => {
        connectToPeers([req.body.peer]);
        res.send();
    });
    app.listen(http_port, () => console.log('Listening HTTP on port: '.yellow + http_port + '. \n'));
};

// WebSocket server
var initP2PServer = () => {
    var server = new WebSocket.Server({port: p2p_port});
    server.on('connection', ws => initConnection(ws));
    console.log('Listening WebSocket P2P port: '.yellow + p2p_port + '. \n');

};

// WebSocket connector
var initConnection = (ws) => {
    sockets.push(ws);
    initMessageHandler(ws);
    initErrorHandler(ws);
    write(ws, queryChainLengthMsg());
};

// WebSocket message handler
var initMessageHandler = (ws) => {
    ws.on('message', (data) => {
        var message = JSON.parse(data);
        console.log('Received message: '.green + JSON.stringify(message) + '\n');
        switch (message.type) {
            case MessageType.QUERY_LATEST:
                write(ws, responseLatestMsg());
                break;
            case MessageType.QUERY_ALL:
                write(ws, responseChainMsg());
                break;
            case MessageType.RESPONSE_BLOCKCHAIN:
                handleBlockchainResponse(message);
                break;
        }
    });
};

// WebSocket error handler
var initErrorHandler = (ws) => {
    var closeConnection = (ws) => {
        console.log('Connection failed to peer: '.red + ws.url + '. \n');
        sockets.splice(sockets.indexOf(ws), 1);
    };
    ws.on('close', () => closeConnection(ws));
    ws.on('error', () => closeConnection(ws));
};

// Block generator
var generateNextBlock = (blockData) => {
    var previousBlock = getLatestBlock();
    var nextIndex = previousBlock.index + 1;
    var nextTimestamp = new Date().getTime() / 1000;
    var nextHash = calculateHash(
      nextIndex,
      previousBlock.hash,
      nextTimestamp,
      blockData
    );
    return new Block(
      nextIndex,
      previousBlock.hash,
      nextTimestamp,
      blockData,
      nextHash
    );
};

// Block hash generator
var calculateHashForBlock = (block) => {
    return calculateHash(
      block.index,
      block.previousHash,
      block.timestamp,
      block.data
    );
};

// Hash calculation utility
var calculateHash = (index, previousHash, timestamp, data) => {
    return CryptoJS.SHA256(index + previousHash + timestamp + data).toString();
};

// Block adding utility
var addBlock = (newBlock) => {
    if (isValidNewBlock(newBlock, getLatestBlock())) {
        blockchain.push(newBlock);
    }
};

// Block validation utility
var isValidNewBlock = (newBlock, previousBlock) => {
    if (previousBlock.index + 1 !== newBlock.index) {
        console.log('Invalid index. \n'.red);
        return false;
    } else if (previousBlock.hash !== newBlock.previousHash) {
        console.log('Invalid previoushash. \n'.red);
        return false;
    } else if (calculateHashForBlock(newBlock) !== newBlock.hash) {
        console.log(typeof (newBlock.hash) + ' ' + typeof calculateHashForBlock(newBlock));
        console.log('Invalid hash: '.red + calculateHashForBlock(newBlock) + ' ' + newBlock.hash + '\n');
        return false;
    }
    return true;
};

// Peer connection utility
var connectToPeers = (newPeers) => {
    newPeers.forEach((peer) => {
        var ws = new WebSocket(peer);
        ws.on('open', () => initConnection(ws));
        ws.on('error', () => {
            console.log('Connection failed. \n'.red)
        });
    });
};

// Blockchain response handler
var handleBlockchainResponse = (message) => {
    var receivedBlocks = JSON.parse(message.data).sort((b1, b2) => (b1.index - b2.index));
    var latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
    var latestBlockHeld = getLatestBlock();
    if (latestBlockReceived.index > latestBlockHeld.index) {
        console.log('Blockchain possibly behind. We got: '.yellow + latestBlockHeld.index + '. Peer got: '.yellow + latestBlockReceived.index + '. \n');
        if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
            console.log('We can append the received block to our chain. \n'.yellow);
            blockchain.push(latestBlockReceived);
            broadcast(responseLatestMsg());
        } else if (receivedBlocks.length === 1) {
            console.log('We have to query the blockchain from our peer. \n'.yellow);
            broadcast(queryAllMsg());
        } else {
            console.log('Received blockchain is longer than current blockchain. \n'.yellow);
            replaceChain(receivedBlocks);
        }
    } else {
        console.log('Received blockchain is not longer than received blockchain. Do nothing. \n'.yellow);
    }
};

// Longest chain seletor
var replaceChain = (newBlocks) => {
    if (isValidChain(newBlocks) && newBlocks.length > blockchain.length) {
        console.log('Received blockchain is valid. Replacing current blockchain with received blockchain. \n'.yellow);
        blockchain = newBlocks;
        broadcast(responseLatestMsg());
    } else {
        console.log('Received blockchain invalid. \n'.red);
    }
};

// Chain validation
var isValidChain = (blockchainToValidate) => {
    if (JSON.stringify(blockchainToValidate[0]) !== JSON.stringify(getGenesisBlock())) {
        return false;
    }
    var tempBlocks = [blockchainToValidate[0]];
    for (var i = 1; i < blockchainToValidate.length; i++) {
        if (isValidNewBlock(blockchainToValidate[i], tempBlocks[i - 1])) {
            tempBlocks.push(blockchainToValidate[i]);
        } else {
            return false;
        }
    }
    return true;
};

// Service startup
var getLatestBlock = () => blockchain[blockchain.length - 1];
var queryChainLengthMsg = () => ({'type': MessageType.QUERY_LATEST});
var queryAllMsg = () => ({'type': MessageType.QUERY_ALL});
var responseChainMsg = () =>({
    'type': MessageType.RESPONSE_BLOCKCHAIN, 'data': JSON.stringify(blockchain)
});
var responseLatestMsg = () => ({
    'type': MessageType.RESPONSE_BLOCKCHAIN,
    'data': JSON.stringify([getLatestBlock()])
});

var write = (ws, message) => ws.send(JSON.stringify(message));
var broadcast = (message) => sockets.forEach(socket => write(socket, message));

connectToPeers(initialPeers);
initHttpServer();
initP2PServer();
