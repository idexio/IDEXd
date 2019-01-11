module.exports = {
  IDEX1_ADDRESS: '0x2a0c0DBEcC7E4D658f48E01e3fA353F44050c208',
  IDEX_FIRST_BLOCK: 4317141,
  SNAPSHOT_SIZE: 1000,
  AURA_INTERFACE: [{
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  }],
  AURA_ADDRESS: '0xcdcfc0f66c522fd086a1b725ea3c0eeb9f9e8814',
  AURA_FIRST_BLOCK: 4927588,
  AURA_DECIMALS: 18,
  WALLET_CHALLENGE_TTL: 300,
};
