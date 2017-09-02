# Blockchain - Playground

### Introduction
This project (forked from [naivechain](https://github.com/lhartikk/naivechain)) is designed to provide a simple playground to help learn the basic concept of blockchain.

### What is Blockchain
The blockchain is an open, decentralized ledger, which is best described as a continuously growing list of records (called blocks) that are linked and secured using cryptography. More information can be found at  [LifeinTECH](http://lifeintech.com/2014/01/27/Blockchain/).

### Key Features
The following features are included:

* Written in JavaScript, with a focus on readability.
* HTTP interface to control each node.
* Websockets to communicate between nodes (Peer-to-Peer).
* No persisted storage, instead an in-memory Javascript array is used.
* No consensus algorithm (yet), meaning a block can be added without competition.

More details can be found at [LifeinTECH](http://www.lifeintech.com).

### Getting Started ([Docker](http://www.docker.com))
##### Create and Start Three Nodes
```
docker-compose up
```
##### Start Node
```
docker container start -i naivechain_node1_1
docker container start -i naivechain_node2_1
docker container start -i naivechain_node3_1
```
##### Stop Node
```
docker container stop naivechain_node1_1
docker container stop naivechain_node2_1
docker container stop naivechain_node3_1
```

### Node Information
##### Ports for HTTP and Websockets
```
node1 = HTTP:3001 / WS:6001 (172.18.0.2)
node2 = HTTP:3002 / WS:6002 (172.18.0.3)
node3 = HTTP:3003 / WS:6003 (172.18.0.4)
```

### API
##### Create Block
```
curl -H "Content-type:application/json" --data '{"data" : "Node 01 - Block 01"}' http://localhost:3001/mineBlock
curl -H "Content-type:application/json" --data '{"data" : "Node 01 - Block 02"}' http://localhost:3001/mineBlock
curl -H "Content-type:application/json" --data '{"data" : "Node 01 - Block 03"}' http://localhost:3001/mineBlock

curl -H "Content-type:application/json" --data '{"data" : "Node 02 - Block 01"}' http://localhost:3002/mineBlock
curl -H "Content-type:application/json" --data '{"data" : "Node 02 - Block 02"}' http://localhost:3002/mineBlock
curl -H "Content-type:application/json" --data '{"data" : "Node 02 - Block 03"}' http://localhost:3002/mineBlock

curl -H "Content-type:application/json" --data '{"data" : "Node 03 - Block 01"}' http://localhost:3003/mineBlock
curl -H "Content-type:application/json" --data '{"data" : "Node 03 - Block 02"}' http://localhost:3003/mineBlock
curl -H "Content-type:application/json" --data '{"data" : "Node 03 - Block 03"}' http://localhost:3003/mineBlock
```
##### Get Blockchain
```
curl http://localhost:3001/blocks
curl http://localhost:3002/blocks
curl http://localhost:3003/blocks
```
##### Add Peer
```
curl -H "Content-type:application/json" --data '{"peer" : "ws://localhost:6002"}' http://localhost:3001/addPeer
curl -H "Content-type:application/json" --data '{"peer" : "ws://localhost:6003"}' http://localhost:3001/addPeer

curl -H "Content-type:application/json" --data '{"peer" : "ws://localhost:6001"}' http://localhost:3002/addPeer
curl -H "Content-type:application/json" --data '{"peer" : "ws://localhost:6003"}' http://localhost:3002/addPeer

curl -H "Content-type:application/json" --data '{"peer" : "ws://localhost:6001"}' http://localhost:3003/addPeer
curl -H "Content-type:application/json" --data '{"peer" : "ws://localhost:6002"}' http://localhost:3003/addPeer
```
##### Query Peers
```
curl http://localhost:3001/peers
curl http://localhost:3002/peers
curl http://localhost:3003/peers
```
