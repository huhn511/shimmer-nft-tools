import * as lib from "@iota/iota.js"
import { Converter, WriteStream } from "@iota/util.js";
import { Bip32Path, Ed25519 } from "@iota/crypto.js";
import bigInt from "big-integer";

/***********************************************************************************************************************
 * FUNCTIONS TO CREATE THE TRANSACTIONS
 ***********************************************************************************************************************/

 // export function mintCollectionNft(consumedOutput: lib.OutputTypes, consumedOutputId: string, walletAddressHex: string, walletKeyPair: lib.IKeyPair, targetAddress: lib.AddressTypes, networkId: any): lib.ITransactionPayload{
 export function mintCollectionNft(consumedOutput: lib.OutputTypes, consumedOutputId: string, walletAddressHex: string, walletKeyPair: lib.IKeyPair, targetAddress: lib.AddressTypes, networkId: any): any{
    
    console.log("0")
    // Prepare inputs to the tx
    const input = lib.TransactionHelper.inputFromOutputId(consumedOutputId);
    console.log("1, input: ", input)
    console.log("1, consumedOutput.amount: ", consumedOutput.amount)
    console.log("1, value: ", parseInt(consumedOutput.amount) / 2)
    console.log("1, value: new ", Math.ceil(parseInt(consumedOutput.amount) / 2))
    
    // Create the outputs, that is an NFT output
    let nftOutput: lib.INftOutput = {
        type: lib.NFT_OUTPUT_TYPE,
        amount: (Math.ceil(parseInt(consumedOutput.amount) / 2)).toString(),  // We could put only requiredStorageDepoist into the nft output, but we will mint nft collection so we are going to transfer half of the basic output amount.
        // when minting, this has to be set to zero. It will be set in nodes as the hash of the outputId when the tx confirms.
        // Note, that from the first spend of the NFT you have to use the actual hash of outputId
        nftId: "0x0000000000000000000000000000000000000000000000000000000000000000",
        immutableFeatures: [
            {
                type: lib.ISSUER_FEATURE_TYPE, // Issuer feature
                address: {
                    type: lib.ED25519_ADDRESS_TYPE,
                    pubKeyHash: walletAddressHex,
                },
            },
            {
                type: lib.METADATA_FEATURE_TYPE, // Metadata Feature
                data: Converter.utf8ToHex("This is where the immutable NFT metadata goes.", true)
            }
        ],
        unlockConditions: [
            {
                type: lib.ADDRESS_UNLOCK_CONDITION_TYPE,
                address: targetAddress, // minting it directly onto target addressBech32
            }
        ]
    }
    console.log("2, nftOutput: ", nftOutput)
    
    // create basic output for the reminder amount
    const remainderOutput: lib.IBasicOutput = {
        type: lib.BASIC_OUTPUT_TYPE,
        amount: (Math.ceil(parseInt(consumedOutput.amount) / 2)).toString(), // we return the other half as a reminder
        nativeTokens: [],
        unlockConditions: [
            // Send it to the target address
            {
                type: lib.ADDRESS_UNLOCK_CONDITION_TYPE,
                address: targetAddress,
            }
        ],
        features: [],
    }
    
    console.log("3, remainderOutput: ", remainderOutput)
    // Prepare Tx essence
    // InputsCommitment calculation
    const inputsCommitment = lib.TransactionHelper.getInputsCommitment([consumedOutput]);
    console.log("4")
    
    // Creating Transaction Essence
    const txEssence: lib.ITransactionEssence = {
        type: lib.TRANSACTION_ESSENCE_TYPE,
        networkId: networkId,
        inputs: [input],
        outputs: [nftOutput, remainderOutput],
        inputsCommitment: inputsCommitment,
    };
    console.log("5, txEssence: ", txEssence)
    // Calculating Transaction Essence Hash (to be signed in signature unlocks)
    const essenceHash = lib.TransactionHelper.getTransactionEssenceHash(txEssence)
    console.log("6")
    
    // We unlock only one output, so there will be one unlock with signature
    let unlock: lib.ISignatureUnlock = {
        type: lib.SIGNATURE_UNLOCK_TYPE,
        signature: {
            type: lib.ED25519_SIGNATURE_TYPE,
            publicKey: Converter.bytesToHex(walletKeyPair.publicKey, true),
            signature: Converter.bytesToHex(Ed25519.sign(walletKeyPair.privateKey, essenceHash), true)
        }
    };
    console.log("7")
    
    // Constructing Transaction Payload
    const txPayload: lib.ITransactionPayload = {
        type: lib.TRANSACTION_PAYLOAD_TYPE,
        essence: txEssence,
        unlocks: [unlock]
    };
    
    console.log("8")
    // Record some info for ourselves
    let nftOutputId = Converter.bytesToHex(lib.TransactionHelper.getTransactionPayloadHash(txPayload), true) + "0000";
    console.log("9")
    let basicOutputId = Converter.bytesToHex(lib.TransactionHelper.getTransactionPayloadHash(txPayload), true) + "0100";
    console.log("10")

    // ctx.outputIdByName?.set("tx1CollectionNft", nftOutputId);
    // ctx.outputByName?.set("tx1CollectionNft", nftOutput);
    // ctx.outputIdByName?.set("tx1Basic", basicOutputId);
    // ctx.outputByName?.set("tx1Basic", remainderOutput);


        console.log("tx1CollectionNft", nftOutputId)
        console.log("tx1CollectionNft", nftOutput)
        console.log("tx1Basic", basicOutputId)
        console.log("tx1Basic", remainderOutput)
const obj = {
    tx1CollectionNftOutputId: nftOutputId,
    tx1CollectionNftOutput: nftOutput,
    tx1BasicOutputId: basicOutputId,
    tx1BasicRemainderOutput: remainderOutput,
    txPayload: txPayload,
}

    return obj;
}


