import * as lib from "@iota/iota.js";
import { Converter, WriteStream } from "@iota/util.js";
import { Bip32Path, Ed25519 } from "@iota/crypto.js";
import { randomBytes } from "crypto";
import { NeonPowProvider } from "@iota/pow-neon.js";
import bigInt from "big-integer";
import * as console from "console";
import fetch from "node-fetch";

import config from "./config";

import {
  mintCollectionNft,
  createNftCollectionOutputs,
  mintCollectionNfts,
} from "./create_nft";

const EXPLORER = "https://explorer.shimmer.network/testnet";
const FAUCET = "https://faucet.testnet.shimmer.network/api/enqueue";

import {
  ADDRESS_UNLOCK_CONDITION_TYPE,
  BASIC_OUTPUT_TYPE,
  Bech32Helper,
  DEFAULT_PROTOCOL_VERSION,
  Ed25519Address,
  Ed25519Seed,
  ED25519_ADDRESS_TYPE,
  ED25519_SIGNATURE_TYPE,
  IBasicOutput,
  IBlock,
  IndexerPluginClient,
  IOutputsResponse,
  ITransactionEssence,
  ITransactionPayload,
  IUTXOInput,
  serializeTransactionEssence,
  SIGNATURE_UNLOCK_TYPE,
  SingleNodeClient,
  TransactionHelper,
  TRANSACTION_ESSENCE_TYPE,
  TRANSACTION_PAYLOAD_TYPE,
  UnlockTypes,
} from "@iota/iota.js";

async function run() {
  // Neon localPoW is blazingly fast, but you need rust toolchain to build
  const client = new SingleNodeClient(config.rpcEndpoint, {
    powProvider: new NeonPowProvider(),
  });
  const indexerPluginClient = new IndexerPluginClient(client);

  //Fetch node info
  const nodeInfo = await client.info();
  const protocolInfo = await client.protocolInfo();

  // calculate networkId
  const networkId = lib.TransactionHelper.networkIdFromNetworkName(
    nodeInfo.protocol.networkName
  );

  // Generate the seed from the Mnemonic
  const walletSeed = Ed25519Seed.fromMnemonic(config.mnemonic);
  // Generate the seed for the wallet
  //const walletSeed = new Ed25519Seed(randomBytes(32));

  // Use the new seed like a wallet with Bip32 Paths 44,4128,accountIndex,isInternal,addressIndex
  const walletPath = new Bip32Path("m/44'/4218'/0'/0'/0'");
  const walletAddressSeed = walletSeed.generateSeedFromPath(walletPath);
  const walletKeyPair = walletAddressSeed.keyPair();
  const walletEd25519Address = new Ed25519Address(walletKeyPair.publicKey);

  const newAddress = walletEd25519Address.toAddress();
  const newAddressHex = Converter.bytesToHex(newAddress, true);
  const newAddressBech32 = Bech32Helper.toBech32(
    ED25519_ADDRESS_TYPE,
    newAddress,
    nodeInfo.protocol.bech32Hrp
  );

  console.log("Wallet 1");
  console.log("\tSeed:", Converter.bytesToHex(walletSeed.toBytes()));
  console.log("\tPath:", walletPath.toString());
  console.log(`\tAddress Ed25519 ${walletPath.toString()}:`, newAddressHex);
  console.log(`\tAddress Bech32 ${walletPath.toString()}:`, newAddressBech32);

  // Fetch outputId with funds to be used as input from the Indexer API
  // Indexer returns outputIds of matching outputs. We are only interested in the first one coming from the faucet.
  const outputId = await fetchAndWaitForBasicOutput(
    newAddressBech32,
    indexerPluginClient
  );

  // Fetch the output itself from the core API
  const outputResponse = await client.output(outputId);
  // We start from one Basic Output that we own, Our journey starts with the genesis.
  const genesisOutput = outputResponse.output;
  const walletAddress = lib.Bech32Helper.addressFromBech32(
    newAddressBech32,
    nodeInfo.protocol.bech32Hrp
  );
  console.log("walletAddress: ", walletAddress);

  /************************************
   * 1. Prepare a transaction that creates a collection nft
   *  - input: basic output received from faucet
   *  - output: minted nft
   ************************************/

  console.log("Minting collection nft...");
  let collectionNft = mintCollectionNft(
    genesisOutput,
    outputId,
    newAddressHex,
    walletKeyPair,
    walletAddress,
    networkId
  );
  let txList = [];
  txList.push(collectionNft.txPayload);

  /****************************************************************************************
   * Current output ownership:
   *   - Main Hot Wallet: [tx1collectionNft, tx1Basic]
   *   - Receiver Hot Wallet: []
   ****************************************************************************************/
  /************************************
   * 2. Ready with the collection nft minting tx, now we have to prepare the second tx that:
   * - mint nfts (nft collection) via collectionNFT
   ************************************/
  const collectionNftAddress: lib.AddressTypes = {
    type: lib.NFT_ADDRESS_TYPE,
    nftId: lib.TransactionHelper.resolveIdFromOutputId(
      collectionNft.tx1CollectionNftOutputId
    ),
  };
  const nftCollectionOutputs = createNftCollectionOutputs(
    collectionNftAddress,
    walletAddress,
    newAddressBech32,
    config.collectionSize,
    nodeInfo
  );

  if (
    nftCollectionOutputs.totalDeposit >
    parseInt(collectionNft.tx1CollectionNftOutput.amount)
  ) {
    throw new Error(
      "Not enough funds to mint collection. Request funds from faucet:" + FAUCET
    );
  }

  // Split NFTs to send in chained txs
  const chunkSize = 10;
  const chunkArray = [];
  for (let i = 0; i < config.collectionSize; i += chunkSize) {
    const chunk = nftCollectionOutputs.outputs.slice(i, i + chunkSize);
    chunkArray.push(chunk);
  }
  console.log("Minting nft collection...");
  let tempOutput = collectionNft.tx1CollectionNftOutput;
  let tempOutputId = collectionNft.tx1CollectionNftOutputId;

  for (let index = 0; index < chunkArray.length; index++) {

    const [txPayload, prevCollectionNftOutputId, prevCollectionNft] =
      mintCollectionNfts(
        config.collectionSize,
        index == 0 ? true : false,
        tempOutput,
        tempOutputId,
        chunkArray[index], 
        tempOutput.amount,
        walletKeyPair,
        networkId
      );
    txList.push(txPayload);
    tempOutput = prevCollectionNft;
    tempOutputId = prevCollectionNftOutputId;
  }

  /****************************************************************************************
   * Current output ownership:
   *  - Main Hot Wallet: [tx1Basic, tx2CollectionNft, tx2Nft1, tx2Nft2, tx2Nft3, tx2Nft4, tx2Nft5]
   *  - Receiver Hot Wallet: []
   ****************************************************************************************/

  console.log("Chaining together transactions via blocks...");
  // Finally, time to prepare the three blocks, and chain them together via `parents`
  let blocks: lib.IBlock[] = await chainTrasactionsViaBlocks(
    client,
    txList,
    nodeInfo.protocol.minPowScore
  );

  // send the blocks to the network
  // We calculated pow by hand, so we don't define a localPow provider for the client so it doesn't redo the pow again.
  await submit(blocks, client);
}

