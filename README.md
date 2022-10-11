# Shimmer NFT Tools

To start developing, please run the following commands:
```
npm install
cp src/config.example.ts src/config.ts 
npm run dist
npm start
```

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/huhn511/shimmer-nft-tools)

## Errors

Running script with a bigger `collectionSize`in `config.ts`.
```bash
Chaining together transactions via blocks...
Calculating PoW for block 1...
Calculating PoW for block 2...
Calculating PoW for block 3...
Calculating PoW for block 4...
Calculating PoW for block 5...
Calculating PoW for block 6...
Calculating PoW for block 7...
Calculating PoW for block 8...
Calculating PoW for block 9...
Calculating PoW for block 10...
Calculating PoW for block 11...
Submitting block 1...
ClientError: invalid parameter, error: failed to attach block: block is below max depth: invalid block: code=400, message=invalid parameter
    at SingleNodeClient.fetchJson (shimmer-nft-tools/node_modules/@iota/iota.js/dist/cjs/index-node.js:3177:19)
    at processTicksAndRejections (node:internal/process/task_queues:96:5)
    at async SingleNodeClient.blockSubmit (shimmer-nft-tools/node_modules/@iota/iota.js/dist/cjs/index-node.js:2889:30) {
  route: 'blocks',
  httpStatus: 400,
  code: '400'
}
```



## TODOs

- [ ] Calc max outputs for a tx and add many outputs as possible. Hint: Maximal outputs for a txs are 128, but because of metadata, the tx limit can be reached earlier.  