#!/bin/bash
# deploy_and_test.sh

# 1. Deploy
echo "Deploying to Devnet..."
anchor deploy --provider.cluster devnet --program-name frequencii_chat

# 2. Verify
echo "Verifying program..."
solana program show GW1UhbCFrpZVWgjQHY55poLodode4FSpm1ZsNK7ndf4f --url devnet

# 3. Test
echo "Running Tests..."
anchor test --provider.cluster devnet
