import { Connection, PublicKey } from "@solana/web3.js";
import {
  getMetadataPointerState,
  getTokenGroupMemberState,
  TOKEN_2022_PROGRAM_ID,
  unpackMint,
} from "@solana/spl-token";

const SGT_MINT_AUTHORITY = "GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4";
const SGT_METADATA_ADDRESS = "GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te";
const SGT_GROUP_MINT_ADDRESS = "GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te";

export interface SeekerVerificationResult {
  hasGenesisToken: boolean;
  genesisTokenMint: string | null;
}

export async function verifySeekerGenesisToken(
  walletAddress: string,
): Promise<SeekerVerificationResult> {
  const rpcUrl = process.env.HELIUS_MAINNET_RPC_URL || process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
  if (!rpcUrl) {
    throw new Error("HELIUS_MAINNET_RPC_URL is required for Seeker verification");
  }

  const owner = new PublicKey(walletAddress);
  const connection = new Connection(rpcUrl, "confirmed");
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, {
    programId: TOKEN_2022_PROGRAM_ID,
  });

  const mintAddresses = tokenAccounts.value
    .map((item) => item.account.data.parsed.info.mint)
    .filter((mint): mint is string => typeof mint === "string");

  for (let i = 0; i < mintAddresses.length; i += 100) {
    const batch = mintAddresses.slice(i, i + 100).map((mint) => new PublicKey(mint));
    const infos = await connection.getMultipleAccountsInfo(batch);

    for (let index = 0; index < infos.length; index += 1) {
      const info = infos[index];
      if (!info) continue;

      const mintAddress = batch[index];
      const mint = unpackMint(mintAddress, info, TOKEN_2022_PROGRAM_ID);
      const metadata = getMetadataPointerState(mint);
      const tokenGroupMember = getTokenGroupMemberState(mint);

      const matchesMintAuthority = mint.mintAuthority?.toBase58() === SGT_MINT_AUTHORITY;
      const matchesMetadata =
        metadata?.authority?.toBase58() === SGT_MINT_AUTHORITY &&
        metadata?.metadataAddress?.toBase58() === SGT_METADATA_ADDRESS;
      const matchesGroup = tokenGroupMember?.group?.toBase58() === SGT_GROUP_MINT_ADDRESS;

      if (matchesMintAuthority && matchesMetadata && matchesGroup) {
        return {
          hasGenesisToken: true,
          genesisTokenMint: mintAddress.toBase58(),
        };
      }
    }
  }

  return {
    hasGenesisToken: false,
    genesisTokenMint: null,
  };
}
