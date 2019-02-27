module.exports = {
  STAKING_HOST: process.env.STAKING_HOST || ((process.env.IS_STAGING == '1') ? 'https://sc-staging.idex.market' : 'https://sc.idex.market'),
}