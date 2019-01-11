import { web3 } from './helpers';

// tries variations on the contract ABI for ERC20 until we get a sane answer
// some contracts use 'name' or 'NAME', 'string' vs 'bytes32', or even omit a method
const tryContractMethod = async (address, methods, types, blockNumber, defaultValue) => {
  let value;
  for (const type of types) {
    for (const method of methods) {
      const contract = new web3.eth.Contract([{
        constant: true,
        inputs: [],
        name: method,
        outputs: [{ name: '', type }],
        type: 'function',
      }], address);
      try {
        value = await contract.methods[method]().call(null, blockNumber);
        if (value) {
          if (type === 'bytes32') {
            value = value.substr(2); // remove the 0x
            value = value.replace(/0+/g, '');
            const buf = Buffer.from(value, 'hex');
            value = buf.toString('utf8');
          }
          return (value);
        }
      } catch (e) {
        continue;
      }
    }
  }
  return (defaultValue);
};

// call the ERC20 contract to get token details
const getTokenDetailsFromContract = async (address, blockNumber = 'latest') => {
  const id = 0; let name; let symbol; let
    decimals;
  if (address === '0x0000000000000000000000000000000000000000') {
    name = 'Ether';
    symbol = 'ETH';
    decimals = 18;
  } else {
    name = await tryContractMethod(address, ['name', 'NAME'], ['string', 'bytes32'], blockNumber, '');
    symbol = await tryContractMethod(address, ['symbol', 'SYMBOL'], ['string', 'bytes32'], blockNumber, '');
    decimals = await tryContractMethod(address, ['decimals', 'DECIMALS'], ['uint8', 'uin256'], blockNumber, 0);
  }
  return {
    id, address, name, symbol, decimals,
  };
};

module.exports = { getTokenDetailsFromContract };
