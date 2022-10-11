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

```bash
Chaining together transactions via blocks...
Calculating PoW for block 1...
Calculating PoW for block 2...
Submitting block 1...
ClientError: invalid parameter, error: failed to attach block: block is below max depth: invalid block: code=400, message=invalid parameter
    at SingleNodeClient.fetchJson (/shimmer-nft-tools/node_modules/@iota/iota.js/dist/cjs/index-node.js:3177:19)
    at processTicksAndRejections (node:internal/process/task_queues:96:5)
    at async SingleNodeClient.blockSubmit (/shimmer-nft-tools/node_modules/@iota/iota.js/dist/cjs/index-node.js:2889:30) {
  route: 'blocks',
  httpStatus: 400,
  code: '400'
}

```