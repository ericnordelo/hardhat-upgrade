const { extendConfig } = require('hardhat/config');

extendConfig(function (config, userConfig) {
  config.upgradeable = Object.assign(
    {
      beacon: [],
      uups: [],
    },
    userConfig.upgradeable
  );
});

task('upgrade', 'Upgrades an upgradeable contract')
  .addPositionalParam('contract', 'The contract name')
  .addOptionalParam('args', 'The inputs for the constructor if needed')
  .setAction(async (taskArgs, hre) => {
    const contract = taskArgs.contract;
    const { deployer } = await getNamedAccounts();

    const beacons = hre.config.upgradeable.beacon;
    const uups = hre.config.upgradeable.uups;

    const isBeacon = (cont) => {
      return beacons.includes(cont);
    };

    const isUUPS = (cont) => {
      return uups.includes(cont);
    };

    if (!isBeacon(contract) && !isUUPS(contract)) {
      console.log('Contract is not upgradeable');
      return;
    }

    // compile contracts
    await hre.run('compile');

    let args = [];

    if (taskArgs.args) {
      args = taskArgs.args.split(',');
    }

    try {
      // deploy new implementation
      let implementation = await deployments.deploy(contract + '_Implementation', {
        contract: contract,
        from: deployer,
        log: true,
        args,
      });

      if (implementation.newlyDeployed) {
        // check if contract is a beacon proxy
        if (isBeacon(contract)) {
          console.log('Upgrading', contract, 'beacon implementation...');
          // get the proxy
          let beacon = await ethers.getContract(contract + 'Beacon');

          // update the implementation
          await beacon.upgradeTo(implementation.address);
        } else if (isUUPS(contract)) {
          console.log('Upgrading', contract, 'implementation...');
          // get the proxy
          let proxy = await ethers.getContract(contract + '_Proxy');

          // change the ABI
          proxy = await ethers.getContractAt(contract, proxy.address);

          // update the implementation
          await proxy.upgradeTo(implementation.address);
        } else {
          console.log('Unhandled error. Please contract developers');
          return;
        }

        console.log('Done');
      } else {
        console.log('Upgrade not needed:', contract, 'has not changed since last deploy');
      }
    } catch (error) {
      console.log(error.message);
    }
  });

module.exports = {};
