import {ApiPromise, Keyring, WsProvider} from '@polkadot/api';
import type {KeyringPair} from "@polkadot/keyring/types";
import {ContractPromise} from "@polkadot/api-contract";
import type {SubmittableExtrinsic} from "@polkadot/api/types";
import type {ISubmittableResult} from "@polkadot/types/types";
import {setTimeout} from "timers/promises";


const apis = new Map();

export async function getApi(rpc: string) : Promise<ApiPromise> {

    if (! apis.has(rpc)){

        const api = await ApiPromise.create({ provider: new WsProvider(rpc)});
        const[chain, nodeName, nodeVersion] = await Promise.all([
            api.rpc.system.chain(),
            api.rpc.system.name(),
            api.rpc.system.version()
        ]);
        console.log('You are connected to chain %s using %s v%s', chain, nodeName, nodeVersion);
        apis.set(rpc, api);
    }

    return apis.get(rpc);
}

export async function query(
  smartContract: ContractPromise,
  methodName: string,
  ...params: any[]
) : Promise<any> {

    const alice = new Keyring({ type: 'sr25519' }).addFromUri("//Alice");

    // maximum gas to be consumed for the call. if limit is too small the call will fail.
    const gasLimit = smartContract.api.registry.createType('WeightV2',
      {refTime: 30000000000, proofSize: 1000000}
    );

    // a limit to how much Balance to be used to pay for the storage created by the contract call
    // if null is passed, unlimited balance can be used
    const storageDepositLimit = null;

    const {result, output}  = await smartContract.query[methodName](
      alice.address,
      {gasLimit, storageDepositLimit},
      ...params
    );

    if (result.isOk){
        const value : string = output?.toString() ?? '';
        return JSON.parse(value).ok;
    }
    return Promise.reject("ERROR when query " + result.asErr);
}


export async function tx(
  smartContract: ContractPromise,
  signer : KeyringPair,
  methodName: string,
  ...params: any[]
) : Promise<string> {

    // maximum gas to be consumed for the call. if limit is too small the call will fail.
    const gasLimit = smartContract.api.registry.createType('WeightV2',
      {refTime: 30000000000, proofSize: 1000000}
    );

    // a limit to how much Balance to be used to pay for the storage created by the contract call
    // if null is passed, unlimited balance can be used
    const storageDepositLimit = null;

    const {gasRequired, result, debugMessage } =
      await smartContract.query[methodName](
        signer.address,
        { storageDepositLimit, gasLimit},
        ...params
      ) ;

    if (result.isOk){
        const tx = smartContract.tx[methodName](
          { storageDepositLimit, gasLimit : gasRequired },
          ...params
        );
        return await signAndSend(tx, signer);
    } else {
        console.log('Error when sending transaction - debugMessage : %s', debugMessage);
        return Promise.reject("Error when sending transaction " + result.asErr);
    }
}


async function signAndSend(
  extrinsic: SubmittableExtrinsic<'promise', ISubmittableResult>,
  signer : KeyringPair,
) : Promise<string> {

    let extrinsicResult : ExtrinsicResult = {success: false, failed: false, finalized: false, txHash: '' };

    const unsub = await extrinsic.signAndSend(
      signer,
      (result) => {
          if (readResult(result, extrinsicResult)) {
              unsub();
          }
      }
    );

    while (!extrinsicResult.failed && !extrinsicResult.success){
        // wait 10 seconds
        console.log("Wait");
        await setTimeout(10000);
    }

    if (extrinsicResult.failed){
        console.log("ERROR: Extrinsic failed");
        return Promise.reject("ERROR: Extrinsic failed");
    }

    console.log("Ok  " + extrinsicResult.txHash);
    return extrinsicResult.txHash;
}

export type ExtrinsicResult = {
    success: boolean;
    failed: boolean;
    finalized: boolean;
    txHash: string;
    result?: string;
}


function readResult(result: ISubmittableResult, extrinsicResult: ExtrinsicResult) : boolean {

    console.log('Transaction status:', result.status.type);

    if (result.status.isInBlock || result.status.isFinalized) {
        console.log('Transaction hash ', result.txHash.toHex());
        extrinsicResult.txHash = result.txHash.toHex();
        extrinsicResult.finalized = result.status.isFinalized;

        result.events.forEach(({ phase, event} ) => {
            let data = event.data;
            let method = event.method;
            let section = event.section;
            console.log(' %s : %s.%s:: %s', phase, section, method, data);

            if (section == 'system' && method == 'ExtrinsicSuccess'){
                extrinsicResult.success = true;
                return true;
            } else if (section == 'system' && method == 'ExtrinsicFailed'){
                extrinsicResult.failed = true;
                console.log(' %s : %s.%s:: %s', phase, section, method, data);
                return true;
            } else if (section == 'contracts' && method == 'Instantiated'){
                const [_owner, contract] = data;
                extrinsicResult.result = contract.toString();
            }
        });
    } else if (result.isError){
        console.log('Error');
        extrinsicResult.failed = true;
        return true;
    }
    return false;
}

