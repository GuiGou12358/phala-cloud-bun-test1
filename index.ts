import {serve} from "bun";
import {TappdClient} from "@phala/dstack-sdk";
import {TestContract} from "./contract.ts";
import {Keyring} from "@polkadot/api";
import type {KeyringPair} from "@polkadot/keyring/types";

const port = process.env.PORT || 3000;
console.log(`Listening on port ${port}`);


async function getSubstrateKeyringPair(client: TappdClient) : Promise<KeyringPair> {
  const result = await client.deriveKey('polkadot');
  const bytes = result.asUint8Array(32)
  return new Keyring({type: 'sr25519'}).addFromSeed(bytes);
}

serve({
  port,
  idleTimeout : 30,
  routes: {
    "/": new Response("Hello GuiGou!"),

    "/info": async (req) => {
      const client = new TappdClient();
      const result = await client.info();
      return new Response(JSON.stringify(result));
    },

    "/tdx_quote": async (req) => {
      const client = new TappdClient();
      const result = await client.tdxQuote('test');
      return new Response(JSON.stringify(result));
    },

    "/tdx_quote_raw": async (req) => {
      const client = new TappdClient();
      const result = await client.tdxQuote('Hello DStack!', 'raw');
      return new Response(JSON.stringify(result));
    },

    "/derive_key": async (req) => {
      const client = new TappdClient();
      const result = await client.deriveKey('polkadot');
      return new Response(JSON.stringify(result));
    },

    "/account": async (req) => {
      const client = new TappdClient();
      const keypair = await getSubstrateKeyringPair(client);
      return new Response(JSON.stringify({
        address: keypair.address,
        publicKey: keypair.publicKey,
      }));
    },

    "/get": async (req) => {

      const contract = new TestContract();
      await contract.connect();
      const value = await contract.get();

      return new Response(JSON.stringify({
        value: value,
      }));
    },

    "/isGranted": async (req) => {

      const client = new TappdClient();
      const keypair = await getSubstrateKeyringPair(client);

      const contract = new TestContract();
      await contract.connect();
      const isGranted = await contract.isGranted(keypair.address);

      return new Response(JSON.stringify(isGranted));
    },


    "/inc": async (req) => {
      const client = new TappdClient();

      const contract = new TestContract();
      await contract.connect();

      const keypair = await getSubstrateKeyringPair(client);
      const tx = await contract.inc(keypair);

      return new Response(JSON.stringify({
        txHash: tx,
        sender: keypair.address,
      }));
    },

    "/set/:value": async (req) => {

      const client = new TappdClient();

      const contract = new TestContract();
      await contract.connect();

      const keypair = await getSubstrateKeyringPair(client);
      const tx = await contract.set(keypair, Number(req.params.value));

      return new Response(JSON.stringify({
        txHash: tx,
        sender: keypair.address,
      }));
    },

  },
});