//Create NFT collection outputs that will be mionted using collectionNft
export function createNftCollectionOutputs(issuerAddress: lib.INftAddress, targetAddress: lib.AddressTypes, royaltyAddress: string, collectionSize: number, nodeInfo: lib.INodeInfo): { outputs: lib.INftOutput[], totalDeposit: number }{
    let nftCollection: {
        outputs: lib.INftOutput[],
        totalDeposit: number
    } = { outputs:[], totalDeposit: 0 };

    for (let i = 0; i < collectionSize; i++) {
        const nft = {
            "standard" : "IRC27",
            "type": "image",
            "version": "v1.0",
            "tokenURI": "https://robohash.org/shimmer-" + i + ".png",
            "tokenName": "My NFT #" + i,
            "collectionId": issuerAddress.nftId,
            "collectionName": "My Collection of Art",
            "royalties": {
                [royaltyAddress]: 0.025
            },
            "issuerName": "My Artist Name",
            "description": "A little information about my NFT collection"
        }
        // Create the outputs, that is an NFT output
        let nftOutput: lib.INftOutput = {
            type: lib.NFT_OUTPUT_TYPE,
            amount: "0", // for now zero as we don't know the byte cost yet
            // when minting, this has to be set to zero. It will be set in nodes as the hash of the outputId when the tx confirms.
            // Note, that from the first spend of the NFT you have to use the actual hash of outputId
            nftId: "0x0000000000000000000000000000000000000000000000000000000000000000",
            immutableFeatures: [
                {
                    type: lib.ISSUER_FEATURE_TYPE, // Issuer feature
                    address: issuerAddress,
                },
                {
                    type: lib.METADATA_FEATURE_TYPE, // Metadata Feature
                    data: Converter.utf8ToHex(JSON.stringify(nft), true)
                }
            ],
            unlockConditions: [
                {
                    type: lib.ADDRESS_UNLOCK_CONDITION_TYPE,
                    address: targetAddress, // minting it directly onto target address
                }
            ]
        }
        //calculate required storage
        const requiredStorageDeposit = lib.TransactionHelper.getStorageDeposit(nftOutput, nodeInfo.protocol.rentStructure);

        //Change NFT output amount to requred deposit storage
        nftOutput.amount = requiredStorageDeposit.toString();
       
        nftCollection.totalDeposit += requiredStorageDeposit;
        nftCollection.outputs.push(nftOutput);
    }

    return nftCollection;
}