// Use the indexer API to fetch the output sent to the wallet address by the faucet
async function fetchAndWaitForBasicOutput(
  addressBech32: string,
  client: lib.IndexerPluginClient
): Promise<string> {
  let outputsResponse: lib.IOutputsResponse = {
    ledgerIndex: 0,
    cursor: "",
    pageSize: "",
    items: [],
  };
  let maxTries = 15;
  let tries = 0;
  while (outputsResponse.items.length == 0) {
    if (tries > maxTries) {
      break;
    }
    tries++;
    console.log(
      `\tTry #${tries}: fetching basic output for address ${addressBech32}`
    );
    outputsResponse = await client.basicOutputs({
      addressBech32: addressBech32,
      hasStorageDepositReturn: false,
      hasExpiration: false,
      hasTimelock: false,
      hasNativeTokens: false,
    });
    if (outputsResponse.items.length == 0) {
      console.log("\tDidn't find any, retrying soon...");
      await new Promise((f) => setTimeout(f, 1500));
    }
  }
  if (tries > maxTries) {
    throw new Error(`Didn't find any outputs for address ${addressBech32}`);
  }
  return outputsResponse.items[0];
}

// The first block will have parents fetched from the tangle. The subsequent blocks refernce always the previous block as parent.
async function chainTrasactionsViaBlocks(
  client: lib.SingleNodeClient,
  txs: Array<lib.ITransactionPayload>,
  minPowScore: number
): Promise<Array<lib.IBlock>> {
  if (txs.length === 0) {
    throw new Error("can't create blocks from empty transaction payload list");
  }

  // we will chain the blocks together via their blockIds as parents
  let blockIds: Array<string> = [];
  let blocks: Array<lib.IBlock> = [];

  // parents for the first block
  let parents = (await client.tips()).tips;

  for (let i = 0; i < txs.length; i++) {
    let block: lib.IBlock = {
      protocolVersion: lib.DEFAULT_PROTOCOL_VERSION,
      parents: [],
      payload: txs[i],
      nonce: "0", // will be filled when calculating pow
    };

    if (i === 0) {
      // the first block  will have the fetched parents
      block.parents = parents;
    } else {
      // subsequent blocks reference the previous block
      block.parents = [blockIds[i - 1]];
    }

    // Calculate Pow
    console.log(`Calculating PoW for block ${i + 1}...`);
    const blockNonce = await caluclateNonce(block, minPowScore);

    // Update nonce field of the block
    block.nonce = blockNonce;

    // Calculate blockId
    const blockId = lib.TransactionHelper.calculateBlockId(block);

    // Add it to list of blockIds
    blockIds.push(blockId);

    // Add it to list of block
    blocks.push(block);
  }

  return blocks;
}

// Send an array of block in order to the node.
async function submit(blocks: Array<lib.IBlock>, client: lib.SingleNodeClient) {
  for (let i = 0; i < blocks.length; i++) {
    console.log(`Submitting block ${i + 1}...`);
    const blockId = await client.blockSubmit(blocks[i]);
    console.log(
      `Submitted block ${
        i + 1
      } blockId is ${blockId}, check out the transaction at ${EXPLORER}/block/${blockId}`
    );
  }
}

/***********************************************************************************************************************
 * UTILS
 ***********************************************************************************************************************/
// Performs PoW on a block to calculate nonce. Uses NeonPowProvider.
async function caluclateNonce(
  block: lib.IBlock,
  minPowScore: number
): Promise<string> {
  const writeStream = new WriteStream();
  lib.serializeBlock(writeStream, block);
  const blockBytes = writeStream.finalBytes();

  if (blockBytes.length > lib.MAX_BLOCK_LENGTH) {
    throw new Error(
      `The block length is ${blockBytes.length}, which exceeds the maximum size of ${lib.MAX_BLOCK_LENGTH}`
    );
  }

  const powProvider = new NeonPowProvider();
  const nonce = await powProvider.pow(blockBytes, minPowScore);
  return nonce.toString();
}

run()
  .then(() => console.log("Done"))
  .catch((err) => console.error(err));
