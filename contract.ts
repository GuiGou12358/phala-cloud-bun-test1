import {ContractPromise} from "@polkadot/api-contract";
import {readFileSync} from "fs";
import {getApi, query, tx} from "./wasmContractHelper";
import type {KeyringPair} from "@polkadot/keyring/types";

const METADATA_FILE = './metadata/test1.json';

export class TestContract {

    private contract: ContractPromise;

    public constructor(){
    }

    public async connect(){

        if (this.contract){
            return;
        }

        const api = await getApi('wss://rpc.shibuya.astar.network');

        const metadata = readFileSync(METADATA_FILE);
        this.contract = new ContractPromise(api, metadata.toString(), 'WcRcvmAzVZ8dsJWfYWWkjP3JidFQKoE28H6BUsepQBeXGeZ');
    }

    public async inc(signer: KeyringPair) : Promise<string> {
        return await tx(this.contract, signer, 'inc');
    }

    public async set(signer: KeyringPair, value : number) : Promise<string> {
        return await tx(this.contract, signer, 'set', value);
    }

    public async get() : Promise<Number> {
        return await query(this.contract, 'get');
    }

    public async isGranted(address: string) : Promise<boolean> {
        return await query(this.contract, 'isGranted', address);
    }

}