export function mintCollectionNfts(txName: string, resolveCollectionNftId: boolean, consumedOutput: lib.OutputTypes, consumedOutputId: string, collectionOutputs: lib.OutputTypes[], totalDeposit: number, signerKeyPair: lib.IKeyPair, networkId: any): lib.ITransactionPayload{
    // Prepare inputs to the tx
    const input = lib.TransactionHelper.inputFromOutputId(consumedOutputId);

    // InputsCommitment calculation
    const inputsCommitment = lib.TransactionHelper.getInputsCommitment([consumedOutput]);

    // Transition the CollectionNft
    let collectionNft = deepCopy(consumedOutput) as lib.INftOutput;
    // resolve nft Id if its all zeros
    if(resolveCollectionNftId){
        collectionNft.nftId = lib.TransactionHelper.resolveIdFromOutputId(consumedOutputId);
    }
     
    collectionNft.amount = bigInt(consumedOutput.amount).minus(totalDeposit).toString(); 

    // 5.Create transaction essence
    const collectionTransactionEssence: lib.ITransactionEssence = {
        type: lib.TRANSACTION_ESSENCE_TYPE,
        networkId: networkId,
        inputs: [input],
        outputs: [collectionNft, ...collectionOutputs],
        inputsCommitment
    };

    // Calculating Transaction Essence Hash (to be signed in signature unlocks)
    const essenceHash = lib.TransactionHelper.getTransactionEssenceHash(collectionTransactionEssence);

    // Create the unlocks
    const unlockConditions: lib.UnlockTypes[] = [
        {
            type: lib.SIGNATURE_UNLOCK_TYPE,
            signature: {
                type: lib.ED25519_SIGNATURE_TYPE,
                publicKey: Converter.bytesToHex(signerKeyPair.publicKey, true),
                signature: Converter.bytesToHex(Ed25519.sign(signerKeyPair.privateKey, essenceHash), true)
            }
        }
    ];

    // Create transaction payload
     const txPayload: lib.ITransactionPayload = {
        type: lib.TRANSACTION_PAYLOAD_TYPE,
        essence: collectionTransactionEssence,
        unlocks: unlockConditions
    };

    // Record some info for ourselves
    let collectionNftOutputId = Converter.bytesToHex(lib.TransactionHelper.getTransactionPayloadHash(txPayload), true) + "0000";
    let nftOutputId1 = Converter.bytesToHex(lib.TransactionHelper.getTransactionPayloadHash(txPayload), true) + "0100";
    let nftOutputId2 = Converter.bytesToHex(lib.TransactionHelper.getTransactionPayloadHash(txPayload), true) + "0200";
    let nftOutputId3 = Converter.bytesToHex(lib.TransactionHelper.getTransactionPayloadHash(txPayload), true) + "0300";
    let nftOutputId4 = Converter.bytesToHex(lib.TransactionHelper.getTransactionPayloadHash(txPayload), true) + "0400";
    let nftOutputId5 = Converter.bytesToHex(lib.TransactionHelper.getTransactionPayloadHash(txPayload), true) + "0500";

    console.log("collectionNftOutputId", collectionNftOutputId)
    console.log("nftOutputId1", nftOutputId1)
    console.log("nftOutputId2", nftOutputId2)
    console.log("nftOutputId3", nftOutputId3)
    console.log("nftOutputId4", nftOutputId4)
    console.log("nftOutputId5", nftOutputId5)
    // // write collectionNFT
    // ctx.outputIdByName?.set(txName + "CollectionNft", collectionNftOutputId);
    // ctx.outputByName?.set(txName + "CollectionNft", collectionNft);
    // //write collection nfts
    // ctx.outputIdByName?.set(txName + "Nft1", nftOutputId1);
    // ctx.outputByName?.set(txName + "Nft1", collectionOutputs[0]);
    // ctx.outputIdByName?.set(txName + "Nft2", nftOutputId2);
    // ctx.outputByName?.set(txName +"Nft2", collectionOutputs[1]);
    // ctx.outputIdByName?.set(txName + "Nft3", nftOutputId3);
    // ctx.outputByName?.set(txName + "Nft3", collectionOutputs[2]);
    // ctx.outputIdByName?.set(txName + "Nft4", nftOutputId4);
    // ctx.outputByName?.set(txName + "Nft4", collectionOutputs[3]);
    // ctx.outputIdByName?.set(txName + "Nft5", nftOutputId5);
    // ctx.outputByName?.set(txName + "Nft5", collectionOutputs[4]);

    return txPayload;
}



// Deeply copies an object.
function deepCopy<T>(instance: T): T {
    if (instance == null) {
        return instance;
    }

    // handle Dates
    if (instance instanceof Date) {
        return new Date(instance.getTime()) as any;
    }

    // handle Array types
    if (instance instanceof Array) {
        var cloneArr = [] as any[];
        (instance as any[]).forEach((value) => { cloneArr.push(value) });
        // for nested objects
        return cloneArr.map((value: any) => deepCopy<any>(value)) as any;
    }
    // handle objects
    if (instance instanceof Object) {
        var copyInstance = {
            ...(instance as { [key: string]: any }
            )
        } as { [key: string]: any };
        for (var attr in instance) {
            if ((instance as Object).hasOwnProperty(attr))
                copyInstance[attr] = deepCopy<any>(instance[attr]);
        }
        return copyInstance as T;
    }
    // handling primitive data types
    return instance;
}