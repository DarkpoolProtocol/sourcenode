var require = meteorInstall({"imports":{"api":{"accounts":{"server":{"methods.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/accounts/server/methods.js                                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }

}, 0);
let HTTP;
module.link("meteor/http", {
  HTTP(v) {
    HTTP = v;
  }

}, 1);
let Validators;
module.link("/imports/api/validators/validators.js", {
  Validators(v) {
    Validators = v;
  }

}, 2);

const fetchFromUrl = url => {
  try {
    let res = HTTP.get(LCD + url);

    if (res.statusCode == 200) {
      return res;
    }
  } catch (e) {
    console.log(res);
    console.log(e);
  }
};

Meteor.methods({
  'accounts.getAccountDetail': function (address) {
    this.unblock();
    let url = LCD + '/auth/accounts/' + address;

    try {
      let available = HTTP.get(url);

      if (available.statusCode == 200) {
        let response = JSON.parse(available.content).result;
        let account;
        if (response.type === 'cosmos-sdk/Account') account = response.value;else if (response.type === 'cosmos-sdk/DelayedVestingAccount' || response.type === 'cosmos-sdk/ContinuousVestingAccount') account = response.value.BaseVestingAccount.BaseAccount;
        if (account && account.account_number != null) return account;
        return null;
      }
    } catch (e) {
      console.log(url);
      console.log(e);
    }
  },
  'accounts.getBalance': function (address) {
    this.unblock();
    let balance = {}; // get available atoms

    let url = LCD + '/bank/balances/' + address;

    try {
      let available = HTTP.get(url);

      if (available.statusCode == 200) {
        balance.available = JSON.parse(available.content).result;
      }
    } catch (e) {
      console.log(url);
      console.log(e);
    } // get delegated amnounts


    url = LCD + '/staking/delegators/' + address + '/delegations';

    try {
      let delegations = HTTP.get(url);

      if (delegations.statusCode == 200) {
        balance.delegations = JSON.parse(delegations.content).result;
      }
    } catch (e) {
      console.log(url);
      console.log(e);
    } // get unbonding


    url = LCD + '/staking/delegators/' + address + '/unbonding_delegations';

    try {
      let unbonding = HTTP.get(url);

      if (unbonding.statusCode == 200) {
        balance.unbonding = JSON.parse(unbonding.content).result;
      }
    } catch (e) {
      console.log(url);
      console.log(e);
    } // get rewards


    url = LCD + '/distribution/delegators/' + address + '/rewards';

    try {
      let rewards = HTTP.get(url);

      if (rewards.statusCode == 200) {
        //get seperate rewards value
        balance.rewards = JSON.parse(rewards.content).result.rewards; //get total rewards value

        balance.total_rewards = JSON.parse(rewards.content).result.total;
      }
    } catch (e) {
      console.log(url);
      console.log(e);
    } // get commission


    let validator = Validators.findOne({
      $or: [{
        operator_address: address
      }, {
        delegator_address: address
      }, {
        address: address
      }]
    });

    if (validator) {
      let url = LCD + '/distribution/validators/' + validator.operator_address;
      balance.operator_address = validator.operator_address;

      try {
        let rewards = HTTP.get(url);

        if (rewards.statusCode == 200) {
          let content = JSON.parse(rewards.content).result;
          if (content.val_commission && content.val_commission.length > 0) balance.commission = content.val_commission;
        }
      } catch (e) {
        console.log(url);
        console.log(e);
      }
    }

    return balance;
  },
  'accounts.getDelegation': function (address, validator) {
    let url = "/staking/delegators/".concat(address, "/delegations/").concat(validator);
    let delegations = fetchFromUrl(url);
    delegations = delegations && delegations.data.result;
    if (delegations && delegations.shares) delegations.shares = parseFloat(delegations.shares);
    url = "/staking/redelegations?delegator=".concat(address, "&validator_to=").concat(validator);
    let relegations = fetchFromUrl(url);
    relegations = relegations && relegations.data.result;
    let completionTime;

    if (relegations) {
      relegations.forEach(relegation => {
        let entries = relegation.entries;
        let time = new Date(entries[entries.length - 1].completion_time);
        if (!completionTime || time > completionTime) completionTime = time;
      });
      delegations.redelegationCompletionTime = completionTime;
    }

    url = "/staking/delegators/".concat(address, "/unbonding_delegations/").concat(validator);
    let undelegations = fetchFromUrl(url);
    undelegations = undelegations && undelegations.data.result;

    if (undelegations) {
      delegations.unbonding = undelegations.entries.length;
      delegations.unbondingCompletionTime = undelegations.entries[0].completion_time;
    }

    return delegations;
  },
  'accounts.getAllDelegations': function (address) {
    let url = LCD + '/staking/delegators/' + address + '/delegations';

    try {
      let delegations = HTTP.get(url);

      if (delegations.statusCode == 200) {
        delegations = JSON.parse(delegations.content).result;

        if (delegations && delegations.length > 0) {
          delegations.forEach((delegation, i) => {
            if (delegations[i] && delegations[i].shares) delegations[i].shares = parseFloat(delegations[i].shares);
          });
        }

        return delegations;
      }
    } catch (e) {
      console.log(url);
      console.log(e);
    }
  },
  'accounts.getAllUnbondings': function (address) {
    let url = LCD + '/staking/delegators/' + address + '/unbonding_delegations';

    try {
      let unbondings = HTTP.get(url);

      if (unbondings.statusCode == 200) {
        unbondings = JSON.parse(unbondings.content).result;
        return unbondings;
      }
    } catch (e) {
      console.log(url);
      console.log(e);
    }
  },
  'accounts.getAllRedelegations': function (address, validator) {
    let url = "/staking/redelegations?delegator=".concat(address, "&validator_from=").concat(validator);
    let result = fetchFromUrl(url);

    if (result && result.data) {
      let redelegations = {};
      result.data.forEach(redelegation => {
        let entries = redelegation.entries;
        redelegations[redelegation.validator_dst_address] = {
          count: entries.length,
          completionTime: entries[0].completion_time
        };
      });
      return redelegations;
    }
  },
  'accounts.getDidToAddress': function (did_address) {
    let url = "/didToAddr/".concat(did_address);
    let result = fetchFromUrl(url);
    return result;
  },
  'accounts.getDidDoc': function (did_address) {
    let url = "/did/".concat(did_address);
    let result = fetchFromUrl(url);
    return result;
  },
  'accounts.allDid': function () {
    let url = "/allDidDocs/";
    let result = fetchFromUrl(url);
    return result;
  },
  'accounts.checkName': function (name) {
    let url = "/checkName/".concat(name);
    let result = fetchFromUrl(url);
    return result;
  }
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}},"blocks":{"server":{"methods.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/blocks/server/methods.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }

}, 0);
let HTTP;
module.link("meteor/http", {
  HTTP(v) {
    HTTP = v;
  }

}, 1);
let Promise;
module.link("meteor/promise", {
  Promise(v) {
    Promise = v;
  }

}, 2);
let Blockscon;
module.link("/imports/api/blocks/blocks.js", {
  Blockscon(v) {
    Blockscon = v;
  }

}, 3);
let Chain;
module.link("/imports/api/chain/chain.js", {
  Chain(v) {
    Chain = v;
  }

}, 4);
let ValidatorSets;
module.link("/imports/api/validator-sets/validator-sets.js", {
  ValidatorSets(v) {
    ValidatorSets = v;
  }

}, 5);
let Validators;
module.link("/imports/api/validators/validators.js", {
  Validators(v) {
    Validators = v;
  }

}, 6);
let ValidatorRecords, Analytics, VPDistributions;
module.link("/imports/api/records/records.js", {
  ValidatorRecords(v) {
    ValidatorRecords = v;
  },

  Analytics(v) {
    Analytics = v;
  },

  VPDistributions(v) {
    VPDistributions = v;
  }

}, 7);
let VotingPowerHistory;
module.link("/imports/api/voting-power/history.js", {
  VotingPowerHistory(v) {
    VotingPowerHistory = v;
  }

}, 8);
let Transactions;
module.link("../../transactions/transactions.js", {
  Transactions(v) {
    Transactions = v;
  }

}, 9);
let Evidences;
module.link("../../evidences/evidences.js", {
  Evidences(v) {
    Evidences = v;
  }

}, 10);
let sha256;
module.link("js-sha256", {
  sha256(v) {
    sha256 = v;
  }

}, 11);
let getAddress;
module.link("tendermint/lib/pubkey", {
  getAddress(v) {
    getAddress = v;
  }

}, 12);
let cheerio;
module.link("cheerio", {
  "*"(v) {
    cheerio = v;
  }

}, 13);

// import Block from '../../../ui/components/Block';
// getValidatorVotingPower = (validators, address) => {
//     for (v in validators){
//         if (validators[v].address == address){
//             return parseInt(validators[v].voting_power);
//         }
//     }
// }
getRemovedValidators = (prevValidators, validators) => {
  // let removeValidators = [];
  for (p in prevValidators) {
    for (v in validators) {
      if (prevValidators[p].address == validators[v].address) {
        prevValidators.splice(p, 1);
      }
    }
  }

  return prevValidators;
};

getValidatorProfileUrl = identity => {
  if (identity.length == 16) {
    let response = HTTP.get("https://keybase.io/_/api/1.0/user/lookup.json?key_suffix=".concat(identity, "&fields=pictures"));

    if (response.statusCode == 200) {
      let them = response.data.them;
      return them && them.length && them[0].pictures && them[0].pictures.primary && them[0].pictures.primary.url;
    } else {
      console.log(JSON.stringify(response));
    }
  } else if (identity.indexOf("keybase.io/team/") > 0) {
    let teamPage = HTTP.get(identity);

    if (teamPage.statusCode == 200) {
      let page = cheerio.load(teamPage.content);
      return page(".kb-main-card img").attr('src');
    } else {
      console.log(JSON.stringify(teamPage));
    }
  }
}; // var filtered = [1, 2, 3, 4, 5].filter(notContainedIn([1, 2, 3, 5]));
// console.log(filtered); // [4]


Meteor.methods({
  'blocks.averageBlockTime'(address) {
    let blocks = Blockscon.find({
      proposerAddress: address
    }).fetch();
    let heights = blocks.map((block, i) => {
      return block.height;
    });
    let blocksStats = Analytics.find({
      height: {
        $in: heights
      }
    }).fetch(); // console.log(blocksStats);

    let totalBlockDiff = 0;

    for (b in blocksStats) {
      totalBlockDiff += blocksStats[b].timeDiff;
    }

    return totalBlockDiff / heights.length;
  },

  'blocks.findUpTime'(address) {
    let collection = ValidatorRecords.rawCollection(); // let aggregateQuery = Meteor.wrapAsync(collection.aggregate, collection);

    var pipeline = [{
      $match: {
        "address": address
      }
    }, // {$project:{address:1,height:1,exists:1}},
    {
      $sort: {
        "height": -1
      }
    }, {
      $limit: Meteor.settings.public.uptimeWindow - 1
    }, {
      $unwind: "$_id"
    }, {
      $group: {
        "_id": "$address",
        "uptime": {
          "$sum": {
            $cond: [{
              $eq: ['$exists', true]
            }, 1, 0]
          }
        }
      }
    }]; // let result = aggregateQuery(pipeline, { cursor: {} });

    return Promise.await(collection.aggregate(pipeline).toArray()); // return .aggregate()
  },

  'blocks.getLatestHeight': function () {
    this.unblock();
    let url = RPC + '/status';

    try {
      let response = HTTP.get(url);
      let status = JSON.parse(response.content);
      return status.result.sync_info.latest_block_height;
    } catch (e) {
      return 0;
    }
  },
  'blocks.getCurrentHeight': function () {
    this.unblock();
    let currHeight = Blockscon.find({}, {
      sort: {
        height: -1
      },
      limit: 1
    }).fetch(); // console.log("currentHeight:"+currHeight);

    let startHeight = Meteor.settings.params.startHeight;

    if (currHeight && currHeight.length == 1) {
      let height = currHeight[0].height;
      if (height > startHeight) return height;
    }

    return startHeight;
  },
  'blocks.blocksUpdate': function () {
    if (SYNCING) return "Syncing...";else console.log("start to sync"); // Meteor.clearInterval(Meteor.timerHandle);
    // get the latest height

    let until = Meteor.call('blocks.getLatestHeight'); // console.log(until);
    // get the current height in db

    let curr = Meteor.call('blocks.getCurrentHeight');
    console.log(curr); // loop if there's update in db

    if (until > curr) {
      SYNCING = true;
      let validatorSet = {}; // get latest validator candidate information

      url = LCD + '/staking/validators';

      try {
        response = HTTP.get(url);
        JSON.parse(response.content).result.forEach(validator => validatorSet[validator.consensus_pubkey] = validator);
      } catch (e) {
        console.log(e);
      }

      url = LCD + '/staking/validators?status=unbonding';

      try {
        response = HTTP.get(url);
        JSON.parse(response.content).result.forEach(validator => validatorSet[validator.consensus_pubkey] = validator);
      } catch (e) {
        console.log(e);
      }

      url = LCD + '/staking/validators?status=unbonded';

      try {
        response = HTTP.get(url);
        JSON.parse(response.content).result.forEach(validator => validatorSet[validator.consensus_pubkey] = validator);
      } catch (e) {
        console.log(e);
      }

      let totalValidators = Object.keys(validatorSet).length;
      console.log("all validators: " + totalValidators);

      for (let height = curr + 1; height <= until; height++) {
        let startBlockTime = new Date(); // add timeout here? and outside this loop (for catched up and keep fetching)?

        this.unblock();
        let url = RPC + '/block?height=' + height;
        let analyticsData = {};
        console.log(url);

        try {
          const bulkValidators = Validators.rawCollection().initializeUnorderedBulkOp();
          const bulkValidatorRecords = ValidatorRecords.rawCollection().initializeUnorderedBulkOp();
          const bulkVPHistory = VotingPowerHistory.rawCollection().initializeUnorderedBulkOp();
          const bulkTransations = Transactions.rawCollection().initializeUnorderedBulkOp();
          let startGetHeightTime = new Date();
          let response = HTTP.get(url);

          if (response.statusCode == 200) {
            let block = JSON.parse(response.content);
            block = block.result; // store height, hash, numtransaction and time in db

            let blockData = {};
            blockData.height = height;
            blockData.hash = block.block_id.hash;
            blockData.transNum = block.block.data.txs ? block.block.data.txs.length : 0;
            blockData.time = new Date(block.block.header.time);
            blockData.lastBlockHash = block.block.header.last_block_id.hash;
            blockData.proposerAddress = block.block.header.proposer_address;
            blockData.validators = []; // Tendermint v0.33 start using "signatures" in last block instead of "precommits"

            let precommits = block.block.last_commit.signatures;

            if (precommits != null) {
              // console.log(precommits.length);
              for (let i = 0; i < precommits.length; i++) {
                if (precommits[i] != null) {
                  blockData.validators.push(precommits[i].validator_address);
                }
              }

              analyticsData.precommits = precommits.length; // record for analytics
              // PrecommitRecords.insert({height:height, precommits:precommits.length});
            } // save txs in database


            if (block.block.data.txs && block.block.data.txs.length > 0) {
              for (t in block.block.data.txs) {
                Meteor.call('Transactions.index', sha256(Buffer.from(block.block.data.txs[t], 'base64')), blockData.time, (err, result) => {
                  if (err) {
                    console.log(err);
                  }
                });
              }
            } // save double sign evidences


            if (block.block.evidence.evidence) {
              Evidences.insert({
                height: height,
                evidence: block.block.evidence.evidence
              });
            }

            blockData.precommitsCount = blockData.validators.length;
            analyticsData.height = height;
            let endGetHeightTime = new Date();
            console.log("Get height time: " + (endGetHeightTime - startGetHeightTime) / 1000 + "seconds.");
            let startGetValidatorsTime = new Date(); // update chain status
            //url = RPC+'/validators?height='+height;

            url = RPC + "/validators?height=".concat(height, "&page=1&per_page=100");
            response = HTTP.get(url);
            console.log(url);
            let validators = JSON.parse(response.content);
            validators.result.block_height = parseInt(validators.result.block_height);
            ValidatorSets.insert(validators.result);
            blockData.validatorsCount = validators.result.validators.length;
            let startBlockInsertTime = new Date();
            Blockscon.insert(blockData);
            let endBlockInsertTime = new Date();
            console.log("Block insert time: " + (endBlockInsertTime - startBlockInsertTime) / 1000 + "seconds."); // store valdiators exist records

            let existingValidators = Validators.find({
              address: {
                $exists: true
              }
            }).fetch();

            if (height > 1) {
              // record precommits and calculate uptime
              // only record from block 2
              for (i in validators.result.validators) {
                let address = validators.result.validators[i].address;
                let record = {
                  height: height,
                  address: address,
                  exists: false,
                  voting_power: parseInt(validators.result.validators[i].voting_power) //getValidatorVotingPower(existingValidators, address)

                };

                for (j in precommits) {
                  if (precommits[j] != null) {
                    if (address == precommits[j].validator_address) {
                      record.exists = true;
                      precommits.splice(j, 1);
                      break;
                    }
                  }
                } // calculate the uptime based on the records stored in previous blocks
                // only do this every 15 blocks ~


                if (height % 15 == 0) {
                  // let startAggTime = new Date();
                  let numBlocks = Meteor.call('blocks.findUpTime', address);
                  let uptime = 0; // let endAggTime = new Date();
                  // console.log("Get aggregated uptime for "+existingValidators[i].address+": "+((endAggTime-startAggTime)/1000)+"seconds.");

                  if (numBlocks[0] != null && numBlocks[0].uptime != null) {
                    uptime = numBlocks[0].uptime;
                  }

                  let base = Meteor.settings.public.uptimeWindow;

                  if (height < base) {
                    base = height;
                  }

                  if (record.exists) {
                    if (uptime < base) {
                      uptime++;
                    }

                    uptime = uptime / base * 100;
                    bulkValidators.find({
                      address: address
                    }).upsert().updateOne({
                      $set: {
                        uptime: uptime,
                        lastSeen: blockData.time
                      }
                    });
                  } else {
                    uptime = uptime / base * 100;
                    bulkValidators.find({
                      address: address
                    }).upsert().updateOne({
                      $set: {
                        uptime: uptime
                      }
                    });
                  }
                }

                bulkValidatorRecords.insert(record); // ValidatorRecords.update({height:height,address:record.address},record);
              }
            }

            let chainStatus = Chain.findOne({
              chainId: block.block.header.chain_id
            });
            let lastSyncedTime = chainStatus ? chainStatus.lastSyncedTime : 0;
            let timeDiff;
            let blockTime = Meteor.settings.params.defaultBlockTime;

            if (lastSyncedTime) {
              let dateLatest = blockData.time;
              let dateLast = new Date(lastSyncedTime);
              timeDiff = Math.abs(dateLatest.getTime() - dateLast.getTime());
              blockTime = (chainStatus.blockTime * (blockData.height - 1) + timeDiff) / blockData.height;
            }

            let endGetValidatorsTime = new Date();
            console.log("Get height validators time: " + (endGetValidatorsTime - startGetValidatorsTime) / 1000 + "seconds.");
            Chain.update({
              chainId: block.block.header.chain_id
            }, {
              $set: {
                lastSyncedTime: blockData.time,
                blockTime: blockTime
              }
            });
            analyticsData.averageBlockTime = blockTime;
            analyticsData.timeDiff = timeDiff;
            analyticsData.time = blockData.time; // initialize validator data at first block
            // if (height == 1){
            //     Validators.remove({});
            // }

            analyticsData.voting_power = 0;
            let startFindValidatorsNameTime = new Date();

            if (validators.result) {
              // validators are all the validators in the current height
              console.log("validatorSet size: " + validators.result.validators.length);

              for (v in validators.result.validators) {
                // Validators.insert(validators.result.validators[v]);
                let validator = validators.result.validators[v];
                validator.voting_power = parseInt(validator.voting_power);
                validator.proposer_priority = parseInt(validator.proposer_priority);
                let valExist = Validators.findOne({
                  "pub_key.value": validator.pub_key.value
                });

                if (!valExist) {
                  console.log("validator pub_key ".concat(validator.address, " ").concat(validator.pub_key.value, " not in db")); // let command = Meteor.settings.bin.gaiadebug+" pubkey "+validator.pub_key.value;
                  // console.log(command);
                  // let tempVal = validator;

                  validator.address = getAddress(validator.pub_key);
                  validator.accpub = Meteor.call('pubkeyToBech32', validator.pub_key, Meteor.settings.public.bech32PrefixAccPub);
                  validator.operator_pubkey = Meteor.call('pubkeyToBech32', validator.pub_key, Meteor.settings.public.bech32PrefixValPub);
                  validator.consensus_pubkey = Meteor.call('pubkeyToBech32', validator.pub_key, Meteor.settings.public.bech32PrefixConsPub);
                  let validatorData = validatorSet[validator.consensus_pubkey];

                  if (validatorData) {
                    if (validatorData.description.identity) validator.profile_url = getValidatorProfileUrl(validatorData.description.identity);
                    validator.operator_address = validatorData.operator_address;
                    validator.delegator_address = Meteor.call('getDelegator', validatorData.operator_address);
                    validator.jailed = validatorData.jailed;
                    validator.status = validatorData.status;
                    validator.min_self_delegation = validatorData.min_self_delegation;
                    validator.tokens = validatorData.tokens;
                    validator.delegator_shares = validatorData.delegator_shares;
                    validator.description = validatorData.description;
                    validator.bond_height = validatorData.bond_height;
                    validator.bond_intra_tx_counter = validatorData.bond_intra_tx_counter;
                    validator.unbonding_height = validatorData.unbonding_height;
                    validator.unbonding_time = validatorData.unbonding_time;
                    validator.commission = validatorData.commission;
                    validator.self_delegation = validator.delegator_shares; // validator.removed = false,
                    // validator.removedAt = 0
                    // validatorSet.splice(val, 1);
                  } else {
                    console.log('no con pub key?');
                  } // bulkValidators.insert(validator);


                  bulkValidators.find({
                    address: validator.address
                  }).upsert().updateOne({
                    $set: validator
                  }); // console.log("validator first appears: "+bulkValidators.length);

                  bulkVPHistory.insert({
                    address: validator.address,
                    prev_voting_power: 0,
                    voting_power: validator.voting_power,
                    type: 'add',
                    height: blockData.height,
                    block_time: blockData.time
                  }); // Meteor.call('runCode', command, function(error, result){
                  // validator.address = result.match(/\s[0-9A-F]{40}$/igm);
                  // validator.address = validator.address[0].trim();
                  // validator.hex = result.match(/\s[0-9A-F]{64}$/igm);
                  // validator.hex = validator.hex[0].trim();
                  // validator.cosmosaccpub = result.match(/dx0pub.*$/igm);
                  // validator.cosmosaccpub = validator.dx0accpub[0].trim();
                  // validator.operator_pubkey = result.match(/dx0valoperpub.*$/igm);
                  // validator.operator_pubkey = validator.operator_pubkey[0].trim();
                  // validator.consensus_pubkey = result.match(/dx0svalconspub.*$/igm);
                  // validator.consensus_pubkey = validator.consensus_pubkey[0].trim();
                  // });
                } else {
                  let validatorData = validatorSet[valExist.consensus_pubkey];

                  if (validatorData) {
                    if (validatorData.description && (!valExist.description || validatorData.description.identity !== valExist.description.identity)) validator.profile_url = getValidatorProfileUrl(validatorData.description.identity);
                    validator.jailed = validatorData.jailed;
                    validator.status = validatorData.status;
                    validator.tokens = validatorData.tokens;
                    validator.delegator_shares = validatorData.delegator_shares;
                    validator.description = validatorData.description;
                    validator.bond_height = validatorData.bond_height;
                    validator.bond_intra_tx_counter = validatorData.bond_intra_tx_counter;
                    validator.unbonding_height = validatorData.unbonding_height;
                    validator.unbonding_time = validatorData.unbonding_time;
                    validator.commission = validatorData.commission; // calculate self delegation percentage every 30 blocks

                    if (height % 30 == 1) {
                      try {
                        let response = HTTP.get(LCD + '/staking/delegators/' + valExist.delegator_address + '/delegations/' + valExist.operator_address);

                        if (response.statusCode == 200) {
                          let selfDelegation = JSON.parse(response.content).result;

                          if (selfDelegation.shares) {
                            validator.self_delegation = parseFloat(selfDelegation.shares) / parseFloat(validator.delegator_shares);
                          }
                        }
                      } catch (e) {// console.log(e);
                      }
                    }

                    bulkValidators.find({
                      consensus_pubkey: valExist.consensus_pubkey
                    }).updateOne({
                      $set: validator
                    }); // console.log("validator exisits: "+bulkValidators.length);
                    // validatorSet.splice(val, 1);
                  } else {
                    console.log('no con pub key?');
                  }

                  let prevVotingPower = VotingPowerHistory.findOne({
                    address: validator.address
                  }, {
                    height: -1,
                    limit: 1
                  });

                  if (prevVotingPower) {
                    if (prevVotingPower.voting_power != validator.voting_power) {
                      let changeType = prevVotingPower.voting_power > validator.voting_power ? 'down' : 'up';
                      let changeData = {
                        address: validator.address,
                        prev_voting_power: prevVotingPower.voting_power,
                        voting_power: validator.voting_power,
                        type: changeType,
                        height: blockData.height,
                        block_time: blockData.time
                      }; // console.log('voting power changed.');
                      // console.log(changeData);

                      bulkVPHistory.insert(changeData);
                    }
                  }
                } // console.log(validator);


                analyticsData.voting_power += validator.voting_power;
              } // if there is validator removed


              let prevValidators = ValidatorSets.findOne({
                block_height: height - 1
              });

              if (prevValidators) {
                let removedValidators = getRemovedValidators(prevValidators.validators, validators.result.validators);

                for (r in removedValidators) {
                  bulkVPHistory.insert({
                    address: removedValidators[r].address,
                    prev_voting_power: removedValidators[r].voting_power,
                    voting_power: 0,
                    type: 'remove',
                    height: blockData.height,
                    block_time: blockData.time
                  });
                }
              }
            } // check if there's any validator not in db 14400 blocks(~1 day)


            if (height % 14400 == 0) {
              try {
                console.log('Checking all validators against db...');
                let dbValidators = {};
                Validators.find({}, {
                  fields: {
                    consensus_pubkey: 1,
                    status: 1
                  }
                }).forEach(v => dbValidators[v.consensus_pubkey] = v.status);
                Object.keys(validatorSet).forEach(conPubKey => {
                  let validatorData = validatorSet[conPubKey]; // Active validators should have been updated in previous steps

                  if (validatorData.status === 2) return;

                  if (dbValidators[conPubKey] == undefined) {
                    console.log("validator with consensus_pubkey ".concat(conPubKey, " not in db"));
                    validatorData.pub_key = {
                      "type": "tendermint/PubKeyEd25519",
                      "value": Meteor.call('bech32ToPubkey', conPubKey)
                    };
                    validatorData.address = getAddress(validatorData.pub_key);
                    validatorData.delegator_address = Meteor.call('getDelegator', validatorData.operator_address);
                    validatorData.accpub = Meteor.call('pubkeyToBech32', validatorData.pub_key, Meteor.settings.public.bech32PrefixAccPub);
                    validatorData.operator_pubkey = Meteor.call('pubkeyToBech32', validatorData.pub_key, Meteor.settings.public.bech32PrefixValPub);
                    console.log(JSON.stringify(validatorData));
                    bulkValidators.find({
                      consensus_pubkey: conPubKey
                    }).upsert().updateOne({
                      $set: validatorData
                    });
                  } else if (dbValidators[conPubKey] == 2) {
                    bulkValidators.find({
                      consensus_pubkey: conPubKey
                    }).upsert().updateOne({
                      $set: validatorData
                    });
                  }
                });
              } catch (e) {
                console.log(e);
              }
            } // fetching keybase every 14400 blocks(~1 day)


            if (height % 14400 == 1) {
              console.log('Fetching keybase...');
              Validators.find({}).forEach(validator => {
                try {
                  let profileUrl = getValidatorProfileUrl(validator.description.identity);

                  if (profileUrl) {
                    bulkValidators.find({
                      address: validator.address
                    }).upsert().updateOne({
                      $set: {
                        'profile_url': profileUrl
                      }
                    });
                  }
                } catch (e) {
                  console.log(profileUrl);
                  console.log(e);
                }
              });
            }

            let endFindValidatorsNameTime = new Date();
            console.log("Get validators name time: " + (endFindValidatorsNameTime - startFindValidatorsNameTime) / 1000 + "seconds."); // record for analytics

            let startAnayticsInsertTime = new Date();
            Analytics.insert(analyticsData);
            let endAnalyticsInsertTime = new Date();
            console.log("Analytics insert time: " + (endAnalyticsInsertTime - startAnayticsInsertTime) / 1000 + "seconds.");
            let startVUpTime = new Date();

            if (bulkValidators.length > 0) {
              // console.log(bulkValidators.length);
              bulkValidators.execute((err, result) => {
                if (err) {
                  console.log(err);
                }

                if (result) {// console.log(result);
                }
              });
            }

            let endVUpTime = new Date();
            console.log("Validator update time: " + (endVUpTime - startVUpTime) / 1000 + "seconds.");
            let startVRTime = new Date();

            if (bulkValidatorRecords.length > 0) {
              bulkValidatorRecords.execute((err, result) => {
                if (err) {
                  console.log(err);
                }
              });
            }

            let endVRTime = new Date();
            console.log("Validator records update time: " + (endVRTime - startVRTime) / 1000 + "seconds.");

            if (bulkVPHistory.length > 0) {
              bulkVPHistory.execute((err, result) => {
                if (err) {
                  console.log(err);
                }
              });
            }

            if (bulkTransations.length > 0) {
              bulkTransations.execute((err, result) => {
                if (err) {
                  console.log(err);
                }
              });
            } // calculate voting power distribution every 60 blocks ~ 5mins


            if (height % 60 == 1) {
              console.log("===== calculate voting power distribution =====");
              let activeValidators = Validators.find({
                status: 2,
                jailed: false
              }, {
                sort: {
                  voting_power: -1
                }
              }).fetch();
              let numTopTwenty = Math.ceil(activeValidators.length * 0.2);
              let numBottomEighty = activeValidators.length - numTopTwenty;
              let topTwentyPower = 0;
              let bottomEightyPower = 0;
              let numTopThirtyFour = 0;
              let numBottomSixtySix = 0;
              let topThirtyFourPercent = 0;
              let bottomSixtySixPercent = 0;

              for (v in activeValidators) {
                if (v < numTopTwenty) {
                  topTwentyPower += activeValidators[v].voting_power;
                } else {
                  bottomEightyPower += activeValidators[v].voting_power;
                }

                if (topThirtyFourPercent < 0.34) {
                  topThirtyFourPercent += activeValidators[v].voting_power / analyticsData.voting_power;
                  numTopThirtyFour++;
                }
              }

              bottomSixtySixPercent = 1 - topThirtyFourPercent;
              numBottomSixtySix = activeValidators.length - numTopThirtyFour;
              let vpDist = {
                height: height,
                numTopTwenty: numTopTwenty,
                topTwentyPower: topTwentyPower,
                numBottomEighty: numBottomEighty,
                bottomEightyPower: bottomEightyPower,
                numTopThirtyFour: numTopThirtyFour,
                topThirtyFourPercent: topThirtyFourPercent,
                numBottomSixtySix: numBottomSixtySix,
                bottomSixtySixPercent: bottomSixtySixPercent,
                numValidators: activeValidators.length,
                totalVotingPower: analyticsData.voting_power,
                blockTime: blockData.time,
                createAt: new Date()
              };
              console.log(vpDist);
              VPDistributions.insert(vpDist);
            }
          }
        } catch (e) {
          console.log(e);
          SYNCING = false;
          return "Stopped";
        }

        let endBlockTime = new Date();
        console.log("This block used: " + (endBlockTime - startBlockTime) / 1000 + "seconds.");
      }

      SYNCING = false;
      Chain.update({
        chainId: Meteor.settings.public.chainId
      }, {
        $set: {
          lastBlocksSyncedTime: new Date(),
          totalValidators: totalValidators
        }
      });
    }

    return until;
  },
  'addLimit': function (limit) {
    // console.log(limit+10)
    return limit + 10;
  },
  'hasMore': function (limit) {
    if (limit > Meteor.call('getCurrentHeight')) {
      return false;
    } else {
      return true;
    }
  }
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"publications.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/blocks/server/publications.js                                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }

}, 0);
let Blockscon;
module.link("../blocks.js", {
  Blockscon(v) {
    Blockscon = v;
  }

}, 1);
let Validators;
module.link("../../validators/validators.js", {
  Validators(v) {
    Validators = v;
  }

}, 2);
let Transactions;
module.link("../../transactions/transactions.js", {
  Transactions(v) {
    Transactions = v;
  }

}, 3);
publishComposite('blocks.height', function (limit) {
  return {
    find() {
      return Blockscon.find({}, {
        limit: limit,
        sort: {
          height: -1
        }
      });
    },

    children: [{
      find(block) {
        return Validators.find({
          address: block.proposerAddress
        }, {
          limit: 1
        });
      }

    }]
  };
});
publishComposite('blocks.findOne', function (height) {
  return {
    find() {
      return Blockscon.find({
        height: height
      });
    },

    children: [{
      find(block) {
        return Transactions.find({
          height: block.height
        });
      }

    }, {
      find(block) {
        return Validators.find({
          address: block.proposerAddress
        }, {
          limit: 1
        });
      }

    }]
  };
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"blocks.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/blocks/blocks.js                                                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  Blockscon: () => Blockscon
});
let Mongo;
module.link("meteor/mongo", {
  Mongo(v) {
    Mongo = v;
  }

}, 0);
let Validators;
module.link("../validators/validators.js", {
  Validators(v) {
    Validators = v;
  }

}, 1);
const Blockscon = new Mongo.Collection('blocks');
Blockscon.helpers({
  proposer() {
    return Validators.findOne({
      address: this.proposerAddress
    });
  },

  sorted(limit) {
    return Blockscon.find({}, {
      sort: {
        height: -1
      },
      limit: limit
    });
  }

}); // Blockscon.helpers({
//     sorted(limit) {
//         return Blockscon.find({}, {sort: {height:-1}, limit: limit});
//     }
// });
// Meteor.setInterval(function() {
//     Meteor.call('blocksUpdate', (error, result) => {
//         console.log(result);
//     })
// }, 30000000);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"chain":{"server":{"methods.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/chain/server/methods.js                                                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }

}, 0);
let HTTP;
module.link("meteor/http", {
  HTTP(v) {
    HTTP = v;
  }

}, 1);
let getAddress;
module.link("tendermint/lib/pubkey.js", {
  getAddress(v) {
    getAddress = v;
  }

}, 2);
let Chain, ChainStates;
module.link("../chain.js", {
  Chain(v) {
    Chain = v;
  },

  ChainStates(v) {
    ChainStates = v;
  }

}, 3);
let Validators;
module.link("../../validators/validators.js", {
  Validators(v) {
    Validators = v;
  }

}, 4);
let VotingPowerHistory;
module.link("../../voting-power/history.js", {
  VotingPowerHistory(v) {
    VotingPowerHistory = v;
  }

}, 5);
let Coin;
module.link("../../../../both/utils/coins.js", {
  default(v) {
    Coin = v;
  }

}, 6);

findVotingPower = (validator, genValidators) => {
  for (let v in genValidators) {
    if (validator.pub_key.value == genValidators[v].pub_key.value) {
      return parseInt(genValidators[v].power);
    }
  }
};

Meteor.methods({
  'chain.getConsensusState': function () {
    this.unblock();
    let url = RPC + '/dump_consensus_state';

    try {
      let response = HTTP.get(url);
      let consensus = JSON.parse(response.content);
      consensus = consensus.result;
      let height = consensus.round_state.height;
      let round = consensus.round_state.round;
      let step = consensus.round_state.step;
      let votedPower = Math.round(parseFloat(consensus.round_state.votes[round].prevotes_bit_array.split(" ")[3]) * 100);
      Chain.update({
        chainId: Meteor.settings.public.chainId
      }, {
        $set: {
          votingHeight: height,
          votingRound: round,
          votingStep: step,
          votedPower: votedPower,
          proposerAddress: consensus.round_state.validators.proposer.address,
          prevotes: consensus.round_state.votes[round].prevotes,
          precommits: consensus.round_state.votes[round].precommits
        }
      });
    } catch (e) {
      console.log(url);
      console.log(e);
    }
  },
  'chain.updateStatus': function () {
    this.unblock();
    let url = RPC + '/status';

    try {
      let response = HTTP.get(url);
      let status = JSON.parse(response.content);
      status = status.result;
      let chain = {};
      chain.chainId = status.node_info.network;
      chain.latestBlockHeight = status.sync_info.latest_block_height;
      chain.latestBlockTime = status.sync_info.latest_block_time;
      let latestState = ChainStates.findOne({}, {
        sort: {
          height: -1
        }
      });

      if (latestState && latestState.height >= chain.latestBlockHeight) {
        return "no updates (getting block ".concat(chain.latestBlockHeight, " at block ").concat(latestState.height, ")");
      } // Since Tendermint v0.33, validator page default set to return 30 validators.
      // Query latest height with page 1 and 100 validators per page.


      url = RPC + "/validators?height=".concat(chain.latestBlockHeight, "&page=1&per_page=100");
      response = HTTP.get(url);
      let validators = JSON.parse(response.content);
      validators = validators.result.validators;
      chain.validators = validators.length;
      let activeVP = 0;

      for (v in validators) {
        activeVP += parseInt(validators[v].voting_power);
      }

      chain.activeVotingPower = activeVP;
      Chain.update({
        chainId: chain.chainId
      }, {
        $set: chain
      }, {
        upsert: true
      }); // Get chain states

      if (parseInt(chain.latestBlockHeight) > 0) {
        let chainStates = {};
        chainStates.height = parseInt(status.sync_info.latest_block_height);
        chainStates.time = new Date(status.sync_info.latest_block_time);
        url = LCD + '/staking/pool';

        try {
          response = HTTP.get(url);
          let bonding = JSON.parse(response.content).result; // chain.bondedTokens = bonding.bonded_tokens;
          // chain.notBondedTokens = bonding.not_bonded_tokens;

          chainStates.bondedTokens = parseInt(bonding.bonded_tokens);
          chainStates.notBondedTokens = parseInt(bonding.not_bonded_tokens);
        } catch (e) {
          console.log(url);
          console.log(e);
        }

        if (Coin.StakingCoin.denom) {
          url = LCD + '/supply/total/' + Coin.StakingCoin.denom;

          try {
            response = HTTP.get(url);
            let supply = JSON.parse(response.content).result;
            chainStates.totalSupply = parseInt(supply);
          } catch (e) {
            console.log(url);
            console.log(e);
          }

          url = LCD + '/distribution/community_pool';

          try {
            response = HTTP.get(url);
            let pool = JSON.parse(response.content).result;

            if (pool && pool.length > 0) {
              chainStates.communityPool = [];
              pool.forEach((amount, i) => {
                chainStates.communityPool.push({
                  denom: amount.denom,
                  amount: parseFloat(amount.amount)
                });
              });
            }
          } catch (e) {
            console.log(url);
            console.log(e);
          }

          url = LCD + '/minting/inflation';

          try {
            response = HTTP.get(url);
            let inflation = JSON.parse(response.content).result;

            if (inflation) {
              chainStates.inflation = parseFloat(inflation);
            }
          } catch (e) {
            console.log(url);
            console.log(e);
          }

          url = LCD + '/minting/annual-provisions';

          try {
            response = HTTP.get(url);
            let provisions = JSON.parse(response.content);

            if (provisions) {
              chainStates.annualProvisions = parseFloat(provisions.result);
            }
          } catch (e) {
            console.log(url);
            console.log(e);
          }
        }

        ChainStates.insert(chainStates);
      } // chain.totalVotingPower = totalVP;
      // validators = Validators.find({}).fetch();
      // console.log(validators);


      return chain.latestBlockHeight;
    } catch (e) {
      console.log(url);
      console.log(e);
      return "Error getting chain status.";
    }
  },
  'chain.getLatestStatus': function () {
    Chain.find().sort({
      created: -1
    }).limit(1);
  },
  'chain.genesis': function () {
    let chain = Chain.findOne({
      chainId: Meteor.settings.public.chainId
    });

    if (chain && chain.readGenesis) {
      console.log('Genesis file has been processed');
    } else if (Meteor.settings.debug.readGenesis) {
      console.log('=== Start processing genesis file ===');
      let response = HTTP.get(Meteor.settings.genesisFile);
      let genesis = JSON.parse(response.content);
      let distr = genesis.app_state.distr || genesis.app_state.distribution;
      let chainParams = {
        chainId: genesis.chain_id,
        genesisTime: genesis.genesis_time,
        consensusParams: genesis.consensus_params,
        auth: genesis.app_state.auth,
        bank: genesis.app_state.bank,
        staking: {
          pool: genesis.app_state.staking.pool,
          params: genesis.app_state.staking.params
        },
        mint: genesis.app_state.mint,
        distr: {
          communityTax: distr.community_tax,
          baseProposerReward: distr.base_proposer_reward,
          bonusProposerReward: distr.bonus_proposer_reward,
          withdrawAddrEnabled: distr.withdraw_addr_enabled
        },
        gov: {
          startingProposalId: 0,
          depositParams: {},
          votingParams: {},
          tallyParams: {}
        },
        slashing: {
          params: genesis.app_state.slashing.params
        },
        supply: genesis.app_state.supply,
        crisis: genesis.app_state.crisis
      };

      if (genesis.app_state.gov) {
        chainParams.gov = {
          startingProposalId: genesis.app_state.gov.starting_proposal_id,
          depositParams: genesis.app_state.gov.deposit_params,
          votingParams: genesis.app_state.gov.voting_params,
          tallyParams: genesis.app_state.gov.tally_params
        };
      }

      let totalVotingPower = 0; // read gentx

      if (genesis.app_state.genutil && genesis.app_state.genutil.gentxs && genesis.app_state.genutil.gentxs.length > 0) {
        for (i in genesis.app_state.genutil.gentxs) {
          let msg = genesis.app_state.genutil.gentxs[i].value.msg; // console.log(msg.type);

          for (m in msg) {
            if (msg[m].type == "cosmos-sdk/MsgCreateValidator") {
              console.log(msg[m].value); // let command = Meteor.settings.bin.gaiadebug+" pubkey "+msg[m].value.pubkey;

              let validator = {
                consensus_pubkey: msg[m].value.pubkey,
                description: msg[m].value.description,
                commission: msg[m].value.commission,
                min_self_delegation: msg[m].value.min_self_delegation,
                operator_address: msg[m].value.validator_address,
                delegator_address: msg[m].value.delegator_address,
                voting_power: Math.floor(parseInt(msg[m].value.value.amount) / Coin.StakingCoin.fraction),
                jailed: false,
                status: 2
              };
              totalVotingPower += validator.voting_power;
              let pubkeyValue = Meteor.call('bech32ToPubkey', msg[m].value.pubkey); // Validators.upsert({consensus_pubkey:msg[m].value.pubkey},validator);

              validator.pub_key = {
                "type": "tendermint/PubKeyEd25519",
                "value": pubkeyValue
              };
              validator.address = getAddress(validator.pub_key);
              validator.accpub = Meteor.call('pubkeyToBech32', validator.pub_key, Meteor.settings.public.bech32PrefixAccPub);
              validator.operator_pubkey = Meteor.call('pubkeyToBech32', validator.pub_key, Meteor.settings.public.bech32PrefixValPub);
              VotingPowerHistory.insert({
                address: validator.address,
                prev_voting_power: 0,
                voting_power: validator.voting_power,
                type: 'add',
                height: 0,
                block_time: genesis.genesis_time
              });
              Validators.insert(validator);
            }
          }
        }
      } // read validators from previous chain


      console.log('read validators from previous chain');

      if (genesis.app_state.staking.validators && genesis.app_state.staking.validators.length > 0) {
        console.log(genesis.app_state.staking.validators.length);
        let genValidatorsSet = genesis.app_state.staking.validators;
        let genValidators = genesis.validators;

        for (let v in genValidatorsSet) {
          // console.log(genValidators[v]);
          let validator = genValidatorsSet[v];
          validator.delegator_address = Meteor.call('getDelegator', genValidatorsSet[v].operator_address);
          let pubkeyValue = Meteor.call('bech32ToPubkey', validator.consensus_pubkey);
          validator.pub_key = {
            "type": "tendermint/PubKeyEd25519",
            "value": pubkeyValue
          };
          validator.address = getAddress(validator.pub_key);
          validator.pub_key = validator.pub_key;
          validator.accpub = Meteor.call('pubkeyToBech32', validator.pub_key, Meteor.settings.public.bech32PrefixAccPub);
          validator.operator_pubkey = Meteor.call('pubkeyToBech32', validator.pub_key, Meteor.settings.public.bech32PrefixValPub);
          validator.voting_power = findVotingPower(validator, genValidators);
          totalVotingPower += validator.voting_power;
          Validators.upsert({
            consensus_pubkey: validator.consensus_pubkey
          }, validator);
          VotingPowerHistory.insert({
            address: validator.address,
            prev_voting_power: 0,
            voting_power: validator.voting_power,
            type: 'add',
            height: 0,
            block_time: genesis.genesis_time
          });
        }
      }

      chainParams.readGenesis = true;
      chainParams.activeVotingPower = totalVotingPower;
      let result = Chain.upsert({
        chainId: chainParams.chainId
      }, {
        $set: chainParams
      });
      console.log('=== Finished processing genesis file ===');
    }

    return true;
  }
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"publications.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/chain/server/publications.js                                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }

}, 0);
let Chain, ChainStates;
module.link("../chain.js", {
  Chain(v) {
    Chain = v;
  },

  ChainStates(v) {
    ChainStates = v;
  }

}, 1);
let CoinStats;
module.link("../../coin-stats/coin-stats.js", {
  CoinStats(v) {
    CoinStats = v;
  }

}, 2);
let Validators;
module.link("../../validators/validators.js", {
  Validators(v) {
    Validators = v;
  }

}, 3);
Meteor.publish('chainStates.latest', function () {
  return [ChainStates.find({}, {
    sort: {
      height: -1
    },
    limit: 1
  }), CoinStats.find({}, {
    sort: {
      last_updated_at: -1
    },
    limit: 1
  })];
});
publishComposite('chain.status', function () {
  return {
    find() {
      return Chain.find({
        chainId: Meteor.settings.public.chainId
      });
    },

    children: [{
      find(chain) {
        return Validators.find({}, {
          fields: {
            address: 1,
            description: 1,
            operator_address: 1,
            status: -1,
            jailed: 1,
            profile_url: 1
          }
        });
      }

    }]
  };
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"chain.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/chain/chain.js                                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  Chain: () => Chain,
  ChainStates: () => ChainStates
});
let Mongo;
module.link("meteor/mongo", {
  Mongo(v) {
    Mongo = v;
  }

}, 0);
let Validators;
module.link("../validators/validators.js", {
  Validators(v) {
    Validators = v;
  }

}, 1);
const Chain = new Mongo.Collection('chain');
const ChainStates = new Mongo.Collection('chain_states');
Chain.helpers({
  proposer() {
    return Validators.findOne({
      address: this.proposerAddress
    });
  }

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"coin-stats":{"server":{"methods.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/coin-stats/server/methods.js                                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }

}, 0);
let CoinStats;
module.link("../coin-stats.js", {
  CoinStats(v) {
    CoinStats = v;
  }

}, 1);
let HTTP;
module.link("meteor/http", {
  HTTP(v) {
    HTTP = v;
  }

}, 2);
Meteor.methods({
  'coinStats.getCoinStats': function () {
    this.unblock();
    let coinId = Meteor.settings.public.coingeckoId;

    if (coinId) {
      try {
        let now = new Date();
        now.setMinutes(0);
        let url = "https://api.coingecko.com/api/v3/simple/price?ids=" + coinId + "&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true";
        let response = HTTP.get(url);

        if (response.statusCode == 200) {
          // console.log(JSON.parse(response.content));
          let data = JSON.parse(response.content);
          data = data[coinId]; // console.log(coinStats);

          return CoinStats.upsert({
            last_updated_at: data.last_updated_at
          }, {
            $set: data
          });
        }
      } catch (e) {
        console.log(url);
        console.log(e);
      }
    } else {
      return "No coingecko Id provided.";
    }
  },
  'coinStats.getStats': function () {
    this.unblock();
    let coinId = Meteor.settings.public.coingeckoId;

    if (coinId) {
      return CoinStats.findOne({}, {
        sort: {
          last_updated_at: -1
        }
      });
    } else {
      return "No coingecko Id provided.";
    }
  }
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"coin-stats.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/coin-stats/coin-stats.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  CoinStats: () => CoinStats
});
let Mongo;
module.link("meteor/mongo", {
  Mongo(v) {
    Mongo = v;
  }

}, 0);
const CoinStats = new Mongo.Collection('coin_stats');
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"delegations":{"server":{"methods.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/delegations/server/methods.js                                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }

}, 0);
let Delegations;
module.link("../delegations.js", {
  Delegations(v) {
    Delegations = v;
  }

}, 1);
let Validators;
module.link("../../validators/validators.js", {
  Validators(v) {
    Validators = v;
  }

}, 2);
Meteor.methods({
  'delegations.getDelegations': function () {
    this.unblock();
    let validators = Validators.find({}).fetch();
    let delegations = [];
    console.log("=== Getting delegations ===");

    for (v in validators) {
      if (validators[v].operator_address) {
        let url = LCD + '/staking/validators/' + validators[v].operator_address + "/delegations";

        try {
          let response = HTTP.get(url);

          if (response.statusCode == 200) {
            let delegation = JSON.parse(response.content).result; // console.log(delegation);

            delegations = delegations.concat(delegation);
          } else {
            console.log(response.statusCode);
          }
        } catch (e) {
          console.log(url);
          console.log(e);
        }
      }
    }

    for (i in delegations) {
      if (delegations[i] && delegations[i].shares) delegations[i].shares = parseFloat(delegations[i].shares);
    } // console.log(delegations);


    let data = {
      delegations: delegations,
      createdAt: new Date()
    };
    return Delegations.insert(data);
  }
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"publications.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/delegations/server/publications.js                                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"delegations.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/delegations/delegations.js                                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  Delegations: () => Delegations
});
let Mongo;
module.link("meteor/mongo", {
  Mongo(v) {
    Mongo = v;
  }

}, 0);
const Delegations = new Mongo.Collection('delegations');
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"ledger":{"server":{"methods.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/ledger/server/methods.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _objectSpread;

module.link("@babel/runtime/helpers/objectSpread2", {
  default(v) {
    _objectSpread = v;
  }

}, 0);
let HTTP;
module.link("meteor/http", {
  HTTP(v) {
    HTTP = v;
  }

}, 0);
Meteor.methods({
  'transaction.submit': function (txInfo) {
    const url = "".concat(LCD, "/txs");
    data = {
      "tx": txInfo.value,
      "mode": "sync"
    };
    const timestamp = new Date().getTime();
    console.log("submitting transaction".concat(timestamp, " ").concat(url, " with data ").concat(JSON.stringify(data)));
    let response = HTTP.post(url, {
      data
    });
    console.log("response for transaction".concat(timestamp, " ").concat(url, ": ").concat(JSON.stringify(response)));

    if (response.statusCode == 200) {
      let data = response.data;
      if (data.code) throw new Meteor.Error(data.code, JSON.parse(data.raw_log).message);
      return response.data.txhash;
    }
  },
  'transaction.execute': function (body, path) {
    const url = "".concat(LCD, "/").concat(path);
    data = {
      "base_req": _objectSpread({}, body, {
        "chain_id": Meteor.settings.public.chainId,
        "simulate": false
      })
    };
    let response = HTTP.post(url, {
      data
    });

    if (response.statusCode == 200) {
      return JSON.parse(response.content);
    }
  },
  'transaction.simulate': function (txMsg, from, path) {
    let adjustment = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : '1.2';
    const url = "".concat(LCD, "/").concat(path);
    data = _objectSpread({}, txMsg, {
      "base_req": {
        "from": from,
        "chain_id": Meteor.settings.public.chainId,
        "gas_adjustment": adjustment,
        "simulate": true
      }
    });
    let response = HTTP.post(url, {
      data
    });

    if (response.statusCode == 200) {
      return JSON.parse(response.content).gas_estimate;
    }
  }
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}},"proposals":{"server":{"methods.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/proposals/server/methods.js                                                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _objectSpread;

module.link("@babel/runtime/helpers/objectSpread2", {
  default(v) {
    _objectSpread = v;
  }

}, 0);
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }

}, 0);
let HTTP;
module.link("meteor/http", {
  HTTP(v) {
    HTTP = v;
  }

}, 1);
let Proposals;
module.link("../proposals.js", {
  Proposals(v) {
    Proposals = v;
  }

}, 2);
let Validators;
module.link("../../validators/validators.js", {
  Validators(v) {
    Validators = v;
  }

}, 3);
// import { Promise } from 'meteor/promise';
Meteor.methods({
  'proposals.getProposals': function () {
    this.unblock();

    try {
      let url = LCD + '/gov/proposals';
      let response = HTTP.get(url);
      let proposals = JSON.parse(response.content).result; // console.log(proposals);

      let finishedProposalIds = new Set(Proposals.find({
        "proposal_status": {
          $in: ["Passed", "Rejected", "Removed"]
        }
      }).fetch().map(p => p.proposalId));
      let proposalIds = [];

      if (proposals.length > 0) {
        // Proposals.upsert()
        const bulkProposals = Proposals.rawCollection().initializeUnorderedBulkOp();

        for (let i in proposals) {
          let proposal = proposals[i];
          proposal.proposalId = parseInt(proposal.id);

          if (proposal.proposalId > 0 && !finishedProposalIds.has(proposal.proposalId)) {
            try {
              let url = LCD + '/gov/proposals/' + proposal.proposalId + '/proposer';
              let response = HTTP.get(url);

              if (response.statusCode == 200) {
                let proposer = JSON.parse(response.content).result;

                if (proposer.proposal_id && proposer.proposal_id == proposal.id) {
                  proposal.proposer = proposer.proposer;
                }
              }

              bulkProposals.find({
                proposalId: proposal.proposalId
              }).upsert().updateOne({
                $set: proposal
              });
              proposalIds.push(proposal.proposalId);
            } catch (e) {
              bulkProposals.find({
                proposalId: proposal.proposalId
              }).upsert().updateOne({
                $set: proposal
              });
              proposalIds.push(proposal.proposalId);
              console.log(e.response.content);
            }
          }
        }

        bulkProposals.find({
          proposalId: {
            $nin: proposalIds
          },
          proposal_status: {
            $nin: ["Passed", "Rejected", "Removed"]
          }
        }).update({
          $set: {
            "proposal_status": "Removed"
          }
        });
        bulkProposals.execute();
      }

      return true;
    } catch (e) {
      console.log(e);
    }
  },
  'proposals.getProposalResults': function () {
    this.unblock();
    let proposals = Proposals.find({
      "proposal_status": {
        $nin: ["Passed", "Rejected", "Removed"]
      }
    }).fetch();

    if (proposals && proposals.length > 0) {
      for (let i in proposals) {
        if (parseInt(proposals[i].proposalId) > 0) {
          try {
            // get proposal deposits
            let url = LCD + '/gov/proposals/' + proposals[i].proposalId + '/deposits';
            let response = HTTP.get(url);
            let proposal = {
              proposalId: proposals[i].proposalId
            };

            if (response.statusCode == 200) {
              let deposits = JSON.parse(response.content).result;
              proposal.deposits = deposits;
            }

            url = LCD + '/gov/proposals/' + proposals[i].proposalId + '/votes';
            response = HTTP.get(url);

            if (response.statusCode == 200) {
              let votes = JSON.parse(response.content).result;
              proposal.votes = getVoteDetail(votes);
            }

            url = LCD + '/gov/proposals/' + proposals[i].proposalId + '/tally';
            response = HTTP.get(url);

            if (response.statusCode == 200) {
              let tally = JSON.parse(response.content).result;
              proposal.tally = tally;
            }

            proposal.updatedAt = new Date();
            Proposals.update({
              proposalId: proposals[i].proposalId
            }, {
              $set: proposal
            });
          } catch (e) {}
        }
      }
    }

    return true;
  }
});

const getVoteDetail = votes => {
  if (!votes) {
    return [];
  }

  let voters = votes.map(vote => vote.voter);
  let votingPowerMap = {};
  let validatorAddressMap = {};
  Validators.find({
    delegator_address: {
      $in: voters
    }
  }).forEach(validator => {
    votingPowerMap[validator.delegator_address] = {
      moniker: validator.description.moniker,
      address: validator.address,
      tokens: parseFloat(validator.tokens),
      delegatorShares: parseFloat(validator.delegator_shares),
      deductedShares: parseFloat(validator.delegator_shares)
    };
    validatorAddressMap[validator.operator_address] = validator.delegator_address;
  });
  voters.forEach(voter => {
    if (!votingPowerMap[voter]) {
      // voter is not a validator
      let url = "".concat(LCD, "/staking/delegators/").concat(voter, "/delegations");
      let delegations;
      let votingPower = 0;

      try {
        let response = HTTP.get(url);

        if (response.statusCode == 200) {
          delegations = JSON.parse(response.content).result;

          if (delegations && delegations.length > 0) {
            delegations.forEach(delegation => {
              let shares = parseFloat(delegation.shares);

              if (validatorAddressMap[delegation.validator_address]) {
                // deduct delegated shareds from validator if a delegator votes
                let validator = votingPowerMap[validatorAddressMap[delegation.validator_address]];
                validator.deductedShares -= shares;

                if (validator.delegator_shares != 0) {
                  // avoiding division by zero
                  votingPower += shares / validator.delegatorShares * validator.tokens;
                }
              } else {
                let validator = Validators.findOne({
                  operator_address: delegation.validator_address
                });

                if (validator && validator.delegator_shares != 0) {
                  // avoiding division by zero
                  votingPower += shares / parseFloat(validator.delegator_shares) * parseFloat(validator.tokens);
                }
              }
            });
          }
        }
      } catch (e) {
        console.log(e);
      }

      votingPowerMap[voter] = {
        votingPower: votingPower
      };
    }
  });
  return votes.map(vote => {
    let voter = votingPowerMap[vote.voter];
    let votingPower = voter.votingPower;

    if (votingPower == undefined) {
      // voter is a validator
      votingPower = voter.delegatorShares ? voter.deductedShares / voter.delegatorShares * voter.tokens : 0;
    }

    return _objectSpread({}, vote, {
      votingPower
    });
  });
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"publications.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/proposals/server/publications.js                                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }

}, 0);
let Proposals;
module.link("../proposals.js", {
  Proposals(v) {
    Proposals = v;
  }

}, 1);
let check;
module.link("meteor/check", {
  check(v) {
    check = v;
  }

}, 2);
Meteor.publish('proposals.list', function () {
  return Proposals.find({}, {
    sort: {
      proposalId: -1
    }
  });
});
Meteor.publish('proposals.one', function (id) {
  check(id, Number);
  return Proposals.find({
    proposalId: id
  });
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"proposals.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/proposals/proposals.js                                                                                  //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  Proposals: () => Proposals
});
let Mongo;
module.link("meteor/mongo", {
  Mongo(v) {
    Mongo = v;
  }

}, 0);
const Proposals = new Mongo.Collection('proposals');
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"records":{"server":{"methods.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/records/server/methods.js                                                                               //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }

}, 0);
let Mongo;
module.link("meteor/mongo", {
  Mongo(v) {
    Mongo = v;
  }

}, 1);
let ValidatorRecords, Analytics, AverageData, AverageValidatorData;
module.link("../records.js", {
  ValidatorRecords(v) {
    ValidatorRecords = v;
  },

  Analytics(v) {
    Analytics = v;
  },

  AverageData(v) {
    AverageData = v;
  },

  AverageValidatorData(v) {
    AverageValidatorData = v;
  }

}, 2);
let Validators;
module.link("../../validators/validators.js", {
  Validators(v) {
    Validators = v;
  }

}, 3);
let ValidatorSets;
module.link("/imports/api/validator-sets/validator-sets.js", {
  ValidatorSets(v) {
    ValidatorSets = v;
  }

}, 4);
let Status;
module.link("../../status/status.js", {
  Status(v) {
    Status = v;
  }

}, 5);
let MissedBlocksStats;
module.link("../records.js", {
  MissedBlocksStats(v) {
    MissedBlocksStats = v;
  }

}, 6);
let MissedBlocks;
module.link("../records.js", {
  MissedBlocks(v) {
    MissedBlocks = v;
  }

}, 7);
let Blockscon;
module.link("../../blocks/blocks.js", {
  Blockscon(v) {
    Blockscon = v;
  }

}, 8);
let Chain;
module.link("../../chain/chain.js", {
  Chain(v) {
    Chain = v;
  }

}, 9);

let _;

module.link("lodash", {
  default(v) {
    _ = v;
  }

}, 10);
const BULKUPDATEMAXSIZE = 1000;

const getBlockStats = (startHeight, latestHeight) => {
  let blockStats = {};
  const cond = {
    $and: [{
      height: {
        $gt: startHeight
      }
    }, {
      height: {
        $lte: latestHeight
      }
    }]
  };
  const options = {
    sort: {
      height: 1
    }
  };
  Blockscon.find(cond, options).forEach(block => {
    blockStats[block.height] = {
      height: block.height,
      proposerAddress: block.proposerAddress,
      precommitsCount: block.precommitsCount,
      validatorsCount: block.validatorsCount,
      validators: block.validators,
      time: block.time
    };
  });
  Analytics.find(cond, options).forEach(block => {
    if (!blockStats[block.height]) {
      blockStats[block.height] = {
        height: block.height
      };
      console.log("block ".concat(block.height, " does not have an entry"));
    }

    _.assign(blockStats[block.height], {
      precommits: block.precommits,
      averageBlockTime: block.averageBlockTime,
      timeDiff: block.timeDiff,
      voting_power: block.voting_power
    });
  });
  return blockStats;
};

const getPreviousRecord = (voterAddress, proposerAddress) => {
  let previousRecord = MissedBlocks.findOne({
    voter: voterAddress,
    proposer: proposerAddress,
    blockHeight: -1
  });
  let lastUpdatedHeight = Meteor.settings.params.startHeight;
  let prevStats = {};

  if (previousRecord) {
    prevStats = _.pick(previousRecord, ['missCount', 'totalCount']);
  } else {
    prevStats = {
      missCount: 0,
      totalCount: 0
    };
  }

  return prevStats;
};

Meteor.methods({
  'ValidatorRecords.calculateMissedBlocks': function () {
    if (!COUNTMISSEDBLOCKS) {
      try {
        let startTime = Date.now();
        COUNTMISSEDBLOCKS = true;
        console.log('calulate missed blocks count');
        this.unblock();
        let validators = Validators.find({}).fetch();
        let latestHeight = Meteor.call('blocks.getCurrentHeight');
        let explorerStatus = Status.findOne({
          chainId: Meteor.settings.public.chainId
        });
        let startHeight = explorerStatus && explorerStatus.lastProcessedMissedBlockHeight ? explorerStatus.lastProcessedMissedBlockHeight : Meteor.settings.params.startHeight;
        latestHeight = Math.min(startHeight + BULKUPDATEMAXSIZE, latestHeight);
        const bulkMissedStats = MissedBlocks.rawCollection().initializeOrderedBulkOp();
        let validatorsMap = {};
        validators.forEach(validator => validatorsMap[validator.address] = validator); // a map of block height to block stats

        let blockStats = getBlockStats(startHeight, latestHeight); // proposerVoterStats is a proposer-voter map counting numbers of proposed blocks of which voter is an active validator

        let proposerVoterStats = {};

        _.forEach(blockStats, (block, blockHeight) => {
          let proposerAddress = block.proposerAddress;
          let votedValidators = new Set(block.validators);
          let validatorSets = ValidatorSets.findOne({
            block_height: block.height
          });
          let votedVotingPower = 0;
          validatorSets.validators.forEach(activeValidator => {
            if (votedValidators.has(activeValidator.address)) votedVotingPower += parseFloat(activeValidator.voting_power);
          });
          validatorSets.validators.forEach(activeValidator => {
            let currentValidator = activeValidator.address;

            if (!_.has(proposerVoterStats, [proposerAddress, currentValidator])) {
              let prevStats = getPreviousRecord(currentValidator, proposerAddress);

              _.set(proposerVoterStats, [proposerAddress, currentValidator], prevStats);
            }

            _.update(proposerVoterStats, [proposerAddress, currentValidator, 'totalCount'], n => n + 1);

            if (!votedValidators.has(currentValidator)) {
              _.update(proposerVoterStats, [proposerAddress, currentValidator, 'missCount'], n => n + 1);

              bulkMissedStats.insert({
                voter: currentValidator,
                blockHeight: block.height,
                proposer: proposerAddress,
                precommitsCount: block.precommitsCount,
                validatorsCount: block.validatorsCount,
                time: block.time,
                precommits: block.precommits,
                averageBlockTime: block.averageBlockTime,
                timeDiff: block.timeDiff,
                votingPower: block.voting_power,
                votedVotingPower,
                updatedAt: latestHeight,
                missCount: _.get(proposerVoterStats, [proposerAddress, currentValidator, 'missCount']),
                totalCount: _.get(proposerVoterStats, [proposerAddress, currentValidator, 'totalCount'])
              });
            }
          });
        });

        _.forEach(proposerVoterStats, (voters, proposerAddress) => {
          _.forEach(voters, (stats, voterAddress) => {
            bulkMissedStats.find({
              voter: voterAddress,
              proposer: proposerAddress,
              blockHeight: -1
            }).upsert().updateOne({
              $set: {
                voter: voterAddress,
                proposer: proposerAddress,
                blockHeight: -1,
                updatedAt: latestHeight,
                missCount: _.get(stats, 'missCount'),
                totalCount: _.get(stats, 'totalCount')
              }
            });
          });
        });

        let message = '';

        if (bulkMissedStats.length > 0) {
          const client = MissedBlocks._driver.mongo.client; // TODO: add transaction back after replica set(#146) is set up
          // let session = client.startSession();
          // session.startTransaction();

          let bulkPromise = bulkMissedStats.execute(null
          /*, {session}*/
          ).then(Meteor.bindEnvironment((result, err) => {
            if (err) {
              COUNTMISSEDBLOCKS = false; // Promise.await(session.abortTransaction());

              throw err;
            }

            if (result) {
              // Promise.await(session.commitTransaction());
              message = "(".concat(result.result.nInserted, " inserted, ") + "".concat(result.result.nUpserted, " upserted, ") + "".concat(result.result.nModified, " modified)");
            }
          }));
          Promise.await(bulkPromise);
        }

        COUNTMISSEDBLOCKS = false;
        Status.upsert({
          chainId: Meteor.settings.public.chainId
        }, {
          $set: {
            lastProcessedMissedBlockHeight: latestHeight,
            lastProcessedMissedBlockTime: new Date()
          }
        });
        return "done in ".concat(Date.now() - startTime, "ms ").concat(message);
      } catch (e) {
        COUNTMISSEDBLOCKS = false;
        throw e;
      }
    } else {
      return "updating...";
    }
  },
  'ValidatorRecords.calculateMissedBlocksStats': function () {
    // TODO: deprecate this method and MissedBlocksStats collection
    // console.log("ValidatorRecords.calculateMissedBlocks: "+COUNTMISSEDBLOCKS);
    if (!COUNTMISSEDBLOCKSSTATS) {
      COUNTMISSEDBLOCKSSTATS = true;
      console.log('calulate missed blocks stats');
      this.unblock();
      let validators = Validators.find({}).fetch();
      let latestHeight = Meteor.call('blocks.getCurrentHeight');
      let explorerStatus = Status.findOne({
        chainId: Meteor.settings.public.chainId
      });
      let startHeight = explorerStatus && explorerStatus.lastMissedBlockHeight ? explorerStatus.lastMissedBlockHeight : Meteor.settings.params.startHeight; // console.log(latestHeight);
      // console.log(startHeight);

      const bulkMissedStats = MissedBlocksStats.rawCollection().initializeUnorderedBulkOp();

      for (i in validators) {
        // if ((validators[i].address == "B8552EAC0D123A6BF609123047A5181D45EE90B5") || (validators[i].address == "69D99B2C66043ACBEAA8447525C356AFC6408E0C") || (validators[i].address == "35AD7A2CD2FC71711A675830EC1158082273D457")){
        let voterAddress = validators[i].address;
        let missedRecords = ValidatorRecords.find({
          address: voterAddress,
          exists: false,
          $and: [{
            height: {
              $gt: startHeight
            }
          }, {
            height: {
              $lte: latestHeight
            }
          }]
        }).fetch();
        let counts = {}; // console.log("missedRecords to process: "+missedRecords.length);

        for (b in missedRecords) {
          let block = Blockscon.findOne({
            height: missedRecords[b].height
          });
          let existingRecord = MissedBlocksStats.findOne({
            voter: voterAddress,
            proposer: block.proposerAddress
          });

          if (typeof counts[block.proposerAddress] === 'undefined') {
            if (existingRecord) {
              counts[block.proposerAddress] = existingRecord.count + 1;
            } else {
              counts[block.proposerAddress] = 1;
            }
          } else {
            counts[block.proposerAddress]++;
          }
        }

        for (address in counts) {
          let data = {
            voter: voterAddress,
            proposer: address,
            count: counts[address]
          };
          bulkMissedStats.find({
            voter: voterAddress,
            proposer: address
          }).upsert().updateOne({
            $set: data
          });
        } // }

      }

      if (bulkMissedStats.length > 0) {
        bulkMissedStats.execute(Meteor.bindEnvironment((err, result) => {
          if (err) {
            COUNTMISSEDBLOCKSSTATS = false;
            console.log(err);
          }

          if (result) {
            Status.upsert({
              chainId: Meteor.settings.public.chainId
            }, {
              $set: {
                lastMissedBlockHeight: latestHeight,
                lastMissedBlockTime: new Date()
              }
            });
            COUNTMISSEDBLOCKSSTATS = false;
            console.log("done");
          }
        }));
      } else {
        COUNTMISSEDBLOCKSSTATS = false;
      }

      return true;
    } else {
      return "updating...";
    }
  },
  'Analytics.aggregateBlockTimeAndVotingPower': function (time) {
    this.unblock();
    let now = new Date();

    if (time == 'm') {
      let averageBlockTime = 0;
      let averageVotingPower = 0;
      let analytics = Analytics.find({
        "time": {
          $gt: new Date(Date.now() - 60 * 1000)
        }
      }).fetch();

      if (analytics.length > 0) {
        for (i in analytics) {
          averageBlockTime += analytics[i].timeDiff;
          averageVotingPower += analytics[i].voting_power;
        }

        averageBlockTime = averageBlockTime / analytics.length;
        averageVotingPower = averageVotingPower / analytics.length;
        Chain.update({
          chainId: Meteor.settings.public.chainId
        }, {
          $set: {
            lastMinuteVotingPower: averageVotingPower,
            lastMinuteBlockTime: averageBlockTime
          }
        });
        AverageData.insert({
          averageBlockTime: averageBlockTime,
          averageVotingPower: averageVotingPower,
          type: time,
          createdAt: now
        });
      }
    }

    if (time == 'h') {
      let averageBlockTime = 0;
      let averageVotingPower = 0;
      let analytics = Analytics.find({
        "time": {
          $gt: new Date(Date.now() - 60 * 60 * 1000)
        }
      }).fetch();

      if (analytics.length > 0) {
        for (i in analytics) {
          averageBlockTime += analytics[i].timeDiff;
          averageVotingPower += analytics[i].voting_power;
        }

        averageBlockTime = averageBlockTime / analytics.length;
        averageVotingPower = averageVotingPower / analytics.length;
        Chain.update({
          chainId: Meteor.settings.public.chainId
        }, {
          $set: {
            lastHourVotingPower: averageVotingPower,
            lastHourBlockTime: averageBlockTime
          }
        });
        AverageData.insert({
          averageBlockTime: averageBlockTime,
          averageVotingPower: averageVotingPower,
          type: time,
          createdAt: now
        });
      }
    }

    if (time == 'd') {
      let averageBlockTime = 0;
      let averageVotingPower = 0;
      let analytics = Analytics.find({
        "time": {
          $gt: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }).fetch();

      if (analytics.length > 0) {
        for (i in analytics) {
          averageBlockTime += analytics[i].timeDiff;
          averageVotingPower += analytics[i].voting_power;
        }

        averageBlockTime = averageBlockTime / analytics.length;
        averageVotingPower = averageVotingPower / analytics.length;
        Chain.update({
          chainId: Meteor.settings.public.chainId
        }, {
          $set: {
            lastDayVotingPower: averageVotingPower,
            lastDayBlockTime: averageBlockTime
          }
        });
        AverageData.insert({
          averageBlockTime: averageBlockTime,
          averageVotingPower: averageVotingPower,
          type: time,
          createdAt: now
        });
      }
    } // return analytics.length;

  },
  'Analytics.aggregateValidatorDailyBlockTime': function () {
    this.unblock();
    let validators = Validators.find({}).fetch();
    let now = new Date();

    for (i in validators) {
      let averageBlockTime = 0;
      let blocks = Blockscon.find({
        proposerAddress: validators[i].address,
        "time": {
          $gt: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }, {
        fields: {
          height: 1
        }
      }).fetch();

      if (blocks.length > 0) {
        let blockHeights = [];

        for (b in blocks) {
          blockHeights.push(blocks[b].height);
        }

        let analytics = Analytics.find({
          height: {
            $in: blockHeights
          }
        }, {
          fields: {
            height: 1,
            timeDiff: 1
          }
        }).fetch();

        for (a in analytics) {
          averageBlockTime += analytics[a].timeDiff;
        }

        averageBlockTime = averageBlockTime / analytics.length;
      }

      AverageValidatorData.insert({
        proposerAddress: validators[i].address,
        averageBlockTime: averageBlockTime,
        type: 'ValidatorDailyAverageBlockTime',
        createdAt: now
      });
    }

    return true;
  }
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"publications.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/records/server/publications.js                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }

}, 0);
let ValidatorRecords, Analytics, MissedBlocks, MissedBlocksStats, VPDistributions;
module.link("../records.js", {
  ValidatorRecords(v) {
    ValidatorRecords = v;
  },

  Analytics(v) {
    Analytics = v;
  },

  MissedBlocks(v) {
    MissedBlocks = v;
  },

  MissedBlocksStats(v) {
    MissedBlocksStats = v;
  },

  VPDistributions(v) {
    VPDistributions = v;
  }

}, 1);
let Validators;
module.link("../../validators/validators.js", {
  Validators(v) {
    Validators = v;
  }

}, 2);
Meteor.publish('validator_records.all', function () {
  return ValidatorRecords.find();
});
Meteor.publish('validator_records.uptime', function (address, num) {
  return ValidatorRecords.find({
    address: address
  }, {
    limit: num,
    sort: {
      height: -1
    }
  });
});
Meteor.publish('analytics.history', function () {
  return Analytics.find({}, {
    sort: {
      height: -1
    },
    limit: 50
  });
});
Meteor.publish('vpDistribution.latest', function () {
  return VPDistributions.find({}, {
    sort: {
      height: -1
    },
    limit: 1
  });
});
publishComposite('missedblocks.validator', function (address, type) {
  let conditions = {};

  if (type == 'voter') {
    conditions = {
      voter: address
    };
  } else {
    conditions = {
      proposer: address
    };
  }

  return {
    find() {
      return MissedBlocksStats.find(conditions);
    },

    children: [{
      find(stats) {
        return Validators.find({}, {
          fields: {
            address: 1,
            description: 1,
            profile_url: 1
          }
        });
      }

    }]
  };
});
publishComposite('missedrecords.validator', function (address, type) {
  return {
    find() {
      return MissedBlocks.find({
        [type]: address
      }, {
        sort: {
          updatedAt: -1
        }
      });
    },

    children: [{
      find() {
        return Validators.find({}, {
          fields: {
            address: 1,
            description: 1,
            operator_address: 1
          }
        });
      }

    }]
  };
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"records.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/records/records.js                                                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  ValidatorRecords: () => ValidatorRecords,
  Analytics: () => Analytics,
  MissedBlocksStats: () => MissedBlocksStats,
  MissedBlocks: () => MissedBlocks,
  VPDistributions: () => VPDistributions,
  AverageData: () => AverageData,
  AverageValidatorData: () => AverageValidatorData
});
let Mongo;
module.link("meteor/mongo", {
  Mongo(v) {
    Mongo = v;
  }

}, 0);
let Validators;
module.link("../validators/validators", {
  Validators(v) {
    Validators = v;
  }

}, 1);
const ValidatorRecords = new Mongo.Collection('validator_records');
const Analytics = new Mongo.Collection('analytics');
const MissedBlocksStats = new Mongo.Collection('missed_blocks_stats');
const MissedBlocks = new Mongo.Collection('missed_blocks');
const VPDistributions = new Mongo.Collection('voting_power_distributions');
const AverageData = new Mongo.Collection('average_data');
const AverageValidatorData = new Mongo.Collection('average_validator_data');
MissedBlocksStats.helpers({
  proposerMoniker() {
    let validator = Validators.findOne({
      address: this.proposer
    });
    return validator.description ? validator.description.moniker : this.proposer;
  },

  voterMoniker() {
    let validator = Validators.findOne({
      address: this.voter
    });
    return validator.description ? validator.description.moniker : this.voter;
  }

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"status":{"server":{"publications.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/status/server/publications.js                                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }

}, 0);
let check;
module.link("meteor/check", {
  check(v) {
    check = v;
  }

}, 1);
let Status;
module.link("../status.js", {
  Status(v) {
    Status = v;
  }

}, 2);
Meteor.publish('status.status', function () {
  return Status.find({
    chainId: Meteor.settings.public.chainId
  });
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"status.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/status/status.js                                                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  Status: () => Status
});
let Mongo;
module.link("meteor/mongo", {
  Mongo(v) {
    Mongo = v;
  }

}, 0);
const Status = new Mongo.Collection('status');
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"transactions":{"server":{"methods.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/transactions/server/methods.js                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }

}, 0);
let HTTP;
module.link("meteor/http", {
  HTTP(v) {
    HTTP = v;
  }

}, 1);
let Transactions;
module.link("../../transactions/transactions.js", {
  Transactions(v) {
    Transactions = v;
  }

}, 2);
let Validators;
module.link("../../validators/validators.js", {
  Validators(v) {
    Validators = v;
  }

}, 3);
let VotingPowerHistory;
module.link("../../voting-power/history.js", {
  VotingPowerHistory(v) {
    VotingPowerHistory = v;
  }

}, 4);
const AddressLength = 40;
Meteor.methods({
  'Transactions.index': function (hash, blockTime) {
    this.unblock();
    hash = hash.toUpperCase();
    console.log("Get tx: " + hash);

    try {
      let url = LCD + '/txs/' + hash;
      let response = HTTP.get(url);
      let tx = JSON.parse(response.content);
      console.log(hash);
      tx.height = parseInt(tx.height);
      let txId = Transactions.insert(tx);

      if (txId) {
        return txId;
      } else return false;
    } catch (e) {
      console.log(url);
      console.log(e);
    }
  },
  'Transactions.findDelegation': function (address, height) {
    // following cosmos-sdk/x/slashing/spec/06_events.md and cosmos-sdk/x/staking/spec/06_events.md
    return Transactions.find({
      $or: [{
        $and: [{
          "logs.events.type": "delegate"
        }, {
          "logs.events.attributes.key": "validator"
        }, {
          "logs.events.attributes.value": address
        }]
      }, {
        $and: [{
          "logs.events.attributes.key": "action"
        }, {
          "logs.events.attributes.value": "unjail"
        }, {
          "logs.events.attributes.key": "sender"
        }, {
          "logs.events.attributes.value": address
        }]
      }, {
        $and: [{
          "logs.events.type": "create_validator"
        }, {
          "logs.events.attributes.key": "validator"
        }, {
          "logs.events.attributes.value": address
        }]
      }, {
        $and: [{
          "logs.events.type": "unbond"
        }, {
          "logs.events.attributes.key": "validator"
        }, {
          "logs.events.attributes.value": address
        }]
      }, {
        $and: [{
          "logs.events.type": "redelegate"
        }, {
          "logs.events.attributes.key": "destination_validator"
        }, {
          "logs.events.attributes.value": address
        }]
      }],
      "code": {
        $exists: false
      },
      height: {
        $lt: height
      }
    }, {
      sort: {
        height: -1
      },
      limit: 1
    }).fetch();
  },
  'Transactions.findUser': function (address) {
    let fields = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    // address is either delegator address or validator operator address
    let validator;
    if (!fields) fields = {
      address: 1,
      description: 1,
      operator_address: 1,
      delegator_address: 1
    };

    if (address.includes(Meteor.settings.public.bech32PrefixValAddr)) {
      // validator operator address
      validator = Validators.findOne({
        operator_address: address
      }, {
        fields
      });
    } else if (address.includes(Meteor.settings.public.bech32PrefixAccAddr)) {
      // delegator address
      validator = Validators.findOne({
        delegator_address: address
      }, {
        fields
      });
    } else if (address.length === AddressLength) {
      validator = Validators.findOne({
        address: address
      }, {
        fields
      });
    }

    if (validator) {
      return validator;
    }

    return false;
  }
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"publications.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/transactions/server/publications.js                                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }

}, 0);
let Transactions;
module.link("../transactions.js", {
  Transactions(v) {
    Transactions = v;
  }

}, 1);
let Blockscon;
module.link("../../blocks/blocks.js", {
  Blockscon(v) {
    Blockscon = v;
  }

}, 2);
publishComposite('transactions.list', function () {
  let limit = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 30;
  return {
    find() {
      return Transactions.find({}, {
        sort: {
          height: -1
        },
        limit: limit
      });
    },

    children: [{
      find(tx) {
        return Blockscon.find({
          height: tx.height
        }, {
          fields: {
            time: 1,
            height: 1
          }
        });
      }

    }]
  };
});
publishComposite('transactions.validator', function (validatorAddress, delegatorAddress) {
  let limit = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 100;
  let query = {};

  if (validatorAddress && delegatorAddress) {
    query = {
      $or: [{
        "logs.events.attributes.value": validatorAddress
      }, {
        "logs.events.attributes.value": delegatorAddress
      }]
    };
  }

  if (!validatorAddress && delegatorAddress) {
    query = {
      "logs.events.attributes.value": delegatorAddress
    };
  }

  return {
    find() {
      return Transactions.find(query, {
        sort: {
          height: -1
        },
        limit: limit
      });
    },

    children: [{
      find(tx) {
        return Blockscon.find({
          height: tx.height
        }, {
          fields: {
            time: 1,
            height: 1
          }
        });
      }

    }]
  };
});
publishComposite('transactions.findOne', function (hash) {
  return {
    find() {
      return Transactions.find({
        txhash: hash
      });
    },

    children: [{
      find(tx) {
        return Blockscon.find({
          height: tx.height
        }, {
          fields: {
            time: 1,
            height: 1
          }
        });
      }

    }]
  };
});
publishComposite('transactions.height', function (height) {
  return {
    find() {
      return Transactions.find({
        height: height
      });
    },

    children: [{
      find(tx) {
        return Blockscon.find({
          height: tx.height
        }, {
          fields: {
            time: 1,
            height: 1
          }
        });
      }

    }]
  };
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"transactions.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/transactions/transactions.js                                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  Transactions: () => Transactions
});
let Mongo;
module.link("meteor/mongo", {
  Mongo(v) {
    Mongo = v;
  }

}, 0);
let Blockscon;
module.link("../blocks/blocks.js", {
  Blockscon(v) {
    Blockscon = v;
  }

}, 1);
let TxIcon;
module.link("../../ui/components/Icons.jsx", {
  TxIcon(v) {
    TxIcon = v;
  }

}, 2);
const Transactions = new Mongo.Collection('transactions');
Transactions.helpers({
  block() {
    return Blockscon.findOne({
      height: this.height
    });
  }

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"validators":{"server":{"methods.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/validators/server/methods.js                                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }

}, 0);
let Transactions;
module.link("../../transactions/transactions.js", {
  Transactions(v) {
    Transactions = v;
  }

}, 1);
let Blockscon;
module.link("../../blocks/blocks.js", {
  Blockscon(v) {
    Blockscon = v;
  }

}, 2);
let Delegations;
module.link("../../delegations/delegations.js", {
  Delegations(v) {
    Delegations = v;
  }

}, 3);
Meteor.methods({
  'Validators.findCreateValidatorTime': function (address) {
    // look up the create validator time to consider if the validator has never updated the commission
    let tx = Transactions.findOne({
      $and: [{
        "tx.value.msg.value.delegator_address": address
      }, {
        "tx.value.msg.type": "cosmos-sdk/MsgCreateValidator"
      }, {
        code: {
          $exists: false
        }
      }]
    });

    if (tx) {
      let block = Blockscon.findOne({
        height: tx.height
      });

      if (block) {
        return block.time;
      }
    } else {
      // no such create validator tx
      return false;
    }
  },

  // async 'Validators.getAllDelegations'(address){
  'Validators.getAllDelegations'(address) {
    let url = LCD + '/staking/validators/' + address + '/delegations';

    try {
      let delegations = HTTP.get(url);

      if (delegations.statusCode == 200) {
        delegations = JSON.parse(delegations.content).result;
        delegations.forEach((delegation, i) => {
          if (delegations[i] && delegations[i].shares) delegations[i].shares = parseFloat(delegations[i].shares);
        });
        return delegations;
      }

      ;
    } catch (e) {
      console.log(url);
      console.log(e);
    }
  }

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"publications.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/validators/server/publications.js                                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }

}, 0);
let Validators;
module.link("../validators.js", {
  Validators(v) {
    Validators = v;
  }

}, 1);
let ValidatorRecords;
module.link("../../records/records.js", {
  ValidatorRecords(v) {
    ValidatorRecords = v;
  }

}, 2);
let VotingPowerHistory;
module.link("../../voting-power/history.js", {
  VotingPowerHistory(v) {
    VotingPowerHistory = v;
  }

}, 3);
Meteor.publish('validators.all', function () {
  let sort = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "description.moniker";
  let direction = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : -1;
  let fields = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  return Validators.find({}, {
    sort: {
      [sort]: direction
    },
    fields: fields
  });
});
publishComposite('validators.firstSeen', {
  find() {
    return Validators.find({});
  },

  children: [{
    find(val) {
      return ValidatorRecords.find({
        address: val.address
      }, {
        sort: {
          height: 1
        },
        limit: 1
      });
    }

  }]
});
Meteor.publish('validators.voting_power', function () {
  return Validators.find({
    status: 2,
    jailed: false
  }, {
    sort: {
      voting_power: -1
    },
    fields: {
      address: 1,
      description: 1,
      voting_power: 1,
      profile_url: 1
    }
  });
});
publishComposite('validator.details', function (address) {
  let options = {
    address: address
  };

  if (address.indexOf(Meteor.settings.public.bech32PrefixValAddr) != -1) {
    options = {
      operator_address: address
    };
  }

  return {
    find() {
      return Validators.find(options);
    },

    children: [{
      find(val) {
        return VotingPowerHistory.find({
          address: val.address
        }, {
          sort: {
            height: -1
          },
          limit: 50
        });
      }

    }, {
      find(val) {
        return ValidatorRecords.find({
          address: val.address
        }, {
          sort: {
            height: -1
          },
          limit: Meteor.settings.public.uptimeWindow
        });
      }

    }]
  };
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"validators.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/validators/validators.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  Validators: () => Validators
});
let Mongo;
module.link("meteor/mongo", {
  Mongo(v) {
    Mongo = v;
  }

}, 0);
let ValidatorRecords;
module.link("../records/records.js", {
  ValidatorRecords(v) {
    ValidatorRecords = v;
  }

}, 1);
let VotingPowerHistory;
module.link("../voting-power/history.js", {
  VotingPowerHistory(v) {
    VotingPowerHistory = v;
  }

}, 2);
const Validators = new Mongo.Collection('validators');
Validators.helpers({
  firstSeen() {
    return ValidatorRecords.findOne({
      address: this.address
    });
  },

  history() {
    return VotingPowerHistory.find({
      address: this.address
    }, {
      sort: {
        height: -1
      },
      limit: 50
    }).fetch();
  }

}); // Validators.helpers({
//     uptime(){
//         // console.log(this.address);
//         let lastHundred = ValidatorRecords.find({address:this.address}, {sort:{height:-1}, limit:100}).fetch();
//         console.log(lastHundred);
//         let uptime = 0;
//         for (i in lastHundred){
//             if (lastHundred[i].exists){
//                 uptime+=1;
//             }
//         }
//         return uptime;
//     }
// })
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"voting-power":{"server":{"publications.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/voting-power/server/publications.js                                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"history.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/voting-power/history.js                                                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  VotingPowerHistory: () => VotingPowerHistory
});
let Mongo;
module.link("meteor/mongo", {
  Mongo(v) {
    Mongo = v;
  }

}, 0);
const VotingPowerHistory = new Mongo.Collection('voting_power_history');
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"evidences":{"evidences.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/evidences/evidences.js                                                                                  //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  Evidences: () => Evidences
});
let Mongo;
module.link("meteor/mongo", {
  Mongo(v) {
    Mongo = v;
  }

}, 0);
const Evidences = new Mongo.Collection('evidences');
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"validator-sets":{"validator-sets.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/validator-sets/validator-sets.js                                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  ValidatorSets: () => ValidatorSets
});
let Mongo;
module.link("meteor/mongo", {
  Mongo(v) {
    Mongo = v;
  }

}, 0);
const ValidatorSets = new Mongo.Collection('validator_sets');
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}},"startup":{"both":{"index.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/startup/both/index.js                                                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// Import modules used by both client and server through a single index entry point
// e.g. useraccounts configuration file.
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"server":{"create-indexes.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/startup/server/create-indexes.js                                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let Blockscon;
module.link("../../api/blocks/blocks.js", {
  Blockscon(v) {
    Blockscon = v;
  }

}, 0);
let Proposals;
module.link("../../api/proposals/proposals.js", {
  Proposals(v) {
    Proposals = v;
  }

}, 1);
let ValidatorRecords, Analytics, MissedBlocksStats, MissedBlocks, AverageData, AverageValidatorData;
module.link("../../api/records/records.js", {
  ValidatorRecords(v) {
    ValidatorRecords = v;
  },

  Analytics(v) {
    Analytics = v;
  },

  MissedBlocksStats(v) {
    MissedBlocksStats = v;
  },

  MissedBlocks(v) {
    MissedBlocks = v;
  },

  AverageData(v) {
    AverageData = v;
  },

  AverageValidatorData(v) {
    AverageValidatorData = v;
  }

}, 2);
let Transactions;
module.link("../../api/transactions/transactions.js", {
  Transactions(v) {
    Transactions = v;
  }

}, 3);
let ValidatorSets;
module.link("../../api/validator-sets/validator-sets.js", {
  ValidatorSets(v) {
    ValidatorSets = v;
  }

}, 4);
let Validators;
module.link("../../api/validators/validators.js", {
  Validators(v) {
    Validators = v;
  }

}, 5);
let VotingPowerHistory;
module.link("../../api/voting-power/history.js", {
  VotingPowerHistory(v) {
    VotingPowerHistory = v;
  }

}, 6);
let Evidences;
module.link("../../api/evidences/evidences.js", {
  Evidences(v) {
    Evidences = v;
  }

}, 7);
let CoinStats;
module.link("../../api/coin-stats/coin-stats.js", {
  CoinStats(v) {
    CoinStats = v;
  }

}, 8);
let ChainStates;
module.link("../../api/chain/chain.js", {
  ChainStates(v) {
    ChainStates = v;
  }

}, 9);
ChainStates.rawCollection().createIndex({
  height: -1
}, {
  unique: true
});
Blockscon.rawCollection().createIndex({
  height: -1
}, {
  unique: true
});
Blockscon.rawCollection().createIndex({
  proposerAddress: 1
});
Evidences.rawCollection().createIndex({
  height: -1
});
Proposals.rawCollection().createIndex({
  proposalId: 1
}, {
  unique: true
});
ValidatorRecords.rawCollection().createIndex({
  address: 1,
  height: -1
}, {
  unique: 1
});
ValidatorRecords.rawCollection().createIndex({
  address: 1,
  exists: 1,
  height: -1
});
Analytics.rawCollection().createIndex({
  height: -1
}, {
  unique: true
});
MissedBlocks.rawCollection().createIndex({
  proposer: 1,
  voter: 1,
  updatedAt: -1
});
MissedBlocks.rawCollection().createIndex({
  proposer: 1,
  blockHeight: -1
});
MissedBlocks.rawCollection().createIndex({
  voter: 1,
  blockHeight: -1
});
MissedBlocks.rawCollection().createIndex({
  voter: 1,
  proposer: 1,
  blockHeight: -1
}, {
  unique: true
});
MissedBlocksStats.rawCollection().createIndex({
  proposer: 1
});
MissedBlocksStats.rawCollection().createIndex({
  voter: 1
});
MissedBlocksStats.rawCollection().createIndex({
  proposer: 1,
  voter: 1
}, {
  unique: true
});
AverageData.rawCollection().createIndex({
  type: 1,
  createdAt: -1
}, {
  unique: true
});
AverageValidatorData.rawCollection().createIndex({
  proposerAddress: 1,
  createdAt: -1
}, {
  unique: true
}); // Status.rawCollection.createIndex({})

Transactions.rawCollection().createIndex({
  txhash: 1
}, {
  unique: true
});
Transactions.rawCollection().createIndex({
  height: -1
}); // Transactions.rawCollection().createIndex({action:1});

Transactions.rawCollection().createIndex({
  "events.attributes.key": 1
});
Transactions.rawCollection().createIndex({
  "events.attributes.value": 1
});
ValidatorSets.rawCollection().createIndex({
  block_height: -1
});
Validators.rawCollection().createIndex({
  address: 1
}, {
  unique: true,
  partialFilterExpression: {
    address: {
      $exists: true
    }
  }
});
Validators.rawCollection().createIndex({
  consensus_pubkey: 1
}, {
  unique: true
});
Validators.rawCollection().createIndex({
  "pub_key.value": 1
}, {
  unique: true,
  partialFilterExpression: {
    "pub_key.value": {
      $exists: true
    }
  }
});
VotingPowerHistory.rawCollection().createIndex({
  address: 1,
  height: -1
});
VotingPowerHistory.rawCollection().createIndex({
  type: 1
});
CoinStats.rawCollection().createIndex({
  last_updated_at: -1
}, {
  unique: true
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/startup/server/index.js                                                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.link("./util.js");
module.link("./register-api.js");
module.link("./create-indexes.js");
let onPageLoad;
module.link("meteor/server-render", {
  onPageLoad(v) {
    onPageLoad = v;
  }

}, 0);
let Helmet;
module.link("react-helmet", {
  Helmet(v) {
    Helmet = v;
  }

}, 1);
// import App from '../../ui/App.jsx';
onPageLoad(sink => {
  // const context = {};
  // const sheet = new ServerStyleSheet()
  // const html = renderToString(sheet.collectStyles(
  //     <StaticRouter location={sink.request.url} context={context}>
  //         <App />
  //     </StaticRouter>
  //   ));
  // sink.renderIntoElementById('app', html);
  const helmet = Helmet.renderStatic();
  sink.appendToHead(helmet.meta.toString());
  sink.appendToHead(helmet.title.toString()); // sink.appendToHead(sheet.getStyleTags());
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"register-api.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/startup/server/register-api.js                                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.link("../../api/ledger/server/methods.js");
module.link("../../api/chain/server/methods.js");
module.link("../../api/chain/server/publications.js");
module.link("../../api/blocks/server/methods.js");
module.link("../../api/blocks/server/publications.js");
module.link("../../api/validators/server/methods.js");
module.link("../../api/validators/server/publications.js");
module.link("../../api/records/server/methods.js");
module.link("../../api/records/server/publications.js");
module.link("../../api/proposals/server/methods.js");
module.link("../../api/proposals/server/publications.js");
module.link("../../api/voting-power/server/publications.js");
module.link("../../api/transactions/server/methods.js");
module.link("../../api/transactions/server/publications.js");
module.link("../../api/delegations/server/methods.js");
module.link("../../api/delegations/server/publications.js");
module.link("../../api/status/server/publications.js");
module.link("../../api/accounts/server/methods.js");
module.link("../../api/coin-stats/server/methods.js");
console.log("===== register api done =====");
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"util.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/startup/server/util.js                                                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let bech32;
module.link("bech32", {
  default(v) {
    bech32 = v;
  }

}, 0);
let HTTP;
module.link("meteor/http", {
  HTTP(v) {
    HTTP = v;
  }

}, 1);
let cheerio;
module.link("cheerio", {
  "*"(v) {
    cheerio = v;
  }

}, 2);

// Load future from fibers
var Future = Npm.require("fibers/future"); // Load exec


var exec = Npm.require("child_process").exec;

function toHexString(byteArray) {
  return byteArray.map(function (byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('');
}

Meteor.methods({
  pubkeyToBech32: function (pubkey, prefix) {
    let pubkeyAminoPrefix = Buffer.from('1624DE6420', 'hex');
    let buffer = Buffer.alloc(37);
    pubkeyAminoPrefix.copy(buffer, 0);
    Buffer.from(pubkey.value, 'base64').copy(buffer, pubkeyAminoPrefix.length);
    return bech32.encode(prefix, bech32.toWords(buffer));
  },
  bech32ToPubkey: function (pubkey) {
    let pubkeyAminoPrefix = Buffer.from('1624DE6420', 'hex');
    let buffer = Buffer.from(bech32.fromWords(bech32.decode(pubkey).words));
    return buffer.slice(pubkeyAminoPrefix.length).toString('base64');
  },
  getDelegator: function (operatorAddr) {
    let address = bech32.decode(operatorAddr);
    return bech32.encode(Meteor.settings.public.bech32PrefixAccAddr, address.words);
  },
  getKeybaseTeamPic: function (keybaseUrl) {
    let teamPage = HTTP.get(keybaseUrl);

    if (teamPage.statusCode == 200) {
      let page = cheerio.load(teamPage.content);
      return page(".kb-main-card img").attr('src');
    }
  }
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}},"ui":{"components":{"Icons.jsx":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/ui/components/Icons.jsx                                                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  DenomSymbol: () => DenomSymbol,
  ProposalStatusIcon: () => ProposalStatusIcon,
  VoteIcon: () => VoteIcon,
  TxIcon: () => TxIcon,
  InfoIcon: () => InfoIcon
});
let React;
module.link("react", {
  default(v) {
    React = v;
  }

}, 0);
let UncontrolledTooltip;
module.link("reactstrap", {
  UncontrolledTooltip(v) {
    UncontrolledTooltip = v;
  }

}, 1);

const DenomSymbol = props => {
  switch (props.denom) {
    case "dollar":
      return 'DOLLAR';

    case "mdap":
      return 'mDAP';

    case "steak":
      return '🥩';

    default:
      return '🍅';
  }
};

const ProposalStatusIcon = props => {
  switch (props.status) {
    case 'Passed':
      return /*#__PURE__*/React.createElement("i", {
        className: "fas fa-check-circle text-success"
      });

    case 'Rejected':
      return /*#__PURE__*/React.createElement("i", {
        className: "fas fa-times-circle text-danger"
      });

    case 'Removed':
      return /*#__PURE__*/React.createElement("i", {
        className: "fas fa-trash-alt text-dark"
      });

    case 'DepositPeriod':
      return /*#__PURE__*/React.createElement("i", {
        className: "fas fa-battery-half text-warning"
      });

    case 'VotingPeriod':
      return /*#__PURE__*/React.createElement("i", {
        className: "fas fa-hand-paper text-info"
      });

    default:
      return /*#__PURE__*/React.createElement("i", null);
  }
};

const VoteIcon = props => {
  switch (props.vote) {
    case 'yes':
      return /*#__PURE__*/React.createElement("i", {
        className: "fas fa-check text-success"
      });

    case 'no':
      return /*#__PURE__*/React.createElement("i", {
        className: "fas fa-times text-danger"
      });

    case 'abstain':
      return /*#__PURE__*/React.createElement("i", {
        className: "fas fa-user-slash text-warning"
      });

    case 'no_with_veto':
      return /*#__PURE__*/React.createElement("i", {
        className: "fas fa-exclamation-triangle text-info"
      });

    default:
      return /*#__PURE__*/React.createElement("i", null);
  }
};

const TxIcon = props => {
  if (props.valid) {
    return /*#__PURE__*/React.createElement("span", {
      className: "text-success text-nowrap"
    }, /*#__PURE__*/React.createElement("i", {
      className: "fas fa-check-circle"
    }));
  } else {
    return /*#__PURE__*/React.createElement("span", {
      className: "text-danger text-nowrap"
    }, /*#__PURE__*/React.createElement("i", {
      className: "fas fa-times-circle"
    }));
  }
};

class InfoIcon extends React.Component {
  constructor(props) {
    super(props);
    this.ref = React.createRef();
  }

  render() {
    return [/*#__PURE__*/React.createElement("i", {
      key: "icon",
      className: "material-icons info-icon",
      ref: this.ref
    }, "info"), /*#__PURE__*/React.createElement(UncontrolledTooltip, {
      key: "tooltip",
      placement: "right",
      target: this.ref
    }, this.props.children ? this.props.children : this.props.tooltipText)];
  }

}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}},"both":{"i18n":{"en-us.i18n.yml.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// both/i18n/en-us.i18n.yml.js                                                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Package['universe:i18n'].i18n.addTranslations('en-US','',{"common":{"height":"Height","voter":"Voter","votingPower":"Mining Power","addresses":"Addresses","amounts":"Amounts","delegators":"delegators","block":"block","blocks":"blocks","precommit":"precommit","precommits":"precommits","last":"last","backToList":"Back to List","information":"Information","time":"Time","hash":"Hash","more":"More","fullStop":".","searchPlaceholder":"Search with tx hash / block height / address","cancel":"Cancel","retry":"Retry","rewards":"Rewards"},"navbar":{"siteName":"DP Explorer","version":"beta","validators":"Validators","blocks":"Blocks","transactions":"Transactions","proposals":"Proposals","votingPower":"Mining Power","lang":"ENG","english":"English","spanish":"Español","italian":"Italiano","polish":"Polski","russian":"Русский","chinese":"中文（繁）","simChinese":"中文（简）","license":"LICENSE","forkMe":"OSS"},"consensus":{"consensusState":"Consensus State","round":"Round","step":"Step"},"chainStates":{"price":"Price","marketCap":"Market Cap","inflation":"Inflation","communityPool":"Community Pool"},"chainStatus":{"startMessage":"The chain is going to start in","stopWarning":"The chain appears to be stopped for <em>{$time}</em>! Feed me with new blocks 😭!","latestHeight":"Latest Block Height","averageBlockTime":"Average Block Time","all":"All","now":"Now","allTime":"All Time","lastMinute":"Last Minute","lastHour":"Last Hour","lastDay":"Last Day","seconds":"seconds","activeValidators":"Active Validators","outOfValidators":"out of {$totalValidators} validators","onlineVotingPower":"Online Mining Power","fromTotalStakes":"{$percent} from {$totalStakes} {$denomPlural}"},"analytics":{"blockTimeHistory":"Block Time History","averageBlockTime":"Average Block Time","blockInterval":"Block Interval","noOfValidators":"No. of Validators"},"validators":{"randomValidators":"Random Validators","moniker":"Moniker","uptime":"Uptime","selfPercentage":"Self%","commission":"Commission","lastSeen":"Last Seen","status":"Status","jailed":"Jailed","navActive":"Active","navInactive":"Inactive","active":"Active Validators","inactive":"Inactive Validators","listOfActive":"Here is a list of active validators.","listOfInactive":"Here is a list of inactive validators.","validatorDetails":"Validator Details","lastNumBlocks":"Last {$numBlocks} blocks","validatorInfo":"Validator Info","operatorAddress":"Operator Address","selfDelegationAddress":"Self-Delegate Address","commissionRate":"Commission Rate","maxRate":"Max Rate","maxChangeRate":"Max Change Rate","selfDelegationRatio":"Self Delegation Ratio","proposerPriority":"Proposer Priority","delegatorShares":"Delegator Shares","userDelegateShares":"Shares Delegated by you","tokens":"Tokens","unbondingHeight":"Unbonding Height","unbondingTime":"Unbonding Time","powerChange":"Power Change","delegations":"Delegations","transactions":"Transactions","validatorNotExists":"Validator does not exist.","backToValidator":"Back to Validator","missedBlocks":"Missed Blocks","missedPrecommits":"Missed Precommits","missedBlocksTitle":"Missed blocks of {$moniker}","totalMissed":"Total missed","block":"Block","missedCount":"Miss Count","iDontMiss":"I do not miss ","lastSyncTime":"Last sync time","delegator":"Delegator","amount":"Amount"},"blocks":{"block":"Block","proposer":"Proposer","latestBlocks":"Latest blocks","noBlock":"No block.","numOfTxs":"No. of Txs","numOfTransactions":"No. of Transactions","notFound":"No such block found."},"transactions":{"transaction":"Transaction","transactions":"Transactions","notFound":"No transaction found.","activities":"Activities","txHash":"Tx Hash","valid":"Valid","fee":"Fee","noFee":"No fee","gasUsedWanted":"Gas (used / wanted)","noTxFound":"No such transaction found.","noValidatorTxsFound":"No transaction related to this validator was found.","memo":"Memo","transfer":"Transfer","staking":"Staking","distribution":"Distribution","governance":"Governance","slashing":"Slashing"},"proposals":{"notFound":"No proposal found.","listOfProposals":"Here is a list of governance proposals.","proposer":"Proposer","proposal":"proposal","proposals":"Proposals","proposalID":"Proposal ID","title":"Title","status":"Status","submitTime":"Submit Time","depositEndTime":"Deposit End Time","votingStartTime":"Voting Start Time","votingEndTime":"End Voting Time","totalDeposit":"Total Deposit","description":"Description","proposalType":"Proposal Type","proposalStatus":"Proposal Status","notStarted":"not started","final":"final","deposit":"Deposit","tallyResult":"Tally Result","yes":"Yes","abstain":"Abstain","no":"No","noWithVeto":"No with Veto","percentageVoted":"<span class=\"text-info\">{$percent}</span> of online mining power has been voted.","validMessage":"This proposal is {$tentative}<strong>valid</strong>.","invalidMessage":"Less than {$quorum} of mining power is voted. This proposal is <strong>invalid</strong>.","moreVoteMessage":"It will be a valid proposal once <span class=\"text-info\">{$moreVotes}</span> more votes are casted.","key":"Key","value":"Value","amount":"Amount","recipient":"Recipient","changes":"Changes","subspace":"Subspace"},"votingPower":{"distribution":"Mining Power Distribution","pareto":"Pareto Principle (20/80 rule)","minValidators34":"Min no. of validators hold 34%+ power"},"accounts":{"accountDetails":"Account Details","available":"Available","delegated":"Delegated","unbonding":"Unbonding","rewards":"Rewards","total":"Total","notFound":"This account does not exist. Are you looking for a wrong address?","validators":"Validators","shares":"Shares","mature":"Mature","no":"No ","none":"No ","delegation":"Delegation","plural":"s","signOut":"Sign out","signInText":"You are signed in as ","toLoginAs":"To log in as","signInWithLedger":"Sign In With Ledger","signInWarning":"Please make sure your Ledger device is connected and <strong class=\"text-primary\">Cosmos App 1.5.0 or above</strong> is opened.","pleaseAccept":"please accept in your Ledger device.","noRewards":"No Rewards"},"activities":{"single":"A","happened":"happened.","senders":"The following sender(s)","sent":"sent","receivers":"to the following receipient(s)","received":"received","failedTo":"failed to ","to":"to","from":"from","operatingAt":"operating at","withMoniker":"with moniker","withTitle":"with title","withA":"with a","withAmount":"with <span class=\"text-info\">{$amount}</span>"},"messageTypes":{"send":"Send Fund","multiSend":"MultiSign Send Fund","createValidator":"Create Validator","editValidator":"Edit Validator","delegate":"Delegate","undelegate":"Undelegate","redelegate":"Redelegate","submitProposal":"Submit Proposal","deposit":"Deposit","vote":"Vote","withdrawComission":"Withdraw Commission","withdrawReward":"Withdraw Reward","modifyWithdrawAddress":"Modify Withdraw Address","unjail":"Unjail","IBCTransfer":"IBC Transfer","IBCReceive":"IBC Receive"}});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"es-es.i18n.yml.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// both/i18n/es-es.i18n.yml.js                                                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Package['universe:i18n'].i18n.addTranslations('es-ES','',{"common":{"height":"Altura","voter":"Votante","votingPower":"Poder de votación","addresses":"Direcciones","amounts":"Cantidades","delegators":"delegadores","block":"bloque","blocks":"bloques","precommit":"precommit","precommits":"precommits","last":"último","backToList":"Volver a la lista","information":"Información","time":"Tiempo","hash":"Hash","more":"Más","fullStop":".","searchPlaceholder":"Buscar con el tx hash / altura de bloque / dirección","cancel":"Cancelar","retry":"Reintentar"},"navbar":{"siteName":"DP Explorer","version":"beta","validators":"Validadores","blocks":"Bloques","transactions":"Transacciones","proposals":"Propuestas","votingPower":"Poder de voto","lang":"ES","english":"English","spanish":"Español","italian":"Italiano","polish":"Polski","russian":"Русский","chinese":"中文（繁）","simChinese":"中文（简）","license":"LICENCIA","forkMe":"OSS"},"consensus":{"consensusState":"Estado de consenso","round":"Ronda","step":"Paso"},"chainStates":{"price":"Precio","marketCap":"Capitalización de mercado","inflation":"Inflación","communityPool":"Community Pool"},"chainStatus":{"startMessage":"La cadena comenzará en","stopWarning":"La cadena parece estar parada por <em>{$time}</em>! Dame de comer nuevos bloques 😭!","latestHeight":"Última altura de bloque","averageBlockTime":"Tiempo medio de bloque","all":"Todo","now":"Ahora","allTime":"Todo el tiempo","lastMinute":"Último minuto","lastHour":"Última hora","lastDay":"Último día","seconds":"segundos","activeValidators":"Validadores activos","outOfValidators":"fuera de {$totalValidators} validadores","onlineVotingPower":"Poder de voto en línea","fromTotalStakes":"{$percent} de {$totalStakes} {$denomPlural}"},"analytics":{"blockTimeHistory":"Historial de tiempo de bloque","averageBlockTime":"Tiempo medio de bloque","blockInterval":"Intervalo de bloque","noOfValidators":"No. de validadores"},"validators":{"randomValidators":"Validadores aleatorios","moniker":"Moniker","uptime":"Tiempo de funcionamiento","selfPercentage":"Self%","commission":"Comisión","lastSeen":"Última vez visto","status":"Estado","jailed":"Encarcelado","navActive":"Activo","navInactive":"Inactivo","active":"Validadores activos","inactive":"Validadores inactivos","listOfActive":"Esta es una lista de los validadores activos.","listOfInactive":"Esta es una lista de los validadores inactivos.","validatorDetails":"Detalles del validador","lastNumBlocks":"Último {$numBlocks} bloques","validatorInfo":"Información del validador","operatorAddress":"Dirección de operador","selfDelegationAddress":"Dirección de autodelegación","commissionRate":"Ratio de comisión","maxRate":"Ratio máximo","maxChangeRate":"Ratio máximo de cambio","selfDelegationRatio":"Ratio de autodelegación","proposerPriority":"","delegatorShares":"Acciones del delegador","userDelegateShares":"Acciones delegadas por ti","tokens":"Tokens","unbondingHeight":"Altura ","unbondingTime":"Tiempo para desvincularse","powerChange":"Power Change","delegations":"Delegaciones","transactions":"Transacciones","validatorNotExists":"El validador no existe.","backToValidator":"Volver al validador","missedBlocks":"Bloques perdidos","missedPrecommits":"Precommits perdidos","missedBlocksTitle":"Bloques perdidos de {$moniker}","totalMissed":"Total perdido","block":"Bloque","missedCount":"Perdidos","iDontMiss":"No he perdido ","lastSyncTime":"Último tiempo de sincronización","delegator":"Delegador","amount":"Cantidad"},"blocks":{"block":"Bloque","proposer":"Proposer","latestBlocks":"Últimos bloques","noBlock":"No bloque.","numOfTxs":"No. de txs","numOfTransactions":"No. de transacciones","notFound":"No se ha encontrado tal bloque."},"transactions":{"transaction":"Transacción","transactions":"Transacciones","notFound":"No se encuentra la transacción.","activities":"Movimientos","txHash":"Tx Hash","valid":"Validez","fee":"Comisión","noFee":"No fee","gasUsedWanted":"Gas (usado / deseado)","noTxFound":"No se encontró ninguna transacción de este tipo.","noValidatorTxsFound":"No se encontró ninguna transaccion relacionada con este validador.","memo":"Memo","transfer":"Transferencia","staking":"Participación","distribution":"Distribución","governance":"Gobernanza","slashing":"Recorte"},"proposals":{"notFound":"No se ha encontrado el proposal.","listOfProposals":"Here is a list of governance proposals.","proposer":"Proposer","proposal":"propuesta","proposals":"Propuestas","proposalID":"ID de la propuesta","title":"Título","status":"Estado","submitTime":"Plazo de entrega","depositEndTime":"Final del tiempo de depósito","votingStartTime":"Hora de inicio de la votación","votingEndTime":"Fin del tiempo de votación","totalDeposit":"Depósito total","description":"Descripción","proposalType":"Tipo de propuesta","proposalStatus":"Estado de la propuesta","notStarted":"no iniciado","final":"final","deposit":"Depósito","tallyResult":"Resultado del recuento","yes":"Si","abstain":"Abstención","no":"No","none":"None","noWithVeto":"No con Veto","percentageVoted":"<span class=\"text-info\">{$percent}</span> del poder de voto online ha votado.","validMessage":"Este proposal es {$tentative}<strong>valido</strong>.","invalidMessage":"Menos del {$quorum} del poder de voto ha votado. Este proposal es <strong>invalido</strong>.","moreVoteMessage":"Será una propuesta válida una vez que <span class=\"text-info\">{$moreVotes}</span> más votos se emitan.","key":"Key","value":"Value","amount":"Amount","recipient":"Recipient","changes":"Changes","subspace":"Subspace"},"votingPower":{"distribution":"Distribución del poder de Voto","pareto":"Pareto Principle (20/80 rule)","minValidators34":"Min no. of validators hold 34%+ power"},"accounts":{"accountDetails":"Detalles de la cuenta","available":"Disponible","delegated":"Delegado","unbonding":"Unbonding","rewards":"Rewards","total":"Total","notFound":"Esta cuenta no existe. ¿Estas buscando una dirección equivocada?","validators":"Validadores","shares":"Shares","mature":"Mature","no":"No ","delegation":"Delegación","plural":"s","signOut":"Cerrar sesión","signInText":"Estas registrado como ","toLoginAs":"Para conectarse como","signInWithLedger":"Registrarse con Ledger","signInWarning":"Por favor, asegúrese de que su dispositivo Ledger esté conectado y <strong class=\"text-primary\">la App de Cosmos con la version 1.5.0 o superior</strong> esta abierta.","pleaseAccept":"por favor, acepta en tu dispositivo Ledger.","noRewards":"No Rewards"},"activities":{"single":"A","happened":"sucedió.","senders":"Los siguientes remitentes","sent":"enviado a","receivers":"al siguiente destinatario","received":"recibido","failedTo":"failed to ","to":"a","from":"desde","operatingAt":"operando en","withMoniker":"con el moniker","withTitle":"con el título","withA":"con"},"messageTypes":{"send":"Enviar","multiSend":"Multi Envío","createValidator":"Crear validador","editValidator":"Editar validador","delegate":"Delegar","undelegate":"Undelegar","redelegate":"Redelegar","submitProposal":"Enviar Proposal","deposit":"Depositar","vote":"Voto","withdrawComission":"Enviar comisión","withdrawReward":"Retirar recompensa","modifyWithdrawAddress":"Modificar la dirección de envío","unjail":"Unjail","IBCTransfer":"IBC Transfer","IBCReceive":"IBC Receive"}});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"it-IT.i18n.yml.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// both/i18n/it-IT.i18n.yml.js                                                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Package['universe:i18n'].i18n.addTranslations('it-IT','',{"common":{"height":"Altezza","voter":"Votante","votingPower":"Potere di voto","addresses":"Indirizzi","amounts":"Importi","delegators":"delegatori","block":"blocco","blocks":"blocchi","precommit":"precommit","precommits":"precommit","last":"ultimo","backToList":"Torna alla Lista","information":"Informazioni","time":"Tempo","hash":"Hash","more":"Di più","fullStop":".","searchPlaceholder":"Cerca hash transazione / altezza blocco / indirizzo","cancel":"Annulla","retry":"Riprova","rewards":"Reward"},"navbar":{"siteName":"DP Explorer","version":"beta","validators":"Validatori","blocks":"Blocchi","transactions":"Transazioni","proposals":"Proposte","votingPower":"Potere di Voto","lang":"IT","english":"English","spanish":"Español","italian":"Italiano","polish":"Polski","russian":"Русский","chinese":"中文（繁）","simChinese":"中文（简）","license":"LICENZA","forkMe":"OSS!"},"consensus":{"consensusState":"Stato del consenso","round":"Round","step":"Step"},"chainStates":{"price":"Prezzo","marketCap":"Market Cap","inflation":"Inflazione","communityPool":"Community Pool"},"chainStatus":{"startMessage":"The chain partirà tra","stopWarning":"La chain sembra essersi fermata per <em>{$time}</em>! Dammi nuovi blocchi 😭!","latestHeight":"Ultima Altezza di Blocco","averageBlockTime":"Tempo di Blocco Medio","all":"Tutti","now":"Ora","allTime":"Tutti i tempi","lastMinute":"Ultimo Minuto","lastHour":"Ultima ora","lastDay":"Ultimo giorno","seconds":"secondi","activeValidators":"Validatori Attivi","outOfValidators":"di {$totalValidators} validatori","onlineVotingPower":"Mining Power Attivo","fromTotalStakes":"{$percent} di {$totalStakes} {$denomPlural}"},"analytics":{"blockTimeHistory":"Storia Tempo di Blocco","averageBlockTime":"Tempo di Blocco Medio","blockInterval":"Intervallo di Blocco","noOfValidators":"N. Validatori"},"validators":{"randomValidators":"Validatori random","moniker":"Moniker","uptime":"Uptime","selfPercentage":"% autodelegata","commission":"Commissioni","lastSeen":"Visto per ultimo","status":"Stato","jailed":"Jailato","navActive":"Attivo","navInactive":"Inattivo","active":"Tutti i Validatori","inactive":"Validatori inattivi","listOfActive":"Ecco una lista di validatori attivi.","listOfInactive":"Ecco una lista di validatori inattivi.","validatorDetails":"Dettagli validatore","lastNumBlocks":"Utlimi {$numBlocks} blocchi","validatorInfo":"Info Validatore","operatorAddress":"Indirizzo Operatore","selfDelegationAddress":"Indirizzo di Auto-Delega","commissionRate":"Tasso di commissioni","maxRate":"Tasso massima","maxChangeRate":"Cambiamento del tasso massimo","selfDelegationRatio":"Tasso di Auto Delega","proposerPriority":"Priorità del proponente","delegatorShares":"Percentuale dei delegati","userDelegateShares":"Percentuale delega personale","tokens":"Token","unbondingHeight":"Altezza di unbond","unbondingTime":"Tempo di unbond","powerChange":"Modifica del potere","delegations":"Delegazioni","transactions":"Transazioni","validatorNotExists":"Validatore inesistente","backToValidator":"Torna al validatore","missedBlocks":"Blocchi mancanti","missedPrecommits":"Precommit mancati","missedBlocksTitle":"Manca il blocco: {$moniker}","totalMissed":"Totale perso","block":"Blocco","missedCount":"Mancato conteggio","iDontMiss":"Non mi manca","lastSyncTime":"Ultima sincronizzazione ora","delegator":"Delegante","amount":"Importo"},"blocks":{"block":"Blocco","proposer":"Proponente","latestBlocks":"Ultimi blocchi","noBlock":"Nessun blocco","numOfTxs":"N. Txs","numOfTransactions":"N. di transazioni","notFound":"Nessun blocco trovato."},"transactions":{"transaction":"Transazione","transactions":"Transazioni","notFound":"Nessuna transazione trovata","activities":"Attività","txHash":"Hash Tx","valid":"Valido","fee":"Fee","noFee":"Nessuna fee","gasUsedWanted":"Gas (usato / voluto)","noTxFound":"Nessuna transazione trovata.","noValidatorTxsFound":"Nessuna transazione relativa a questo validatore trovata","memo":"Memo","transfer":"Trasferimento","staking":"Staking","distribution":"Distribuzione","governance":"Governance","slashing":"Slashing"},"proposals":{"notFound":"Nessuna proposta trovata.","listOfProposals":"Questa è la lista delle proposte di governance","proposer":"Proponente","proposal":"Proposta","proposals":"Proposte","proposalID":"ID Proposta","title":"Titolo","status":"Stato","submitTime":"Ora invio","depositEndTime":"Ora di fine deposito","votingStartTime":"Ora di inizio votazione","votingEndTime":"Ora di fine votazione","totalDeposit":"Deposito totale","description":"Descrizione","proposalType":"Tipo di proposta","proposalStatus":"Stato della proposta","notStarted":"Non iniziato","final":"Finale","deposit":"Deposito","tallyResult":"Risultato conteggio","yes":"Sì","abstain":"Astenersi","no":"No","noWithVeto":"No con Veto","percentageVoted":"<span class=\"text-info\">{$percent}</span> di voti raccolti tra i votanti attivi.","validMessage":"Questa proposta è {$tentative}<strong>valida</strong>.","invalidMessage":"Sono stati raccolti meno del {$quorum} di voti. Questa proposta è <strong>invalida</strong>.","moreVoteMessage":"Sarà una proposta valida quando <span class=\"text-info\">{$moreVotes}</span> più voti di ora saranno raccolti.","key":"Key","value":"Value","amount":"Amount","recipient":"Recipient","changes":"Changes","subspace":"Subspace"},"votingPower":{"distribution":"Distribuzione del potere di voto","pareto":"Principio di Pareto (regola 20/80)","minValidators34":"Min n. di validatori che possiede il 34%+ di potere"},"accounts":{"accountDetails":"Dettagli account","available":"Disponibile","delegated":"Delegati","unbonding":"Unbonding","rewards":"Rewards","total":"Totale","notFound":"Questo account non esiste. Forse hai inserito l'indirizzo sbagliato?","validators":"Validatori","shares":"Share","mature":"Maturo","no":"No ","none":"Nessuno","delegation":"Delega","plural":"","signOut":"Esci","signInText":"Registrati come","toLoginAs":"Accedi come","signInWithLedger":"Registrati con un Ledger","signInWarning":"Per favore assicurati che il tuo Ledger sia connesso e <strong class=\"text-primary\">Cosmos App 1.5.0 or above</strong> che sia aperto.","pleaseAccept":"Per favore accetta nel tuo Ledger","noRewards":"Nessun reward"},"activities":{"single":"Un (male), una (female)","happened":"è accaduto.","senders":"I seguenti mittenti","sent":"Inviato","receivers":"I seguenti destinatati","received":"Ricevuto","failedTo":"Ha fallito a ","to":"A","from":"Da","operatingAt":"che operano presso","withMoniker":"con moniker","withTitle":"con titolo","withA":"con un (male) / una (female)"},"messageTypes":{"send":"Invia","multiSend":"Invio multipo","createValidator":"Crea un validatore","editValidator":"Modifica un validatore","delegate":"Delega","undelegate":"Rimuovi delega","redelegate":"Ridelega","submitProposal":"Invia proposta","deposit":"Deposita","vote":"Vota","withdrawComission":"Ritira una commissione","withdrawReward":"Ottieni un reward","modifyWithdrawAddress":"Modifica indirizzo di ritiro","unjail":"Unjail","IBCTransfer":"Trasferisci IBC","IBCReceive":"Ricevi IBC"}});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"pl-PL.i18n.yml.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// both/i18n/pl-PL.i18n.yml.js                                                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Package['universe:i18n'].i18n.addTranslations('pl-PL','',{"common":{"height":"Wysokość","voter":"Głosujący","votingPower":"Siła Głosu","addresses":"Adres","amounts":"Kwota","delegators":"Delegatorzy","block":"blok","blocks":"bloki","precommit":"precommit","precommits":"precommits","last":"ostatni","backToList":"Powrtót do Listy","information":"Informacje","time":"Czas","hash":"Hash","more":"Więcej","fullStop":".","searchPlaceholder":"Wyszukaj adres / transakcję / wysokość bloku","cancel":"Anuluj","retry":"Spróbuj ponownie","rewards":"Nagrody"},"navbar":{"siteName":"DP Explorer","version":"beta","validators":"Walidatorzy","blocks":"Bloki","transactions":"Transakcje","proposals":"Propozycje","votingPower":"Siła Głosu","lang":"PL","english":"English","spanish":"Español","italian":"Italiano","polish":"Polski","russian":"Русский","chinese":"中文（繁）","simChinese":"中文（简）","license":"LICENCJA","forkMe":"OSS"},"consensus":{"consensusState":"Status Konsensusu","round":"Runda","step":"Etap"},"chainStates":{"price":"Cena","marketCap":"Kapitalizacja rynkowa","inflation":"Inflacja","communityPool":"Zasoby Społeczności"},"chainStatus":{"startMessage":"Łańcuch bloków danych rozpocznie działanie za ","topWarning":"Wygląda na to że, łańcuch bloków danych zatrzymał się na <em>{$time}</em>! Odśwież stronę i nakarm mnie nowymi blokami 😭!","latestHeight":"Ostatnia wysokość bloku","averageBlockTime":"Średni Czas Bloku","all":"Całość","now":"Teraz","allTime":"Cały Czas","lastMinute":"Ostatnia Minuta","lastHour":"Ostatnia Godzina","lastDay":"Ostatni Dzień","seconds":"sekund","activeValidators":"Aktywni Walidatorzy","outOfValidators":"z grona {$totalValidators} walidatorów","onlineVotingPower":"Siła Głosu Online","fromTotalStakes":"{$percent} spośród {$totalStakes} {$denomPlural}"},"analytics":{"blockTimeHistory":"Czas Bloków","averageBlockTime":"Średni Czas Bloku","blockInterval":"Interwał Bloku","noOfValidators":"Liczba Walidatorów"},"validators":{"randomValidators":"Losowo Wybrani Walidatorzy","moniker":"Moniker","uptime":"Dyspozycyjność","selfPercentage":"Self%","commission":"Prowizja","lastSeen":"Ostatnio widziany","status":"Status","jailed":"Jailed","navActive":"Aktywni","navInactive":"Nieaktywni","active":"Aktywni Walidatorzy","inactive":"Nieaktywni Walidatorzy","listOfActive":"Lista aktywnych Walidatorów","listOfInactive":"Lista nieaktywnych Walidatorów","validatorDetails":"Szczegóły Walidatora","lastNumBlocks":"Ostatnie {$numBlocks} bloków","validatorInfo":"Szczegóły Walidatora","operatorAddress":"Adres Operatora","selfDelegationAddress":"Adres Delegacji Self","commissionRate":"Wysokość prowizji","maxRate":"Maksymalna Stawka","maxChangeRate":"Maksymalna Stawka Zmiany Prowizji","selfDelegationRatio":"Proporcja Delegacji Self","proposerPriority":"Piorytet Propozycji","delegatorShares":"Akcje Delegującego","userDelegateShares":"Akcje Oddelegowane przez Ciebie","tokens":"Tokeny","unbondingHeight":"Wysokość Unbonding","unbondingTime":"Czas Unbonding","powerChange":"Zmiana Siły Głosu","delegations":"Delegacje","transactions":"Transakcje","validatorNotExists":"Walidator nie istnieje.","backToValidator":"Powrtót do Walidatora","missedBlocks":"Pominięte Bloki","missedPrecommits":"Pominięte Precommits","missedBlocksTitle":"‘Pominięte Bloki od {$moniker}'","totalMissed":"Łącznie pominięto","block":"Blok","missedCount":"Liczba pominiętych","iDontMiss":"Żadne bloki nie zostały pominięte","lastSyncTime":"Ostatni czas synch","delegator":"Delegujący","amount":"Kwota"},"blocks":{"block":"Blok","proposer":"Autor Propozycji","latestBlocks":"Ostatnie Bloki","noBlock":"Ilość Bloków","numOfTxs":"Liczba Txs","numOfTransactions":"Liczba Transakcji","notFound":"Nie znaleziono bloku."},"transactions":{"transaction":"Transakcja","transactions":"Transakcje","notFound":"Nie znaleziono transakcji.","activities":"Aktywność","txHash":"Tx Hash","valid":"Ważna","fee":"Opłata","noFee":"Bezpłatnie","gasUsedWanted":"Gaz (użyty/ wymagany)","noTxFound":"Nie znaleziono podanej transakcji.","noValidatorTxsFound":"Nie znaleziono żadnej transakcji dla podanego Walidatora","memo":"Memo","transfer":"Wysłane","staking":"Udziały","distribution":"Dystrybucja","governance":"Administracja","slashing":"Cięcia"},"proposals":{"notFound":"Nie znaleziono propozycji.'","listOfProposals":"Poniżej znajduje się lista propozycji administracyjnych.","proposer":"Autor Propozycji","proposal":"propozycja","proposals":"Propozycje","proposalID":"ID Propozycji","title":"Tytuł","status":"Status","submitTime":"Czas Wysłania","depositEndTime":"Czas Końcowy dla Skladania Depozytu","votingStartTime":"Czas Rozpoczęcia Głosowania","votingEndTime":"Czas Końcowy Głosowania","totalDeposit":"Kwota Depozytu","description":"Szczegóły","proposalType":"Typ Propozycji","proposalStatus":"Status Propozycji","notStarted":"nie rozpoczęto","final":"końcowy","deposit":"Depozyt","tallyResult":"Wyniki Tally","yes":"Tak","abstain":"Wstrzymaj się od Głosu","no":"Nie","noWithVeto":"Nie z Veto","percentageVoted":"<span class=\"text-info\">{$percent}</span> Głosów Online zostalo oddanych","validMessage":"Podana propozycja jest {$tentative}<strong>ważna</strong>.","invalidMessage":"Mniej niż {$quorum} głosów zostało oddanych. Podana propozycja jest <strong>nieważna</strong>.","moreVoteMessage":"Propozycja zostanie uznana za ważną jeśli <span class=\"text-info\">{$moreVotes}</span> lub więcej głosów zostanie oddanych.","key":"Key","value":"Value","amount":"Kwota","recipient":"Odbiorca","changes":"Zmiany","subspace":"Subspace"},"votingPower":{"distribution":"Podział Siły Głosu","pareto":"Zasada Pareta (zasada 20/80)","minValidators34":"Co najmniej 34% Walidatorów ma prawo do głosowania."},"accounts":{"accountDetails":"Szczegóły Konta","available":"Dostępe","delegated":"Oddelegowane","unbonding":"Unbonding","rewards":"Nagrody","total":"Łącznie","notFound":"Konto nie istnieje. Sprawdź, czy adres odbiorcy został prawidłowo wpisany.","validators":"Walidatorzy","shares":"Akcje","mature":"Dojrzały","no":"Nie ","none":"Brak ","delegation":"Delegacja","plural":"","signOut":"Wyloguj","signInText":"Zalogowany jako ","toLoginAs":"Aby zalogować się jako ","signInWithLedger":"Zaloguj się z Ledgerem","signInWarning":"Upewnij się, że Twój Ledger jest podłączony do komputera oraz aplikacja <strong class=\"text-primary\">Cosmos App 1.5.0 lub nowsza </strong> jest uruchomiona.","pleaseAccept":"zaakceptuj połączenie na Twoim Ledgerze.","noRewards":"Brak Nagród"},"activities":{"single":" ","happened":"został wykonany","senders":"Nadawca","sent":"wysłał","receivers":"do podanych odbiorców/cy","received":"otrzymał","failedTo":"Nie udało się","to":"do","from":"od","operatingAt":"operujący pod adresem","withMoniker":"z monikerem","withTitle":"pod tytułem","withA":"razem z"},"messageTypes":{"send":"Wysłał","multiSend":"Wysłał Multi","createValidator":"Utwórz Walidatora","editValidator":"Edytuj Walidatora","delegate":"Oddelegował","undelegate":"Wycofał Oddelegowane Tokeny","redelegate":"Oddelegował Ponownie","submitProposal":"Wyśłał Propozycję","deposit":"Wpłacił Depozyt","vote":"Zagłosował","withdrawComission":"Wypłacił Prowizję","withdrawReward":"Wypłacił Nagrody","modifyWithdrawAddress":"Zmienił adres do wypłaty","unjail":"Unjail","IBCTransfer":"Wyślij IBC","IBCReceive":"Odbierz IBC"}});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"ru-RU.i18n.yml.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// both/i18n/ru-RU.i18n.yml.js                                                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Package['universe:i18n'].i18n.addTranslations('ru-RU','',{"common":{"height":"высота блока","voter":"избиратель","votingPower":"право голоса","addresses":"Адреса","amounts":"Суммы","delegators":"делегаторы","block":"блок","blocks":"блоки","precommit":"прикоммит","precommits":"прикоммиты","last":"последний","backToList":"назад к списку","information":"информация","time":"время","hash":"хэш","more":"дальше","fullStop":".","searchPlaceholder":"Поиск с хэшем сделки / высотой блока / адресом","cancel":"отменять","retry":"Повторить попытку","rewards":"награды"},"navbar":{"siteName":"DP Explorer","version":"бета","validators":"валидаторы","blocks":"блоки","transactions":"транзакции","proposals":"Предложения","votingPower":"право голоса","lang":"RU","english":"English","spanish":"Español","italian":"Italiano","polish":"Polski","russian":"Русский","chinese":"中文（繁）","simChinese":"中文（简）","license":"ЛИЦЕНЗИЯ","forkMe":"OSS!"},"consensus":{"consensusState":"состояние консенсуса","round":"раунд","step":"этап"},"chainStates":{"price":"расценка","marketCap":"рыночная капитализация","inflation":"Инфляция","communityPool":"коммьюнити пул"},"chainStatus":{"startMessage":"Чейн собирается начать в","stopWarning":"Наверное, чейн остановлен из-за ! Накорми меня новыми блоками 😭!","latestHeight":"Последняя Высота Блока","averageBlockTime":"Среднее Время Блока","all":"Всё","now":"Сейчас","allTime":"всё время","lastMinute":"последняя минута","lastHour":"последний час","lastDay":"последний день","seconds":"секунды","activeValidators":"активные валидаторы","outOfValidators":"из {$totalValidators} валидаторах","onlineVotingPower":"онлайн право голоса","fromTotalStakes":"{$percent} от {$totalStakes} {$denomPlural}"},"analytics":{"blockTimeHistory":"История Времени Блока","averageBlockTime":"Среднее Время Блока","blockInterval":"Интервал Блока","noOfValidators":"количество валидаторов"},"validators":{"randomValidators":"Случайные Валидаторы","moniker":"Кличка","uptime":"Рабочее время","selfPercentage":"Сам%","commission":"Комиссия","lastSeen":"Последний увиденный","status":"Статус","jailed":"Тюрьма","navActive":"Активный","navInactive":"Неактивный","active":"Активные валидаторы","inactive":"Неактивные валидаторы","listOfActive":"Вот список активных валидаторов.","listOfInactive":"Вот список неактивных валидаторов.","validatorDetails":"Детали валидатора","lastNumBlocks":"Последние {$numBlocks} блоки","validatorInfo":"Информация о валидаторе","operatorAddress":"Адрес оператора","selfDelegationAddress":"Адрес самоделегирования","commissionRate":"Ставка Комиссии","maxRate":"Максимальная Ставка","maxChangeRate":"Максимальная Ставка Изменения","selfDelegationRatio":"Коэффициент самостоятельной делегации","proposerPriority":"Приоритет предложения","delegatorShares":"Доли делегатора","userDelegateShares":"Доли, делегированные вами","tokens":"Токены","unbondingHeight":"высота Un-Бондинг","unbondingTime":"Время Un-Бондинг","powerChange":"Изменение власти","delegations":"Делегации","transactions":"транзакции","validatorNotExists":"Валидатор не существует.","backToValidator":"Назад к валидатору","missedBlocks":"Пропущенные блоки","missedPrecommits":"опущенные прикоммиты","missedBlocksTitle":"опущенные блоки {$moniker}","totalMissed":"Всего пропущено","block":"Блок","missedCount":"опущенные отсчеты","iDontMiss":"Я не пропускаю","lastSyncTime":"Последнее время синхронизации","delegator":"Делегатор","amount":"Сумма"},"blocks":{"block":"Блок","proposer":"Предложение","latestBlocks":"Последние блоки","noBlock":"Нет блока.","numOfTxs":"количество сделок","numOfTransactions":"количество сделок","notFound":"Такого блока не найдено."},"transactions":{"transaction":"Сделка","transactions":"Сделки","notFound":"Не найдено.","activities":"Деятельность","txHash":"хэш сделки","valid":"Действительны","fee":"Плата","gasUsedWanted":"Газ (используется / хотел)","noTxFound":"Сделка не найдена","noValidatorTxsFound":"Сделка связанной с этом валидатором не найдена.","memo":"Записка","transfer":"Передача","staking":"Стейкать","distribution":"Распределение","governance":"Управление","slashing":"Сокращение"},"proposals":{"notFound":"Ни одно предложение не найдено.","listOfProposals":"список предложений по управлению","proposer":"Предлагающий","proposal":"Предложение","proposals":"Предложения","proposalID":"ID предложений","title":"Название","status":"Статус","submitTime":"Время Отправки","depositEndTime":"Время Окончания Депозита","votingStartTime":"Время Начала Голосования","votingEndTime":"Время Окончания Голосования","totalDeposit":"Общий депозит","description":"Описание","proposalType":"Тип Предложения","proposalStatus":"Статус Предложения","notStarted":"не начался","final":"окончательный","deposit":"Депозит","tallyResult":"Итог Подсчета","yes":"За","abstain":"Воздержался","no":"Против","noWithVeto":"Против с правом Вето","percentageVoted":"<span class=\"text-info\">{$percent}</span> количество голосов онлайн проголосовало.","validMessage":"Это предположение {$tentative}<strong>действительное</strong>.","invalidMessage":"Меньше чем {$quorum} количество голосов проголосовало. Это предположение <strong>недействительное</strong>.","moreVoteMessage":"Это будет действительным если<span class=\"text-info\">{$moreVotes}</span> большее количество голосов."},"votingPower":{"distribution":"Распределение количество голосов","pareto":"Принцип Парето (правило 20/80)","minValidators34":"Минимальное количество валидаторов c 34%+ количеством голосов"},"accounts":{"accountDetails":"Детали счета","available":"Доступный","delegated":"Делегирование","unbonding":"Un-Бондинг","rewards":"Награды","total":"Общее количество","notFound":"Такого счета не существует. Вы ищете неправильный адрес?","validators":"Валидаторы","shares":"Доли","mature":"Зрелые","no":"Нет","delegation":"Делегация","plural":"множественное число","signOut":"Выйти","signInText":"Войти","toLoginAs":"Войти","signInWithLedger":"Войти с Ledger","signInWarning":"Пожалуйста, убедитесь, что устройство Ledger подключен и <strong class=\"text-primary\">Cosmos App 1.5.0 или выше </strong> открыто.","pleaseAccept":"пожалуйста, примите в свой Ledger устройство."},"activities":{"single":" ","happened":"получилось.","senders":"Следующие отправителя (ей)","sent":"отправлено","receivers":"к следующему получателю(ам)","received":"полученный","failedTo":"не удалось","to":"к","from":"из'","operatingAt":"работающих на","withMoniker":"с кличкой","withTitle":"с названием","withA":"с"},"messageTypes":{"send":"Отправить","multiSend":"Отправить многократно","createValidator":"Создание валидатор","editValidator":"Редактировать валидатор","delegate":"делегировать","undelegate":"Un-делегировать","redelegate":"Ре-делегировать","submitProposal":"Отправлять Предложение","deposit":"Депозит","vote":"Голосовать","withdrawComission":"Выводить Комиссии","withdrawReward":"Выводить Награду","modifyWithdrawAddress":"Изменить Адрес Вывода","unjail":"Un-Джейл","IBCTransfer":"IBC Трансферт","IBCReceive":"IBC Получение"}});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"zh-hans.i18n.yml.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// both/i18n/zh-hans.i18n.yml.js                                                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Package['universe:i18n'].i18n.addTranslations('zh-Hans','',{"common":{"height":"高度","voter":"投票人","votingPower":"算力","addresses":"地址","amounts":"数量","delegators":"委托人","block":"区块","blocks":"区块","precommit":"建块前保证","precommits":"建块前保证","last":"最后","backToList":"回到列表","information":"资讯","time":"时间","hash":"哈希","more":"更多","fullStop":"。","searchPlaceholder":"搜寻交易哈希 / 区块高度 / 地址","cancel":"取消","retry":"重试"},"navbar":{"siteName":"DP Explorer","version":"beta","validators":"验证人","blocks":"区块","transactions":"交易","proposals":"治理提案","votingPower":"算力分布","lang":"中文（简）","english":"English","spanish":"Español","italian":"Italiano","polish":"Polski","russian":"Русский","chinese":"中文（繁）","simChinese":"中文（简）","license":"LICENSE","forkMe":"OSS"},"consensus":{"consensusState":"共识状态","round":"轮数","step":"阶数"},"chainStates":{"price":"价格","marketCap":"市值","inflation":"通胀率","communityPool":"社区储备"},"chainStatus":{"startMessage":"这链将还有以下时间便会开始","stopWarning":"这链似乎已经停了 <em>{$time}</em>！ 请继续喂我吃新的区块 😭!","latestHeight":"最新区块高度","averageBlockTime":"平均区块时间","all":"全部","now":"现在","allTime":"全部","lastMinute":"前一分钟","lastHour":"前一小时","lastDay":"前一天","seconds":"秒","activeValidators":"有效验证人","outOfValidators":"来自总共 {$totalValidators} 个验证人","onlineVotingPower":"在线挖礦算力","fromTotalStakes":"为 {$totalStakes} 颗 {$denom} 的 {$percent}"},"analytics":{"blockTimeHistory":"在线投票权","averageBlockTime":"Average Block Time","blockInterval":"Block Interval","noOfValidators":"No. of Validators"},"validators":{"randomValidators":"随机验证人","moniker":"验证人代号","uptime":"上线时间比重","selfPercentage":"自我委托%","commission":"佣金","lastSeen":"最后投票时间","status":"状态","jailed":"被禁制","navActive":"有效","navInactive":"无效","active":"有效验证人","inactive":"无效验证人","listOfActive":"这名单显示所有有效验证人","listOfInactive":"这名单显示所有无效验证人","validatorDetails":"验证人详情","lastNumBlocks":"最后 {$numBlocks} 个区块","validatorInfo":"验证人资讯","operatorAddress":"操作地址","selfDelegationAddress":"自我委托地址","commissionRate":"佣金","maxRate":"最大佣金限制","maxChangeRate":"每天最大佣金变化限制","selfDelegationRatio":"自我委托比例","proposerPriority":"建块优先权","delegatorShares":"委托股数","userDelegateShares":"你委托的股数","tokens":"代币数量","unbondingHeight":"解绑高度","unbondingTime":"解绑时间","powerChange":"投票权变更","delegations":"委托","transactions":"交易","validatorNotExists":"验证人不存在。","backToValidator":"回到验证人页面","missedBlocks":"错过了的区块","missedPrecommits":"遗留了的建块前保证","missedBlocksTitle":"错过了 {$moniker} 的区块","totalMissed":"一共错过了","block":"区块","missedCount":"错过数量","iDontMiss":"我不会错过任何一个","lastSyncTime":"上一次同步时间","delegator":"委托人","amount":"数量"},"blocks":{"proposer":"建块人","block":"区块","latestBlocks":"最近区块","noBlock":"没有区块。","numOfTxs":"交易数量","numOfTransactions":"交易数量","notFound":"没有这个区块。"},"transactions":{"transaction":"交易","transactions":"交易","notFound":"沒有交易。","activities":"活动","txHash":"交易哈希","valid":"有效","fee":"费用","noFee":"No fee","gasUsedWanted":"瓦斯 (已用 / 要求)","noTxFound":"没有这笔交易。","noValidatorTxsFound":"没有跟这个验证人有关的交易","memo":"备忘录","transfer":"代币转移","staking":"委托","distribution":"收益分配","governance":"链上治理","slashing":"削减"},"proposals":{"notFound":"没有治理提案","listOfProposals":"这名单显示所有治理提案","proposer":"提案人","proposal":"治理提案","proposals":"治理提案","proposalID":"提案编号","title":"主题","status":"状态","submitTime":"提案时间","depositEndTime":"存入押金","votingStartTime":"投票开始时间","votingEndTime":"投票结束时间","totalDeposit":"押金总额","description":"详细内容","proposalType":"提案类型","proposalStatus":"提案状态","notStarted":"未开始","final":"最后结果","deposit":"押金","tallyResult":"投票结果","yes":"赞成","abstain":"弃权","no":"反对","noWithVeto":"强烈反对","percentageVoted":"现时在线投票权的投票率是 <span class=\"text-info\">{$percent}</span>。","validMessage":"这个提案 {$tentative} <strong>有效</strong>.","invalidMessage":"已投票的在线投票权少于 {$quorum}。这个提案 <strong>無效</strong>。","moreVoteMessage":"当再有多 <span class=\"text-info\">{$moreVotes}</span> 投票权投了票的话，这个提案将会有效。","key":"Key","value":"Value","amount":"Amount","recipient":"Recipient","changes":"Changes","subspace":"Subspace"},"votingPower":{"distribution":"投票权分布","pareto":"帕累托原则 (20/80 定率)","minValidators34":"最少合共有超过 34% 投票权的验证人"},"accounts":{"accountDetails":"帐户详情","available":"可用的","delegated":"委托中","unbonding":"解绑中","rewards":"未取回收益","total":"总共","notFound":"这个帐户不存在。你是否在查看一个错误的地址？","validators":"验证人","shares":"股数","mature":"成熟日期","no":"没有","none":"没有","delegation":"委托","plural":"","signOut":"登出","signInText":"你已登录以下帐户","toLoginAs":"登录以下帐户","signInWithLedger":"透过 Ledger 登录","signInWarning":"请确定你已经连接 Ledger 设备，并已开启 <strong class=\"text-primary\">Cosmos App 版本 1.5.0 或以上</strong>。","pleaseAccept":"请从你的 Ledger 设备确认。","noRewards":"No Rewards"},"activities":{"single":"一个","happened":"发生了","senders":"以下的帐户","sent":"发了","receivers":"到以下的帐户","received":"收到","failedTo":"未能","to":"到","from":"从","operatingAt":"操作地址为","withMoniker":"而验证人代号为","withTitle":"治理提案主题为","withA":"投了"},"messageTypes":{"send":"发送資金","multiSend":"多重簽名发送資金","createValidator":"建立验证人","editValidator":"编辑验证人资料","delegate":"委托","undelegate":"解委托","redelegate":"转委托","submitProposal":"提交议案","deposit":"存入","vote":"投票","withdrawComission":"提取手续费","withdrawReward":"提取收益","modifyWithdrawAddress":"更改收益取回地址","unjail":"赦免","IBCTransfer":"IBC Transfer","IBCReceive":"IBC Receive"}});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"zh-hant.i18n.yml.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// both/i18n/zh-hant.i18n.yml.js                                                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Package['universe:i18n'].i18n.addTranslations('zh-Hant','',{"common":{"height":"高度","voter":"投票人","votingPower":"算力權","addresses":"地址","amounts":"數量","delegators":"委托人","block":"區塊","blocks":"區塊","precommit":"建塊前保證","precommits":"建塊前保證","last":"最後","backToList":"回到列表","information":"資訊","time":"時間","hash":"哈希","more":"更多","fullStop":"。","searchPlaceholder":"搜尋交易哈希 / 區塊高度 / 地址","cancel":"取消","retry":"重試"},"navbar":{"siteName":"DP Explorer","version":"beta","validators":"驗證人","blocks":"區塊","transactions":"交易","proposals":"治理提案","votingPower":"算力權分佈","lang":"中文（繁）","english":"English","spanish":"Español","italian":"Italiano","polish":"Polski","russian":"Русский","chinese":"中文（繁）","simChinese":"中文（简）","license":"LICENSE","forkMe":"OSS"},"consensus":{"consensusState":"共識狀態","round":"輪數","step":"階數"},"chainStates":{"price":"價格","marketCap":"市值","inflation":"通漲率","communityPool":"社區儲備"},"chainStatus":{"startMessage":"這鏈將還有以下時間便會開始","stopWarning":"這鏈似乎已經停了 <em>{$time}</em>！ 請繼續餵我吃新的區塊 😭!","latestHeight":"最新區塊高度","averageBlockTime":"平均區塊時間","all":"全部","now":"現在","allTime":"全部","lastMinute":"前一分鐘","lastHour":"前一小時","lastDay":"前一天","seconds":"秒","activeValidators":"有效驗證人","outOfValidators":"來自總共 {$totalValidators} 個驗證人","onlineVotingPower":"在線挖礦","fromTotalStakes":"為 {$totalStakes} 顆 {$denom} 的 {$percent}"},"analytics":{"blockTimeHistory":"在線投票權","averageBlockTime":"Average Block Time","blockInterval":"Block Interval","noOfValidators":"No. of Validators"},"validators":{"randomValidators":"隨機驗證人","moniker":"驗證人代號","uptime":"上線時間比重","selfPercentage":"自我委托%","commission":"佣金","lastSeen":"最後投票時間","status":"狀態","jailed":"被禁制","navActive":"有效","navInactive":"無效","active":"有效驗證人","inactive":"無效驗證人","listOfActive":"這名單顯示所有有效驗證人","listOfInactive":"這名單顯示所有無效驗證人","validatorDetails":"驗證人詳情","lastNumBlocks":"最後 {$numBlocks} 個區塊","validatorInfo":"驗證人資訊","operatorAddress":"操作地址","selfDelegationAddress":"自我委托地址","commissionRate":"佣金","maxRate":"最大佣金限制","maxChangeRate":"每天最大佣金變化限制","selfDelegationRatio":"自我委托比列","proposerPriority":"建塊優先權","delegatorShares":"委托股數","userDelegateShares":"你委托的股數","tokens":"代幣數量","unbondingHeight":"解綁高度","unbondingTime":"解綁時間","powerChange":"投票權變更","delegations":"委托","transactions":"交易","validatorNotExists":"驗證人不存在。","backToValidator":"回到驗證人頁面","missedBlocks":"錯過了的區塊","missedPrecommits":"遺留了的建塊前保證","missedBlocksTitle":"錯過了 {$moniker} 的區塊","totalMissed":"一共錯過了","block":"區塊","missedCount":"錯過數量","iDontMiss":"我不會錯過任何一個","lastSyncTime":"上一次同步時間","delegator":"委托人","amount":"數量"},"blocks":{"proposer":"建塊人","block":"區塊","latestBlocks":"最近區塊","noBlock":"沒有區塊。","numOfTxs":"交易數量","numOfTransactions":"交易數量","notFound":"沒有這個區塊。"},"transactions":{"transaction":"交易","transactions":"交易","notFound":"沒有交易。","activities":"活動","txHash":"交易哈希","valid":"有效","fee":"費用","noFee":"No fee","gasUsedWanted":"瓦斯 (已用 / 要求)","noTxFound":"沒有這筆交易。","noValidatorTxsFound":"沒有跟這個驗證人有關的交易","memo":"備忘錄","transfer":"代幣轉移","staking":"委托","distribution":"收益分配","governance":"鏈上治理","slashing":"削減"},"proposals":{"notFound":"沒有治理提案","listOfProposals":"這名單顯示所有治理提案","proposer":"提案人","proposal":"治理提案","proposals":"治理提案","proposalID":"提案編號","title":"主題","status":"狀態","submitTime":"提案時間","depositEndTime":"存入押金","votingStartTime":"投票開始時間","votingEndTime":"投票結束時間","totalDeposit":"押金總額","description":"詳細內容","proposalType":"提案類型","proposalStatus":"提案狀態","notStarted":"未開始","final":"最後結果","deposit":"押金","tallyResult":"投票結果","yes":"贊成","abstain":"棄權","no":"反對","none":"反對","noWithVeto":"強烈反對","percentageVoted":"現時在線投票權的投票率是 <span class=\"text-info\">{$percent}</span>。","validMessage":"這個提案 {$tentative} <strong>有效</strong>.","invalidMessage":"已投票的在線投票權少於 {$quorum}。這個 <strong>無效</strong>。","moreVoteMessage":"當再有多 <span class=\"text-info\">{$moreVotes}</span> 投票權投了票的話，這個提案將會有效。","key":"Key","value":"Value","amount":"Amount","recipient":"Recipient","changes":"Changes","subspace":"Subspace"},"votingPower":{"distribution":"投票權分佈","pareto":"帕累托原則 (20/80 定率)","minValidators34":"最少合共有超過 34% 投票權的驗證人"},"accounts":{"accountDetails":"帳戶詳情","available":"可用的","delegated":"委托中","unbonding":"解綁中","rewards":"未取回收益","total":"總共","notFound":"這個帳戶不存在。你是否在查看一個錯誤的地址？","validators":"驗證人","shares":"股數","mature":"成熟日期","no":"沒有","delegation":"委托","plural":"","signOut":"登出","signInText":"你已登入以下帳戶","toLoginAs":"登入以下帳戶","signInWithLedger":"透過 Ledger 登入","signInWarning":"請確定你已經連接 Ledger 設備，並已開啓 <strong class=\"text-primary\">Cosmos App 版本 1.5.0 或以上</strong>。","pleaseAccept":"請從你的 Ledger 設備確認。","noRewards":"No Rewards"},"activities":{"single":"一個","happened":"發生了","senders":"以下的帳戶","sent":"發了","receivers":"到以下的帳戶","received":"收到","failedTo":"未能","to":"到","from":"從","operatingAt":"操作地止為","withMoniker":"而驗證人代號為","withTitle":"治理提案主題為","withA":"投了"},"messageTypes":{"send":"發送錢","multiSend":"多簽發送","createValidator":"建立驗證人","editValidator":"編輯驗證人資料","delegate":"委托","undelegate":"解委托","redelegate":"轉委托","submitProposal":"提交議案","deposit":"存入","vote":"投票","withdrawComission":"提取手續費","withdrawReward":"提取收益","modifyWithdrawAddress":"更改收益取回地址","unjail":"赦免","IBCTransfer":"IBC Transfer","IBCReceive":"IBC Receive"}});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"utils":{"coins.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// both/utils/coins.js                                                                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  default: () => Coin
});
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }

}, 0);
let numbro;
module.link("numbro", {
  default(v) {
    numbro = v;
  }

}, 1);

autoformat = value => {
  let formatter = '0,0.0000';
  value = Math.round(value * 1000) / 1000;
  if (Math.round(value) === value) formatter = '0,0';else if (Math.round(value * 10) === value * 10) formatter = '0,0.0';else if (Math.round(value * 100) === value * 100) formatter = '0,0.00';else if (Math.round(value * 1000) === value * 1000) formatter = '0,0.000';
  return numbro(value).format(formatter);
};

const coinList = Meteor.settings.public.coins;

for (let i in coinList) {
  const coin = coinList[i];

  if (!coin.displayNamePlural) {
    coin.displayNamePlural = coin.displayName + 's';
  }
}

const digitalMoney = function (n, nom) {
  const fraction = ['角', '分'];
  const digit = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const unit = [['元', '万', '亿'], ['', '拾', '佰', '仟']];
  const head = n < 0 ? '欠' : '';
  n = Math.abs(n);
  let s = '';

  for (let i = 0; i < fraction.length; i++) {
    s += (digit[Math.floor(n * 10 * Math.pow(10, i)) % 10] + fraction[i]).replace(/零./, '');
  }

  s = s || '整';
  n = Math.floor(n);

  for (let i = 0; i < unit[0].length && n > 0; i++) {
    let p = '';

    for (let j = 0; j < unit[1].length && n > 0; j++) {
      p = digit[n % 10] + unit[1][j] + p;
      n = Math.floor(n / 10);
    }

    s = p.replace(/(零.)*零$/, '').replace(/^$/, '零') + unit[0][i] + s;
  }

  return head + s.replace(/(零.)*零元/, '元').replace(/(零.)+/g, '零').replace(/^整$/, '零整');
};

const digitalCoin = function (n, nom) {
  const symbol = new String(nom).toUpperCase();
  const fraction = ['角', '分'];
  const digit = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const unit = [[symbol, '万', '亿'], ['', '拾', '佰', '仟']];
  const head = n < 0 ? '负' : '';
  n = Math.abs(n);
  let s = '';

  for (let i = 0; i < fraction.length; i++) {
    s += (digit[Math.floor(n * 10 * Math.pow(10, i)) % 10] + fraction[i]).replace(/零./, '');
  }

  s = s || '整';
  n = Math.floor(n);

  for (let i = 0; i < unit[0].length && n > 0; i++) {
    let p = '';

    for (let j = 0; j < unit[1].length && n > 0; j++) {
      p = digit[n % 10] + unit[1][j] + p;
      n = Math.floor(n / 10);
    }

    s = p.replace(/(零.)*零$/, '').replace(/^$/, '零') + unit[0][i] + s;
  }

  return head + s.replace(/(零.)*零元/, '').replace(/(零.)+/g, '零').replace(/^整$/, '零整');
};

class Coin {
  constructor(amount) {
    let denom = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Meteor.settings.public.bondDenom;
    const lowerDenom = denom.toLowerCase();
    this._coin = coinList.find(coin => coin.denom.toLowerCase() === lowerDenom || coin.displayName.toLowerCase() === lowerDenom);

    if (this._coin) {
      if (lowerDenom === this._coin.denom.toLowerCase()) {
        this._amount = Number(amount);
      } else if (lowerDenom === this._coin.displayName.toLowerCase()) {
        this._amount = Number(amount) * this._coin.fraction;
      }
    } else {
      this._coin = "";
      this._amount = Number(amount);
    }
  }

  get amount() {
    return this._amount;
  }

  get stakingAmount() {
    return this._coin ? this._amount / this._coin.fraction : this._amount;
  }

  toString(precision) {
    // default to display in mint denom if it has more than 4 decimal places
    let minStake = Coin.StakingCoin.fraction / (precision ? Math.pow(10, precision) : 10000);

    if (this.amount < minStake) {
      return "".concat(numbro(this.amount).format('0,0.0000'), " ").concat(this._coin.denom);
    } else {
      return "".concat(precision ? numbro(this.stakingAmount).format('0,0.' + '0'.repeat(precision)) : autoformat(this.stakingAmount), " ").concat(this._coin.displayName);
    }
  }

  mintString(formatter) {
    let amount = this.amount;

    if (formatter) {
      amount = numbro(amount).format(formatter);
    }

    let denom = this._coin == "" ? Coin.StakingCoin.displayName : this._coin.denom;
    return "".concat(amount, " ").concat(denom);
  }

  stakeString(formatter) {
    let amount = this.stakingAmount;

    if (formatter) {
      amount = numbro(amount).format(formatter);
    }

    return "".concat(amount, " ").concat(Coin.StakingCoin.displayName);
  }

  toHanString() {
    // default to display in mint denom if it has more than 4 decimal places
    let minStake = Coin.StakingCoin.fraction / 1000;

    if (this.amount < minStake) {
      return "".concat(numbro(this.amount).format('0,0.0000'), " ").concat(this._coin.denom);
    } else {
      return "".concat(digitalCoin(this.stakingAmount, this._coin.displayName));
    }
  }

}

Coin.StakingCoin = coinList.find(coin => coin.denom === Meteor.settings.public.bondDenom);
Coin.MinStake = 1 / Number(Coin.StakingCoin.fraction);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"erros.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// both/utils/erros.js                                                                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  default: () => ErrorCheck
});
let numbro;
module.link("numbro", {
  default(v) {
    numbro = v;
  }

}, 0);
const errors = {
  "sdk": {
    1: "Internal Error",
    2: "Tx Decode Error",
    3: "Invalid Sequence Number",
    4: "Unauthorized",
    5: "Insufficient Funds",
    6: "Unknown Request",
    7: "Invalid Address",
    8: "Invalid PubKey",
    9: "Unknown Address",
    10: "Insufficient Coins",
    11: "Invalid Coins",
    12: "Out Of Gas",
    13: "Memo Too Large",
    14: "Insufficient Fee",
    15: "Too Many Signatures",
    16: "Gas Overflow",
    17: "No Signatures"
  },
  "staking": {
    101: "Invalid Validator",
    102: "Invalid Delegation",
    103: "Invalid Input",
    104: "Validator Jailed"
  },
  "gov": {
    1: "Unknown Proposal",
    2: "Inactive Proposal",
    3: "Already Active Proposal",
    4: "Already Finished Proposal",
    5: "Address Not Staked",
    6: "Invalid Title",
    7: "Invalid Description",
    8: "Invalid Proposal Type",
    9: "Invalid Vote",
    10: "Invalid Genesis",
    11: "Invalid Proposal Status"
  },
  "distr": {
    103: "Invalid Input",
    104: "No Distribution Info",
    105: "No Validator Commission",
    106: "Set Withdraw Addrress Disabled"
  },
  "bank": {
    101: "Send Disabled",
    102: "Invalid Inputs Outputs"
  },
  "slashing": {
    101: "Invalid Validator",
    102: "Validator Jailed",
    103: "Validator Not Jailed",
    104: "Missing Self Delegation",
    105: "Self Delegation Too Low"
  }
};

class ErrorCheck {
  constructor(code, codespace, payload) {
    this.code = code;
    this.space = codespace;
    this.message = "Unknown error";
    this.payload = payload;
    this.process();
  }

  foundError() {
    return errors.hasOwnProperty(this.space);
  }

  GetMessage() {
    return this.message;
  }

  process() {
    if (this.foundError()) {
      if (errors[this.space].hasOwnProperty(this.code)) {
        this.message = errors[this.space][this.code];
      }

      if (this.space == "sdk" && this.code == 12) {
        const {
          gas_used,
          gas_wanted
        } = this.payload;
        this.message = this.message + "gas uses (" + numbro(gas_used).format("0,0") + ") > gas wanted (" + numbro(gas_wanted).format("0,0") + ")";
      }
    }
  }

}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}},"server":{"main.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// server/main.js                                                                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.link("/imports/startup/server");
module.link("/imports/startup/both");
// import moment from 'moment';
// import '/imports/api/blocks/blocks.js';
SYNCING = false;
COUNTMISSEDBLOCKS = false;
COUNTMISSEDBLOCKSSTATS = false;
RPC = Meteor.settings.remote.rpc;
LCD = Meteor.settings.remote.lcd;
timerBlocks = 0;
timerChain = 0;
timerConsensus = 0;
timerProposal = 0;
timerProposalsResults = 0;
timerMissedBlock = 0;
timerDelegation = 0;
timerAggregate = 0;
const DEFAULTSETTINGS = '/default_settings.json';

updateChainStatus = () => {
  Meteor.call('chain.updateStatus', (error, result) => {
    if (error) {
      console.log("updateStatus: " + error);
    } else {
      console.log("updateStatus: " + result);
    }
  });
};

updateBlock = () => {
  Meteor.call('blocks.blocksUpdate', (error, result) => {
    if (error) {
      console.log("updateBlocks: " + error);
    } else {
      console.log("updateBlocks: " + result);
    }
  });
};

getConsensusState = () => {
  Meteor.call('chain.getConsensusState', (error, result) => {
    if (error) {
      console.log("get consensus: " + error);
    }
  });
};

getProposals = () => {
  Meteor.call('proposals.getProposals', (error, result) => {
    if (error) {
      console.log("get proposal: " + error);
    }

    if (result) {
      console.log("get proposal: " + result);
    }
  });
};

getProposalsResults = () => {
  Meteor.call('proposals.getProposalResults', (error, result) => {
    if (error) {
      console.log("get proposals result: " + error);
    }

    if (result) {
      console.log("get proposals result: " + result);
    }
  });
};

updateMissedBlocks = () => {
  Meteor.call('ValidatorRecords.calculateMissedBlocks', (error, result) => {
    if (error) {
      console.log("missed blocks error: " + error);
    }

    if (result) {
      console.log("missed blocks ok:" + result);
    }
  });
  /*
      Meteor.call('ValidatorRecords.calculateMissedBlocksStats', (error, result) =>{
          if (error){
              console.log("missed blocks stats error: "+ error)
          }
          if (result){
              console.log("missed blocks stats ok:" + result);
          }
      });
  */
};

getDelegations = () => {
  Meteor.call('delegations.getDelegations', (error, result) => {
    if (error) {
      console.log("get delegations error: " + error);
    } else {
      console.log("get delegations ok: " + result);
    }
  });
};

aggregateMinutely = () => {
  // doing something every min
  Meteor.call('Analytics.aggregateBlockTimeAndVotingPower', "m", (error, result) => {
    if (error) {
      console.log("aggregate minutely block time error: " + error);
    } else {
      console.log("aggregate minutely block time ok: " + result);
    }
  });
  Meteor.call('coinStats.getCoinStats', (error, result) => {
    if (error) {
      console.log("get coin stats error: " + error);
    } else {
      console.log("get coin stats ok: " + result);
    }
  });
};

aggregateHourly = () => {
  // doing something every hour
  Meteor.call('Analytics.aggregateBlockTimeAndVotingPower', "h", (error, result) => {
    if (error) {
      console.log("aggregate hourly block time error: " + error);
    } else {
      console.log("aggregate hourly block time ok: " + result);
    }
  });
};

aggregateDaily = () => {
  // doing somthing every day
  Meteor.call('Analytics.aggregateBlockTimeAndVotingPower', "d", (error, result) => {
    if (error) {
      console.log("aggregate daily block time error: " + error);
    } else {
      console.log("aggregate daily block time ok: " + result);
    }
  });
  Meteor.call('Analytics.aggregateValidatorDailyBlockTime', (error, result) => {
    if (error) {
      console.log("aggregate validators block time error:" + error);
    } else {
      console.log("aggregate validators block time ok:" + result);
    }
  });
};

Meteor.startup(function () {
  if (Meteor.isDevelopment) {
    let DEFAULTSETTINGSJSON;
    module.link("../default_settings.json", {
      default(v) {
        DEFAULTSETTINGSJSON = v;
      }

    }, 0);
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
    Object.keys(DEFAULTSETTINGSJSON).forEach(key => {
      if (Meteor.settings[key] == undefined) {
        console.warn("CHECK SETTINGS JSON: ".concat(key, " is missing from settings"));
        Meteor.settings[key] = {};
      }

      Object.keys(DEFAULTSETTINGSJSON[key]).forEach(param => {
        if (Meteor.settings[key][param] == undefined) {
          console.warn("CHECK SETTINGS JSON: ".concat(key, ".").concat(param, " is missing from settings"));
          Meteor.settings[key][param] = DEFAULTSETTINGSJSON[key][param];
        }
      });
    });
  }

  Meteor.call('chain.genesis', (err, result) => {
    if (err) {
      console.log(err);
    }

    if (result) {
      if (Meteor.settings.debug.startTimer) {
        timerConsensus = Meteor.setInterval(function () {
          getConsensusState();
        }, Meteor.settings.params.consensusInterval);
        timerBlocks = Meteor.setInterval(function () {
          updateBlock();
        }, Meteor.settings.params.blockInterval);
        timerChain = Meteor.setInterval(function () {
          updateChainStatus();
        }, Meteor.settings.params.statusInterval);

        if (Meteor.settings.params.proposalInterval >= 0) {
          timerProposal = Meteor.setInterval(function () {
            getProposals();
          }, Meteor.settings.params.proposalInterval);
          timerProposalsResults = Meteor.setInterval(function () {
            getProposalsResults();
          }, Meteor.settings.params.proposalInterval);
        }

        timerMissedBlock = Meteor.setInterval(function () {
          updateMissedBlocks();
        }, Meteor.settings.params.missedBlocksInterval);
        timerDelegation = Meteor.setInterval(function () {
          getDelegations();
        }, Meteor.settings.params.delegationInterval);
        timerAggregate = Meteor.setInterval(function () {
          let now = new Date();

          if (now.getUTCSeconds() == 0) {
            aggregateMinutely();
          }

          if (now.getUTCMinutes() == 0 && now.getUTCSeconds() == 0) {
            aggregateHourly();
          }

          if (now.getUTCHours() == 0 && now.getUTCMinutes() == 0 && now.getUTCSeconds() == 0) {
            aggregateDaily();
          }
        }, 1000);
      }
    }
  });
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"default_settings.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// default_settings.json                                                                                               //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "public": {
    "chainName": "Cosmos Testnet",
    "chainId": "{Chain ID}",
    "gtm": "{Add your Google Tag Manager ID here}",
    "slashingWindow": 10000,
    "uptimeWindow": 250,
    "initialPageSize": 30,
    "secp256k1": false,
    "bech32PrefixAccAddr": "cosmos",
    "bech32PrefixAccPub": "cosmospub",
    "bech32PrefixValAddr": "cosmosvaloper",
    "bech32PrefixValPub": "cosmosvaloperpub",
    "bech32PrefixConsAddr": "cosmosvalcons",
    "bech32PrefixConsPub": "cosmosvalconspub",
    "bondDenom": "uatom",
    "powerReduction": 1000000,
    "coins": [
      {
        "denom": "uatom",
        "displayName": "ATOM",
        "displayNamePlural": "ATOMS",
        "fraction": 1000000
      },
      {
        "denom": "umuon",
        "displayName": "MUON",
        "displayNamePlural": "MUONS",
        "fraction": 1000000
      }
    ],
    "gasPrice": 0.02,
    "coingeckoId": "cosmos"
  },
  "genesisFile": "{Replace the address of the genesis file of the chain}",
  "remote": {
    "rpc": "https://gaia-seeds.interblock.io",
    "lcd": "https://gaia-seeds.interblock.io:1317"
  },
  "debug": {
    "startTimer": true,
    "readGenesis": true
  },
  "params": {
    "startHeight": 0,
    "defaultBlockTime": 5000,
    "blockInterval": 15000,
    "consensusInterval": 1000,
    "statusInterval": 7500,
    "signingInfoInterval": 1800000,
    "proposalInterval": 5000,
    "missedBlocksInterval": 60000,
    "delegationInterval": 900000
  }
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},{
  "extensions": [
    ".js",
    ".json",
    ".jsx",
    ".mjs",
    ".i18n.yml"
  ]
});

require("/both/i18n/en-us.i18n.yml.js");
require("/both/i18n/es-es.i18n.yml.js");
require("/both/i18n/it-IT.i18n.yml.js");
require("/both/i18n/pl-PL.i18n.yml.js");
require("/both/i18n/ru-RU.i18n.yml.js");
require("/both/i18n/zh-hans.i18n.yml.js");
require("/both/i18n/zh-hant.i18n.yml.js");
require("/both/utils/coins.js");
require("/both/utils/erros.js");
require("/server/main.js");
//# sourceURL=meteor://💻app/app/app.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvaW1wb3J0cy9hcGkvYWNjb3VudHMvc2VydmVyL21ldGhvZHMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL2ltcG9ydHMvYXBpL2Jsb2Nrcy9zZXJ2ZXIvbWV0aG9kcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvaW1wb3J0cy9hcGkvYmxvY2tzL3NlcnZlci9wdWJsaWNhdGlvbnMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL2ltcG9ydHMvYXBpL2Jsb2Nrcy9ibG9ja3MuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL2ltcG9ydHMvYXBpL2NoYWluL3NlcnZlci9tZXRob2RzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9pbXBvcnRzL2FwaS9jaGFpbi9zZXJ2ZXIvcHVibGljYXRpb25zLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9pbXBvcnRzL2FwaS9jaGFpbi9jaGFpbi5qcyIsIm1ldGVvcjovL/CfkrthcHAvaW1wb3J0cy9hcGkvY29pbi1zdGF0cy9zZXJ2ZXIvbWV0aG9kcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvaW1wb3J0cy9hcGkvY29pbi1zdGF0cy9jb2luLXN0YXRzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9pbXBvcnRzL2FwaS9kZWxlZ2F0aW9ucy9zZXJ2ZXIvbWV0aG9kcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvaW1wb3J0cy9hcGkvZGVsZWdhdGlvbnMvZGVsZWdhdGlvbnMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL2ltcG9ydHMvYXBpL2xlZGdlci9zZXJ2ZXIvbWV0aG9kcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvaW1wb3J0cy9hcGkvcHJvcG9zYWxzL3NlcnZlci9tZXRob2RzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9pbXBvcnRzL2FwaS9wcm9wb3NhbHMvc2VydmVyL3B1YmxpY2F0aW9ucy5qcyIsIm1ldGVvcjovL/CfkrthcHAvaW1wb3J0cy9hcGkvcHJvcG9zYWxzL3Byb3Bvc2Fscy5qcyIsIm1ldGVvcjovL/CfkrthcHAvaW1wb3J0cy9hcGkvcmVjb3Jkcy9zZXJ2ZXIvbWV0aG9kcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvaW1wb3J0cy9hcGkvcmVjb3Jkcy9zZXJ2ZXIvcHVibGljYXRpb25zLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9pbXBvcnRzL2FwaS9yZWNvcmRzL3JlY29yZHMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL2ltcG9ydHMvYXBpL3N0YXR1cy9zZXJ2ZXIvcHVibGljYXRpb25zLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9pbXBvcnRzL2FwaS9zdGF0dXMvc3RhdHVzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9pbXBvcnRzL2FwaS90cmFuc2FjdGlvbnMvc2VydmVyL21ldGhvZHMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL2ltcG9ydHMvYXBpL3RyYW5zYWN0aW9ucy9zZXJ2ZXIvcHVibGljYXRpb25zLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9pbXBvcnRzL2FwaS90cmFuc2FjdGlvbnMvdHJhbnNhY3Rpb25zLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9pbXBvcnRzL2FwaS92YWxpZGF0b3JzL3NlcnZlci9tZXRob2RzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9pbXBvcnRzL2FwaS92YWxpZGF0b3JzL3NlcnZlci9wdWJsaWNhdGlvbnMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL2ltcG9ydHMvYXBpL3ZhbGlkYXRvcnMvdmFsaWRhdG9ycy5qcyIsIm1ldGVvcjovL/CfkrthcHAvaW1wb3J0cy9hcGkvdm90aW5nLXBvd2VyL2hpc3RvcnkuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL2ltcG9ydHMvYXBpL2V2aWRlbmNlcy9ldmlkZW5jZXMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL2ltcG9ydHMvYXBpL3ZhbGlkYXRvci1zZXRzL3ZhbGlkYXRvci1zZXRzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9pbXBvcnRzL3N0YXJ0dXAvYm90aC9pbmRleC5qcyIsIm1ldGVvcjovL/CfkrthcHAvaW1wb3J0cy9zdGFydHVwL3NlcnZlci9jcmVhdGUtaW5kZXhlcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvaW1wb3J0cy9zdGFydHVwL3NlcnZlci9pbmRleC5qcyIsIm1ldGVvcjovL/CfkrthcHAvaW1wb3J0cy9zdGFydHVwL3NlcnZlci9yZWdpc3Rlci1hcGkuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL2ltcG9ydHMvc3RhcnR1cC9zZXJ2ZXIvdXRpbC5qcyIsIm1ldGVvcjovL/CfkrthcHAvaW1wb3J0cy91aS9jb21wb25lbnRzL0ljb25zLmpzeCIsIm1ldGVvcjovL/CfkrthcHAvYm90aC91dGlscy9jb2lucy5qcyIsIm1ldGVvcjovL/CfkrthcHAvYm90aC91dGlscy9lcnJvcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvc2VydmVyL21haW4uanMiXSwibmFtZXMiOlsiTWV0ZW9yIiwibW9kdWxlIiwibGluayIsInYiLCJIVFRQIiwiVmFsaWRhdG9ycyIsImZldGNoRnJvbVVybCIsInVybCIsInJlcyIsImdldCIsIkxDRCIsInN0YXR1c0NvZGUiLCJlIiwiY29uc29sZSIsImxvZyIsIm1ldGhvZHMiLCJhZGRyZXNzIiwidW5ibG9jayIsImF2YWlsYWJsZSIsInJlc3BvbnNlIiwiSlNPTiIsInBhcnNlIiwiY29udGVudCIsInJlc3VsdCIsImFjY291bnQiLCJ0eXBlIiwidmFsdWUiLCJCYXNlVmVzdGluZ0FjY291bnQiLCJCYXNlQWNjb3VudCIsImFjY291bnRfbnVtYmVyIiwiYmFsYW5jZSIsImRlbGVnYXRpb25zIiwidW5ib25kaW5nIiwicmV3YXJkcyIsInRvdGFsX3Jld2FyZHMiLCJ0b3RhbCIsInZhbGlkYXRvciIsImZpbmRPbmUiLCIkb3IiLCJvcGVyYXRvcl9hZGRyZXNzIiwiZGVsZWdhdG9yX2FkZHJlc3MiLCJ2YWxfY29tbWlzc2lvbiIsImxlbmd0aCIsImNvbW1pc3Npb24iLCJkYXRhIiwic2hhcmVzIiwicGFyc2VGbG9hdCIsInJlbGVnYXRpb25zIiwiY29tcGxldGlvblRpbWUiLCJmb3JFYWNoIiwicmVsZWdhdGlvbiIsImVudHJpZXMiLCJ0aW1lIiwiRGF0ZSIsImNvbXBsZXRpb25fdGltZSIsInJlZGVsZWdhdGlvbkNvbXBsZXRpb25UaW1lIiwidW5kZWxlZ2F0aW9ucyIsInVuYm9uZGluZ0NvbXBsZXRpb25UaW1lIiwiZGVsZWdhdGlvbiIsImkiLCJ1bmJvbmRpbmdzIiwicmVkZWxlZ2F0aW9ucyIsInJlZGVsZWdhdGlvbiIsInZhbGlkYXRvcl9kc3RfYWRkcmVzcyIsImNvdW50IiwiZGlkX2FkZHJlc3MiLCJuYW1lIiwiUHJvbWlzZSIsIkJsb2Nrc2NvbiIsIkNoYWluIiwiVmFsaWRhdG9yU2V0cyIsIlZhbGlkYXRvclJlY29yZHMiLCJBbmFseXRpY3MiLCJWUERpc3RyaWJ1dGlvbnMiLCJWb3RpbmdQb3dlckhpc3RvcnkiLCJUcmFuc2FjdGlvbnMiLCJFdmlkZW5jZXMiLCJzaGEyNTYiLCJnZXRBZGRyZXNzIiwiY2hlZXJpbyIsImdldFJlbW92ZWRWYWxpZGF0b3JzIiwicHJldlZhbGlkYXRvcnMiLCJ2YWxpZGF0b3JzIiwicCIsInNwbGljZSIsImdldFZhbGlkYXRvclByb2ZpbGVVcmwiLCJpZGVudGl0eSIsInRoZW0iLCJwaWN0dXJlcyIsInByaW1hcnkiLCJzdHJpbmdpZnkiLCJpbmRleE9mIiwidGVhbVBhZ2UiLCJwYWdlIiwibG9hZCIsImF0dHIiLCJibG9ja3MiLCJmaW5kIiwicHJvcG9zZXJBZGRyZXNzIiwiZmV0Y2giLCJoZWlnaHRzIiwibWFwIiwiYmxvY2siLCJoZWlnaHQiLCJibG9ja3NTdGF0cyIsIiRpbiIsInRvdGFsQmxvY2tEaWZmIiwiYiIsInRpbWVEaWZmIiwiY29sbGVjdGlvbiIsInJhd0NvbGxlY3Rpb24iLCJwaXBlbGluZSIsIiRtYXRjaCIsIiRzb3J0IiwiJGxpbWl0Iiwic2V0dGluZ3MiLCJwdWJsaWMiLCJ1cHRpbWVXaW5kb3ciLCIkdW53aW5kIiwiJGdyb3VwIiwiJGNvbmQiLCIkZXEiLCJhd2FpdCIsImFnZ3JlZ2F0ZSIsInRvQXJyYXkiLCJSUEMiLCJzdGF0dXMiLCJzeW5jX2luZm8iLCJsYXRlc3RfYmxvY2tfaGVpZ2h0IiwiY3VyckhlaWdodCIsInNvcnQiLCJsaW1pdCIsInN0YXJ0SGVpZ2h0IiwicGFyYW1zIiwiU1lOQ0lORyIsInVudGlsIiwiY2FsbCIsImN1cnIiLCJ2YWxpZGF0b3JTZXQiLCJjb25zZW5zdXNfcHVia2V5IiwidG90YWxWYWxpZGF0b3JzIiwiT2JqZWN0Iiwia2V5cyIsInN0YXJ0QmxvY2tUaW1lIiwiYW5hbHl0aWNzRGF0YSIsImJ1bGtWYWxpZGF0b3JzIiwiaW5pdGlhbGl6ZVVub3JkZXJlZEJ1bGtPcCIsImJ1bGtWYWxpZGF0b3JSZWNvcmRzIiwiYnVsa1ZQSGlzdG9yeSIsImJ1bGtUcmFuc2F0aW9ucyIsInN0YXJ0R2V0SGVpZ2h0VGltZSIsImJsb2NrRGF0YSIsImhhc2giLCJibG9ja19pZCIsInRyYW5zTnVtIiwidHhzIiwiaGVhZGVyIiwibGFzdEJsb2NrSGFzaCIsImxhc3RfYmxvY2tfaWQiLCJwcm9wb3Nlcl9hZGRyZXNzIiwicHJlY29tbWl0cyIsImxhc3RfY29tbWl0Iiwic2lnbmF0dXJlcyIsInB1c2giLCJ2YWxpZGF0b3JfYWRkcmVzcyIsInQiLCJCdWZmZXIiLCJmcm9tIiwiZXJyIiwiZXZpZGVuY2UiLCJpbnNlcnQiLCJwcmVjb21taXRzQ291bnQiLCJlbmRHZXRIZWlnaHRUaW1lIiwic3RhcnRHZXRWYWxpZGF0b3JzVGltZSIsImJsb2NrX2hlaWdodCIsInBhcnNlSW50IiwidmFsaWRhdG9yc0NvdW50Iiwic3RhcnRCbG9ja0luc2VydFRpbWUiLCJlbmRCbG9ja0luc2VydFRpbWUiLCJleGlzdGluZ1ZhbGlkYXRvcnMiLCIkZXhpc3RzIiwicmVjb3JkIiwiZXhpc3RzIiwidm90aW5nX3Bvd2VyIiwiaiIsIm51bUJsb2NrcyIsInVwdGltZSIsImJhc2UiLCJ1cHNlcnQiLCJ1cGRhdGVPbmUiLCIkc2V0IiwibGFzdFNlZW4iLCJjaGFpblN0YXR1cyIsImNoYWluSWQiLCJjaGFpbl9pZCIsImxhc3RTeW5jZWRUaW1lIiwiYmxvY2tUaW1lIiwiZGVmYXVsdEJsb2NrVGltZSIsImRhdGVMYXRlc3QiLCJkYXRlTGFzdCIsIk1hdGgiLCJhYnMiLCJnZXRUaW1lIiwiZW5kR2V0VmFsaWRhdG9yc1RpbWUiLCJ1cGRhdGUiLCJhdmVyYWdlQmxvY2tUaW1lIiwic3RhcnRGaW5kVmFsaWRhdG9yc05hbWVUaW1lIiwicHJvcG9zZXJfcHJpb3JpdHkiLCJ2YWxFeGlzdCIsInB1Yl9rZXkiLCJhY2NwdWIiLCJiZWNoMzJQcmVmaXhBY2NQdWIiLCJvcGVyYXRvcl9wdWJrZXkiLCJiZWNoMzJQcmVmaXhWYWxQdWIiLCJiZWNoMzJQcmVmaXhDb25zUHViIiwidmFsaWRhdG9yRGF0YSIsImRlc2NyaXB0aW9uIiwicHJvZmlsZV91cmwiLCJqYWlsZWQiLCJtaW5fc2VsZl9kZWxlZ2F0aW9uIiwidG9rZW5zIiwiZGVsZWdhdG9yX3NoYXJlcyIsImJvbmRfaGVpZ2h0IiwiYm9uZF9pbnRyYV90eF9jb3VudGVyIiwidW5ib25kaW5nX2hlaWdodCIsInVuYm9uZGluZ190aW1lIiwic2VsZl9kZWxlZ2F0aW9uIiwicHJldl92b3RpbmdfcG93ZXIiLCJibG9ja190aW1lIiwic2VsZkRlbGVnYXRpb24iLCJwcmV2Vm90aW5nUG93ZXIiLCJjaGFuZ2VUeXBlIiwiY2hhbmdlRGF0YSIsInJlbW92ZWRWYWxpZGF0b3JzIiwiciIsImRiVmFsaWRhdG9ycyIsImZpZWxkcyIsImNvblB1YktleSIsInVuZGVmaW5lZCIsInByb2ZpbGVVcmwiLCJlbmRGaW5kVmFsaWRhdG9yc05hbWVUaW1lIiwic3RhcnRBbmF5dGljc0luc2VydFRpbWUiLCJlbmRBbmFseXRpY3NJbnNlcnRUaW1lIiwic3RhcnRWVXBUaW1lIiwiZXhlY3V0ZSIsImVuZFZVcFRpbWUiLCJzdGFydFZSVGltZSIsImVuZFZSVGltZSIsImFjdGl2ZVZhbGlkYXRvcnMiLCJudW1Ub3BUd2VudHkiLCJjZWlsIiwibnVtQm90dG9tRWlnaHR5IiwidG9wVHdlbnR5UG93ZXIiLCJib3R0b21FaWdodHlQb3dlciIsIm51bVRvcFRoaXJ0eUZvdXIiLCJudW1Cb3R0b21TaXh0eVNpeCIsInRvcFRoaXJ0eUZvdXJQZXJjZW50IiwiYm90dG9tU2l4dHlTaXhQZXJjZW50IiwidnBEaXN0IiwibnVtVmFsaWRhdG9ycyIsInRvdGFsVm90aW5nUG93ZXIiLCJjcmVhdGVBdCIsImVuZEJsb2NrVGltZSIsImxhc3RCbG9ja3NTeW5jZWRUaW1lIiwicHVibGlzaENvbXBvc2l0ZSIsImNoaWxkcmVuIiwiZXhwb3J0IiwiTW9uZ28iLCJDb2xsZWN0aW9uIiwiaGVscGVycyIsInByb3Bvc2VyIiwic29ydGVkIiwiQ2hhaW5TdGF0ZXMiLCJDb2luIiwiZGVmYXVsdCIsImZpbmRWb3RpbmdQb3dlciIsImdlblZhbGlkYXRvcnMiLCJwb3dlciIsImNvbnNlbnN1cyIsInJvdW5kX3N0YXRlIiwicm91bmQiLCJzdGVwIiwidm90ZWRQb3dlciIsInZvdGVzIiwicHJldm90ZXNfYml0X2FycmF5Iiwic3BsaXQiLCJ2b3RpbmdIZWlnaHQiLCJ2b3RpbmdSb3VuZCIsInZvdGluZ1N0ZXAiLCJwcmV2b3RlcyIsImNoYWluIiwibm9kZV9pbmZvIiwibmV0d29yayIsImxhdGVzdEJsb2NrSGVpZ2h0IiwibGF0ZXN0QmxvY2tUaW1lIiwibGF0ZXN0X2Jsb2NrX3RpbWUiLCJsYXRlc3RTdGF0ZSIsImFjdGl2ZVZQIiwiYWN0aXZlVm90aW5nUG93ZXIiLCJjaGFpblN0YXRlcyIsImJvbmRpbmciLCJib25kZWRUb2tlbnMiLCJib25kZWRfdG9rZW5zIiwibm90Qm9uZGVkVG9rZW5zIiwibm90X2JvbmRlZF90b2tlbnMiLCJTdGFraW5nQ29pbiIsImRlbm9tIiwic3VwcGx5IiwidG90YWxTdXBwbHkiLCJwb29sIiwiY29tbXVuaXR5UG9vbCIsImFtb3VudCIsImluZmxhdGlvbiIsInByb3Zpc2lvbnMiLCJhbm51YWxQcm92aXNpb25zIiwiY3JlYXRlZCIsInJlYWRHZW5lc2lzIiwiZGVidWciLCJnZW5lc2lzRmlsZSIsImdlbmVzaXMiLCJkaXN0ciIsImFwcF9zdGF0ZSIsImRpc3RyaWJ1dGlvbiIsImNoYWluUGFyYW1zIiwiZ2VuZXNpc1RpbWUiLCJnZW5lc2lzX3RpbWUiLCJjb25zZW5zdXNQYXJhbXMiLCJjb25zZW5zdXNfcGFyYW1zIiwiYXV0aCIsImJhbmsiLCJzdGFraW5nIiwibWludCIsImNvbW11bml0eVRheCIsImNvbW11bml0eV90YXgiLCJiYXNlUHJvcG9zZXJSZXdhcmQiLCJiYXNlX3Byb3Bvc2VyX3Jld2FyZCIsImJvbnVzUHJvcG9zZXJSZXdhcmQiLCJib251c19wcm9wb3Nlcl9yZXdhcmQiLCJ3aXRoZHJhd0FkZHJFbmFibGVkIiwid2l0aGRyYXdfYWRkcl9lbmFibGVkIiwiZ292Iiwic3RhcnRpbmdQcm9wb3NhbElkIiwiZGVwb3NpdFBhcmFtcyIsInZvdGluZ1BhcmFtcyIsInRhbGx5UGFyYW1zIiwic2xhc2hpbmciLCJjcmlzaXMiLCJzdGFydGluZ19wcm9wb3NhbF9pZCIsImRlcG9zaXRfcGFyYW1zIiwidm90aW5nX3BhcmFtcyIsInRhbGx5X3BhcmFtcyIsImdlbnV0aWwiLCJnZW50eHMiLCJtc2ciLCJtIiwicHVia2V5IiwiZmxvb3IiLCJmcmFjdGlvbiIsInB1YmtleVZhbHVlIiwiZ2VuVmFsaWRhdG9yc1NldCIsIkNvaW5TdGF0cyIsInB1Ymxpc2giLCJsYXN0X3VwZGF0ZWRfYXQiLCJjb2luSWQiLCJjb2luZ2Vja29JZCIsIm5vdyIsInNldE1pbnV0ZXMiLCJEZWxlZ2F0aW9ucyIsImNvbmNhdCIsImNyZWF0ZWRBdCIsIl9vYmplY3RTcHJlYWQiLCJ0eEluZm8iLCJ0aW1lc3RhbXAiLCJwb3N0IiwiY29kZSIsIkVycm9yIiwicmF3X2xvZyIsIm1lc3NhZ2UiLCJ0eGhhc2giLCJib2R5IiwicGF0aCIsInR4TXNnIiwiYWRqdXN0bWVudCIsImdhc19lc3RpbWF0ZSIsIlByb3Bvc2FscyIsInByb3Bvc2FscyIsImZpbmlzaGVkUHJvcG9zYWxJZHMiLCJTZXQiLCJwcm9wb3NhbElkIiwicHJvcG9zYWxJZHMiLCJidWxrUHJvcG9zYWxzIiwicHJvcG9zYWwiLCJpZCIsImhhcyIsInByb3Bvc2FsX2lkIiwiJG5pbiIsInByb3Bvc2FsX3N0YXR1cyIsImRlcG9zaXRzIiwiZ2V0Vm90ZURldGFpbCIsInRhbGx5IiwidXBkYXRlZEF0Iiwidm90ZXJzIiwidm90ZSIsInZvdGVyIiwidm90aW5nUG93ZXJNYXAiLCJ2YWxpZGF0b3JBZGRyZXNzTWFwIiwibW9uaWtlciIsImRlbGVnYXRvclNoYXJlcyIsImRlZHVjdGVkU2hhcmVzIiwidm90aW5nUG93ZXIiLCJjaGVjayIsIk51bWJlciIsIkF2ZXJhZ2VEYXRhIiwiQXZlcmFnZVZhbGlkYXRvckRhdGEiLCJTdGF0dXMiLCJNaXNzZWRCbG9ja3NTdGF0cyIsIk1pc3NlZEJsb2NrcyIsIl8iLCJCVUxLVVBEQVRFTUFYU0laRSIsImdldEJsb2NrU3RhdHMiLCJsYXRlc3RIZWlnaHQiLCJibG9ja1N0YXRzIiwiY29uZCIsIiRhbmQiLCIkZ3QiLCIkbHRlIiwib3B0aW9ucyIsImFzc2lnbiIsImdldFByZXZpb3VzUmVjb3JkIiwidm90ZXJBZGRyZXNzIiwicHJldmlvdXNSZWNvcmQiLCJibG9ja0hlaWdodCIsImxhc3RVcGRhdGVkSGVpZ2h0IiwicHJldlN0YXRzIiwicGljayIsIm1pc3NDb3VudCIsInRvdGFsQ291bnQiLCJDT1VOVE1JU1NFREJMT0NLUyIsInN0YXJ0VGltZSIsImV4cGxvcmVyU3RhdHVzIiwibGFzdFByb2Nlc3NlZE1pc3NlZEJsb2NrSGVpZ2h0IiwibWluIiwiYnVsa01pc3NlZFN0YXRzIiwiaW5pdGlhbGl6ZU9yZGVyZWRCdWxrT3AiLCJ2YWxpZGF0b3JzTWFwIiwicHJvcG9zZXJWb3RlclN0YXRzIiwidm90ZWRWYWxpZGF0b3JzIiwidmFsaWRhdG9yU2V0cyIsInZvdGVkVm90aW5nUG93ZXIiLCJhY3RpdmVWYWxpZGF0b3IiLCJjdXJyZW50VmFsaWRhdG9yIiwic2V0IiwibiIsInN0YXRzIiwiY2xpZW50IiwiX2RyaXZlciIsIm1vbmdvIiwiYnVsa1Byb21pc2UiLCJ0aGVuIiwiYmluZEVudmlyb25tZW50Iiwibkluc2VydGVkIiwiblVwc2VydGVkIiwibk1vZGlmaWVkIiwibGFzdFByb2Nlc3NlZE1pc3NlZEJsb2NrVGltZSIsIkNPVU5UTUlTU0VEQkxPQ0tTU1RBVFMiLCJsYXN0TWlzc2VkQmxvY2tIZWlnaHQiLCJtaXNzZWRSZWNvcmRzIiwiY291bnRzIiwiZXhpc3RpbmdSZWNvcmQiLCJsYXN0TWlzc2VkQmxvY2tUaW1lIiwiYXZlcmFnZVZvdGluZ1Bvd2VyIiwiYW5hbHl0aWNzIiwibGFzdE1pbnV0ZVZvdGluZ1Bvd2VyIiwibGFzdE1pbnV0ZUJsb2NrVGltZSIsImxhc3RIb3VyVm90aW5nUG93ZXIiLCJsYXN0SG91ckJsb2NrVGltZSIsImxhc3REYXlWb3RpbmdQb3dlciIsImxhc3REYXlCbG9ja1RpbWUiLCJibG9ja0hlaWdodHMiLCJhIiwibnVtIiwiY29uZGl0aW9ucyIsInByb3Bvc2VyTW9uaWtlciIsInZvdGVyTW9uaWtlciIsIkFkZHJlc3NMZW5ndGgiLCJ0b1VwcGVyQ2FzZSIsInR4IiwidHhJZCIsIiRsdCIsImluY2x1ZGVzIiwiYmVjaDMyUHJlZml4VmFsQWRkciIsImJlY2gzMlByZWZpeEFjY0FkZHIiLCJ2YWxpZGF0b3JBZGRyZXNzIiwiZGVsZWdhdG9yQWRkcmVzcyIsInF1ZXJ5IiwiVHhJY29uIiwiZGlyZWN0aW9uIiwidmFsIiwiZmlyc3RTZWVuIiwiaGlzdG9yeSIsImNyZWF0ZUluZGV4IiwidW5pcXVlIiwicGFydGlhbEZpbHRlckV4cHJlc3Npb24iLCJvblBhZ2VMb2FkIiwiSGVsbWV0Iiwic2luayIsImhlbG1ldCIsInJlbmRlclN0YXRpYyIsImFwcGVuZFRvSGVhZCIsIm1ldGEiLCJ0b1N0cmluZyIsInRpdGxlIiwiYmVjaDMyIiwiRnV0dXJlIiwiTnBtIiwicmVxdWlyZSIsImV4ZWMiLCJ0b0hleFN0cmluZyIsImJ5dGVBcnJheSIsImJ5dGUiLCJzbGljZSIsImpvaW4iLCJwdWJrZXlUb0JlY2gzMiIsInByZWZpeCIsInB1YmtleUFtaW5vUHJlZml4IiwiYnVmZmVyIiwiYWxsb2MiLCJjb3B5IiwiZW5jb2RlIiwidG9Xb3JkcyIsImJlY2gzMlRvUHVia2V5IiwiZnJvbVdvcmRzIiwiZGVjb2RlIiwid29yZHMiLCJnZXREZWxlZ2F0b3IiLCJvcGVyYXRvckFkZHIiLCJnZXRLZXliYXNlVGVhbVBpYyIsImtleWJhc2VVcmwiLCJEZW5vbVN5bWJvbCIsIlByb3Bvc2FsU3RhdHVzSWNvbiIsIlZvdGVJY29uIiwiSW5mb0ljb24iLCJSZWFjdCIsIlVuY29udHJvbGxlZFRvb2x0aXAiLCJwcm9wcyIsInZhbGlkIiwiQ29tcG9uZW50IiwiY29uc3RydWN0b3IiLCJyZWYiLCJjcmVhdGVSZWYiLCJyZW5kZXIiLCJ0b29sdGlwVGV4dCIsIm51bWJybyIsImF1dG9mb3JtYXQiLCJmb3JtYXR0ZXIiLCJmb3JtYXQiLCJjb2luTGlzdCIsImNvaW5zIiwiY29pbiIsImRpc3BsYXlOYW1lUGx1cmFsIiwiZGlzcGxheU5hbWUiLCJkaWdpdGFsTW9uZXkiLCJub20iLCJkaWdpdCIsInVuaXQiLCJoZWFkIiwicyIsInBvdyIsInJlcGxhY2UiLCJkaWdpdGFsQ29pbiIsInN5bWJvbCIsIlN0cmluZyIsImJvbmREZW5vbSIsImxvd2VyRGVub20iLCJ0b0xvd2VyQ2FzZSIsIl9jb2luIiwiX2Ftb3VudCIsInN0YWtpbmdBbW91bnQiLCJwcmVjaXNpb24iLCJtaW5TdGFrZSIsInJlcGVhdCIsIm1pbnRTdHJpbmciLCJzdGFrZVN0cmluZyIsInRvSGFuU3RyaW5nIiwiTWluU3Rha2UiLCJFcnJvckNoZWNrIiwiZXJyb3JzIiwiY29kZXNwYWNlIiwicGF5bG9hZCIsInNwYWNlIiwicHJvY2VzcyIsImZvdW5kRXJyb3IiLCJoYXNPd25Qcm9wZXJ0eSIsIkdldE1lc3NhZ2UiLCJnYXNfdXNlZCIsImdhc193YW50ZWQiLCJyZW1vdGUiLCJycGMiLCJsY2QiLCJ0aW1lckJsb2NrcyIsInRpbWVyQ2hhaW4iLCJ0aW1lckNvbnNlbnN1cyIsInRpbWVyUHJvcG9zYWwiLCJ0aW1lclByb3Bvc2Fsc1Jlc3VsdHMiLCJ0aW1lck1pc3NlZEJsb2NrIiwidGltZXJEZWxlZ2F0aW9uIiwidGltZXJBZ2dyZWdhdGUiLCJERUZBVUxUU0VUVElOR1MiLCJ1cGRhdGVDaGFpblN0YXR1cyIsImVycm9yIiwidXBkYXRlQmxvY2siLCJnZXRDb25zZW5zdXNTdGF0ZSIsImdldFByb3Bvc2FscyIsImdldFByb3Bvc2Fsc1Jlc3VsdHMiLCJ1cGRhdGVNaXNzZWRCbG9ja3MiLCJnZXREZWxlZ2F0aW9ucyIsImFnZ3JlZ2F0ZU1pbnV0ZWx5IiwiYWdncmVnYXRlSG91cmx5IiwiYWdncmVnYXRlRGFpbHkiLCJzdGFydHVwIiwiaXNEZXZlbG9wbWVudCIsIkRFRkFVTFRTRVRUSU5HU0pTT04iLCJlbnYiLCJOT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEIiwia2V5Iiwid2FybiIsInBhcmFtIiwic3RhcnRUaW1lciIsInNldEludGVydmFsIiwiY29uc2Vuc3VzSW50ZXJ2YWwiLCJibG9ja0ludGVydmFsIiwic3RhdHVzSW50ZXJ2YWwiLCJwcm9wb3NhbEludGVydmFsIiwibWlzc2VkQmxvY2tzSW50ZXJ2YWwiLCJkZWxlZ2F0aW9uSW50ZXJ2YWwiLCJnZXRVVENTZWNvbmRzIiwiZ2V0VVRDTWludXRlcyIsImdldFVUQ0hvdXJzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFBLElBQUlBLE1BQUo7QUFBV0MsTUFBTSxDQUFDQyxJQUFQLENBQVksZUFBWixFQUE0QjtBQUFDRixRQUFNLENBQUNHLENBQUQsRUFBRztBQUFDSCxVQUFNLEdBQUNHLENBQVA7QUFBUzs7QUFBcEIsQ0FBNUIsRUFBa0QsQ0FBbEQ7QUFBcUQsSUFBSUMsSUFBSjtBQUFTSCxNQUFNLENBQUNDLElBQVAsQ0FBWSxhQUFaLEVBQTBCO0FBQUNFLE1BQUksQ0FBQ0QsQ0FBRCxFQUFHO0FBQUNDLFFBQUksR0FBQ0QsQ0FBTDtBQUFPOztBQUFoQixDQUExQixFQUE0QyxDQUE1QztBQUErQyxJQUFJRSxVQUFKO0FBQWVKLE1BQU0sQ0FBQ0MsSUFBUCxDQUFZLHVDQUFaLEVBQW9EO0FB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Z0JrQixNQUFoQixDQUF1Qm1mLGdCQUZGLENBQXhCO0FBR0g7O0FBRUQ1Qix3QkFBZ0IsR0FBRzVsQixNQUFNLENBQUNvbkIsV0FBUCxDQUFvQixZQUFZO0FBQy9DZCw0QkFBa0I7QUFDckIsU0FGa0IsRUFFaEJ0bUIsTUFBTSxDQUFDbUgsUUFBUCxDQUFnQmtCLE1BQWhCLENBQXVCb2Ysb0JBRlAsQ0FBbkI7QUFJQTVCLHVCQUFlLEdBQUc3bEIsTUFBTSxDQUFDb25CLFdBQVAsQ0FBb0IsWUFBWTtBQUM5Q2Isd0JBQWM7QUFDakIsU0FGaUIsRUFFZnZtQixNQUFNLENBQUNtSCxRQUFQLENBQWdCa0IsTUFBaEIsQ0FBdUJxZixrQkFGUixDQUFsQjtBQUlBNUIsc0JBQWMsR0FBRzlsQixNQUFNLENBQUNvbkIsV0FBUCxDQUFvQixZQUFZO0FBQzdDLGNBQUl2USxHQUFHLEdBQUcsSUFBSXhULElBQUosRUFBVjs7QUFDQSxjQUFLd1QsR0FBRyxDQUFDOFEsYUFBSixNQUF3QixDQUE3QixFQUFpQztBQUM3Qm5CLDZCQUFpQjtBQUNwQjs7QUFFRCxjQUFLM1AsR0FBRyxDQUFDK1EsYUFBSixNQUF3QixDQUF6QixJQUFnQy9RLEdBQUcsQ0FBQzhRLGFBQUosTUFBd0IsQ0FBNUQsRUFBZ0U7QUFDNURsQiwyQkFBZTtBQUNsQjs7QUFFRCxjQUFLNVAsR0FBRyxDQUFDZ1IsV0FBSixNQUFzQixDQUF2QixJQUE4QmhSLEdBQUcsQ0FBQytRLGFBQUosTUFBd0IsQ0FBdEQsSUFBNkQvUSxHQUFHLENBQUM4USxhQUFKLE1BQXdCLENBQXpGLEVBQTZGO0FBQ3pGakIsMEJBQWM7QUFDakI7QUFDSixTQWJnQixFQWFkLElBYmMsQ0FBakI7QUFjSDtBQUNKO0FBQ0osR0FwREQ7QUFzREgsQ0F4RUQsRSIsImZpbGUiOiIvYXBwLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgTWV0ZW9yIH0gZnJvbSAnbWV0ZW9yL21ldGVvcic7XG5pbXBvcnQgeyBIVFRQIH0gZnJvbSAnbWV0ZW9yL2h0dHAnO1xuaW1wb3J0IHsgVmFsaWRhdG9ycyB9IGZyb20gJy9pbXBvcnRzL2FwaS92YWxpZGF0b3JzL3ZhbGlkYXRvcnMuanMnO1xuXG5jb25zdCBmZXRjaEZyb21VcmwgPSAodXJsKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgbGV0IHJlcyA9IEhUVFAuZ2V0IChMQ0QgKyB1cmwpO1xuICAgICAgICBpZiAocmVzLnN0YXR1c0NvZGUgPT0gMjAwKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzXG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUubG9nIChyZXMpO1xuICAgICAgICBjb25zb2xlLmxvZyAoZSk7XG4gICAgfVxufVxuXG5NZXRlb3IubWV0aG9kcyAoe1xuICAgICdhY2NvdW50cy5nZXRBY2NvdW50RGV0YWlsJyA6IGZ1bmN0aW9uIChhZGRyZXNzKSB7XG4gICAgICAgIHRoaXMudW5ibG9jayAoKTtcbiAgICAgICAgbGV0IHVybCA9IExDRCArICcvYXV0aC9hY2NvdW50cy8nICsgYWRkcmVzcztcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxldCBhdmFpbGFibGUgPSBIVFRQLmdldCAodXJsKTtcbiAgICAgICAgICAgIGlmIChhdmFpbGFibGUuc3RhdHVzQ29kZSA9PSAyMDApIHtcbiAgICAgICAgICAgICAgICBsZXQgcmVzcG9uc2UgPSBKU09OLnBhcnNlIChhdmFpbGFibGUuY29udGVudCkucmVzdWx0O1xuICAgICAgICAgICAgICAgIGxldCBhY2NvdW50O1xuICAgICAgICAgICAgICAgIGlmIChyZXNwb25zZS50eXBlID09PSAnY29zbW9zLXNkay9BY2NvdW50JylcbiAgICAgICAgICAgICAgICAgICAgYWNjb3VudCA9IHJlc3BvbnNlLnZhbHVlO1xuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHJlc3BvbnNlLnR5cGUgPT09ICdjb3Ntb3Mtc2RrL0RlbGF5ZWRWZXN0aW5nQWNjb3VudCcgfHwgcmVzcG9uc2UudHlwZSA9PT0gJ2Nvc21vcy1zZGsvQ29udGludW91c1Zlc3RpbmdBY2NvdW50JylcbiAgICAgICAgICAgICAgICAgICAgYWNjb3VudCA9IHJlc3BvbnNlLnZhbHVlLkJhc2VWZXN0aW5nQWNjb3VudC5CYXNlQWNjb3VudFxuICAgICAgICAgICAgICAgIGlmIChhY2NvdW50ICYmIGFjY291bnQuYWNjb3VudF9udW1iZXIgIT0gbnVsbClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFjY291bnRcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbFxuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyAodXJsKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nIChlKVxuICAgICAgICB9XG4gICAgfSxcbiAgICAnYWNjb3VudHMuZ2V0QmFsYW5jZScgOiBmdW5jdGlvbiAoYWRkcmVzcykge1xuICAgICAgICB0aGlzLnVuYmxvY2sgKCk7XG4gICAgICAgIGxldCBiYWxhbmNlID0ge31cblxuICAgICAgICAvLyBnZXQgYXZhaWxhYmxlIGF0b21zXG4gICAgICAgIGxldCB1cmwgPSBMQ0QgKyAnL2JhbmsvYmFsYW5jZXMvJyArIGFkZHJlc3M7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgYXZhaWxhYmxlID0gSFRUUC5nZXQgKHVybCk7XG4gICAgICAgICAgICBpZiAoYXZhaWxhYmxlLnN0YXR1c0NvZGUgPT0gMjAwKSB7XG4gICAgICAgICAgICAgICAgYmFsYW5jZS5hdmFpbGFibGUgPSBKU09OLnBhcnNlIChhdmFpbGFibGUuY29udGVudCkucmVzdWx0O1xuXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nICh1cmwpO1xuICAgICAgICAgICAgY29uc29sZS5sb2cgKGUpXG4gICAgICAgIH1cblxuICAgICAgICAvLyBnZXQgZGVsZWdhdGVkIGFtbm91bnRzXG4gICAgICAgIHVybCA9IExDRCArICcvc3Rha2luZy9kZWxlZ2F0b3JzLycgKyBhZGRyZXNzICsgJy9kZWxlZ2F0aW9ucyc7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgZGVsZWdhdGlvbnMgPSBIVFRQLmdldCAodXJsKTtcbiAgICAgICAgICAgIGlmIChkZWxlZ2F0aW9ucy5zdGF0dXNDb2RlID09IDIwMCkge1xuICAgICAgICAgICAgICAgIGJhbGFuY2UuZGVsZWdhdGlvbnMgPSBKU09OLnBhcnNlIChkZWxlZ2F0aW9ucy5jb250ZW50KS5yZXN1bHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nICh1cmwpO1xuICAgICAgICAgICAgY29uc29sZS5sb2cgKGUpO1xuICAgICAgICB9XG4gICAgICAgIC8vIGdldCB1bmJvbmRpbmdcbiAgICAgICAgdXJsID0gTENEICsgJy9zdGFraW5nL2RlbGVnYXRvcnMvJyArIGFkZHJlc3MgKyAnL3VuYm9uZGluZ19kZWxlZ2F0aW9ucyc7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgdW5ib25kaW5nID0gSFRUUC5nZXQgKHVybCk7XG4gICAgICAgICAgICBpZiAodW5ib25kaW5nLnN0YXR1c0NvZGUgPT0gMjAwKSB7XG4gICAgICAgICAgICAgICAgYmFsYW5jZS51bmJvbmRpbmcgPSBKU09OLnBhcnNlICh1bmJvbmRpbmcuY29udGVudCkucmVzdWx0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyAodXJsKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nIChlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGdldCByZXdhcmRzXG4gICAgICAgIHVybCA9IExDRCArICcvZGlzdHJpYnV0aW9uL2RlbGVnYXRvcnMvJyArIGFkZHJlc3MgKyAnL3Jld2FyZHMnO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbGV0IHJld2FyZHMgPSBIVFRQLmdldCAodXJsKTtcbiAgICAgICAgICAgIGlmIChyZXdhcmRzLnN0YXR1c0NvZGUgPT0gMjAwKSB7XG4gICAgICAgICAgICAgICAgLy9nZXQgc2VwZXJhdGUgcmV3YXJkcyB2YWx1ZVxuICAgICAgICAgICAgICAgIGJhbGFuY2UucmV3YXJkcyA9IEpTT04ucGFyc2UgKHJld2FyZHMuY29udGVudCkucmVzdWx0LnJld2FyZHM7XG4gICAgICAgICAgICAgICAgLy9nZXQgdG90YWwgcmV3YXJkcyB2YWx1ZVxuICAgICAgICAgICAgICAgIGJhbGFuY2UudG90YWxfcmV3YXJkcyA9IEpTT04ucGFyc2UgKHJld2FyZHMuY29udGVudCkucmVzdWx0LnRvdGFsO1xuXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nICh1cmwpO1xuICAgICAgICAgICAgY29uc29sZS5sb2cgKGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZ2V0IGNvbW1pc3Npb25cbiAgICAgICAgbGV0IHZhbGlkYXRvciA9IFZhbGlkYXRvcnMuZmluZE9uZSAoXG4gICAgICAgICAgICB7ICRvciA6IFt7IG9wZXJhdG9yX2FkZHJlc3MgOiBhZGRyZXNzIH0sIHsgZGVsZWdhdG9yX2FkZHJlc3MgOiBhZGRyZXNzIH0sIHsgYWRkcmVzcyA6IGFkZHJlc3MgfV0gfSlcbiAgICAgICAgaWYgKHZhbGlkYXRvcikge1xuICAgICAgICAgICAgbGV0IHVybCA9IExDRCArICcvZGlzdHJpYnV0aW9uL3ZhbGlkYXRvcnMvJyArIHZhbGlkYXRvci5vcGVyYXRvcl9hZGRyZXNzO1xuICAgICAgICAgICAgYmFsYW5jZS5vcGVyYXRvcl9hZGRyZXNzID0gdmFsaWRhdG9yLm9wZXJhdG9yX2FkZHJlc3M7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGxldCByZXdhcmRzID0gSFRUUC5nZXQgKHVybCk7XG4gICAgICAgICAgICAgICAgaWYgKHJld2FyZHMuc3RhdHVzQ29kZSA9PSAyMDApIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGNvbnRlbnQgPSBKU09OLnBhcnNlIChyZXdhcmRzLmNvbnRlbnQpLnJlc3VsdDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbnRlbnQudmFsX2NvbW1pc3Npb24gJiYgY29udGVudC52YWxfY29tbWlzc2lvbi5sZW5ndGggPiAwKVxuICAgICAgICAgICAgICAgICAgICAgICAgYmFsYW5jZS5jb21taXNzaW9uID0gY29udGVudC52YWxfY29tbWlzc2lvbjtcblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nICh1cmwpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nIChlKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJhbGFuY2U7XG4gICAgfSxcbiAgICAnYWNjb3VudHMuZ2V0RGVsZWdhdGlvbicgOiBmdW5jdGlvbiAoYWRkcmVzcywgdmFsaWRhdG9yKSB7XG4gICAgICAgIGxldCB1cmwgPSBgL3N0YWtpbmcvZGVsZWdhdG9ycy8ke2FkZHJlc3N9L2RlbGVnYXRpb25zLyR7dmFsaWRhdG9yfWA7XG4gICAgICAgIGxldCBkZWxlZ2F0aW9ucyA9IGZldGNoRnJvbVVybCAodXJsKTtcbiAgICAgICAgZGVsZWdhdGlvbnMgPSBkZWxlZ2F0aW9ucyAmJiBkZWxlZ2F0aW9ucy5kYXRhLnJlc3VsdDtcbiAgICAgICAgaWYgKGRlbGVnYXRpb25zICYmIGRlbGVnYXRpb25zLnNoYXJlcylcbiAgICAgICAgICAgIGRlbGVnYXRpb25zLnNoYXJlcyA9IHBhcnNlRmxvYXQgKGRlbGVnYXRpb25zLnNoYXJlcyk7XG5cbiAgICAgICAgdXJsID0gYC9zdGFraW5nL3JlZGVsZWdhdGlvbnM/ZGVsZWdhdG9yPSR7YWRkcmVzc30mdmFsaWRhdG9yX3RvPSR7dmFsaWRhdG9yfWA7XG4gICAgICAgIGxldCByZWxlZ2F0aW9ucyA9IGZldGNoRnJvbVVybCAodXJsKTtcbiAgICAgICAgcmVsZWdhdGlvbnMgPSByZWxlZ2F0aW9ucyAmJiByZWxlZ2F0aW9ucy5kYXRhLnJlc3VsdDtcbiAgICAgICAgbGV0IGNvbXBsZXRpb25UaW1lO1xuICAgICAgICBpZiAocmVsZWdhdGlvbnMpIHtcbiAgICAgICAgICAgIHJlbGVnYXRpb25zLmZvckVhY2ggKChyZWxlZ2F0aW9uKSA9PiB7XG4gICAgICAgICAgICAgICAgbGV0IGVudHJpZXMgPSByZWxlZ2F0aW9uLmVudHJpZXNcbiAgICAgICAgICAgICAgICBsZXQgdGltZSA9IG5ldyBEYXRlIChlbnRyaWVzW2VudHJpZXMubGVuZ3RoIC0gMV0uY29tcGxldGlvbl90aW1lKVxuICAgICAgICAgICAgICAgIGlmICghY29tcGxldGlvblRpbWUgfHwgdGltZSA+IGNvbXBsZXRpb25UaW1lKVxuICAgICAgICAgICAgICAgICAgICBjb21wbGV0aW9uVGltZSA9IHRpbWVcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBkZWxlZ2F0aW9ucy5yZWRlbGVnYXRpb25Db21wbGV0aW9uVGltZSA9IGNvbXBsZXRpb25UaW1lO1xuICAgICAgICB9XG5cbiAgICAgICAgdXJsID0gYC9zdGFraW5nL2RlbGVnYXRvcnMvJHthZGRyZXNzfS91bmJvbmRpbmdfZGVsZWdhdGlvbnMvJHt2YWxpZGF0b3J9YDtcbiAgICAgICAgbGV0IHVuZGVsZWdhdGlvbnMgPSBmZXRjaEZyb21VcmwgKHVybCk7XG4gICAgICAgIHVuZGVsZWdhdGlvbnMgPSB1bmRlbGVnYXRpb25zICYmIHVuZGVsZWdhdGlvbnMuZGF0YS5yZXN1bHQ7XG4gICAgICAgIGlmICh1bmRlbGVnYXRpb25zKSB7XG4gICAgICAgICAgICBkZWxlZ2F0aW9ucy51bmJvbmRpbmcgPSB1bmRlbGVnYXRpb25zLmVudHJpZXMubGVuZ3RoO1xuICAgICAgICAgICAgZGVsZWdhdGlvbnMudW5ib25kaW5nQ29tcGxldGlvblRpbWUgPSB1bmRlbGVnYXRpb25zLmVudHJpZXNbMF0uY29tcGxldGlvbl90aW1lO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkZWxlZ2F0aW9ucztcbiAgICB9LFxuICAgICdhY2NvdW50cy5nZXRBbGxEZWxlZ2F0aW9ucycgOiBmdW5jdGlvbiAoYWRkcmVzcykge1xuICAgICAgICBsZXQgdXJsID0gTENEICsgJy9zdGFraW5nL2RlbGVnYXRvcnMvJyArIGFkZHJlc3MgKyAnL2RlbGVnYXRpb25zJztcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbGV0IGRlbGVnYXRpb25zID0gSFRUUC5nZXQgKHVybCk7XG4gICAgICAgICAgICBpZiAoZGVsZWdhdGlvbnMuc3RhdHVzQ29kZSA9PSAyMDApIHtcbiAgICAgICAgICAgICAgICBkZWxlZ2F0aW9ucyA9IEpTT04ucGFyc2UgKGRlbGVnYXRpb25zLmNvbnRlbnQpLnJlc3VsdDtcbiAgICAgICAgICAgICAgICBpZiAoZGVsZWdhdGlvbnMgJiYgZGVsZWdhdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBkZWxlZ2F0aW9ucy5mb3JFYWNoICgoZGVsZWdhdGlvbiwgaSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRlbGVnYXRpb25zW2ldICYmIGRlbGVnYXRpb25zW2ldLnNoYXJlcylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxlZ2F0aW9uc1tpXS5zaGFyZXMgPSBwYXJzZUZsb2F0IChkZWxlZ2F0aW9uc1tpXS5zaGFyZXMpO1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiBkZWxlZ2F0aW9ucztcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyAodXJsKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nIChlKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgJ2FjY291bnRzLmdldEFsbFVuYm9uZGluZ3MnIDogZnVuY3Rpb24gKGFkZHJlc3MpIHtcbiAgICAgICAgbGV0IHVybCA9IExDRCArICcvc3Rha2luZy9kZWxlZ2F0b3JzLycgKyBhZGRyZXNzICsgJy91bmJvbmRpbmdfZGVsZWdhdGlvbnMnO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgdW5ib25kaW5ncyA9IEhUVFAuZ2V0ICh1cmwpO1xuICAgICAgICAgICAgaWYgKHVuYm9uZGluZ3Muc3RhdHVzQ29kZSA9PSAyMDApIHtcbiAgICAgICAgICAgICAgICB1bmJvbmRpbmdzID0gSlNPTi5wYXJzZSAodW5ib25kaW5ncy5jb250ZW50KS5yZXN1bHQ7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHVuYm9uZGluZ3M7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS5sb2cgKHVybCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyAoZSk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgICdhY2NvdW50cy5nZXRBbGxSZWRlbGVnYXRpb25zJyA6IGZ1bmN0aW9uIChhZGRyZXNzLCB2YWxpZGF0b3IpIHtcbiAgICAgICAgbGV0IHVybCA9IGAvc3Rha2luZy9yZWRlbGVnYXRpb25zP2RlbGVnYXRvcj0ke2FkZHJlc3N9JnZhbGlkYXRvcl9mcm9tPSR7dmFsaWRhdG9yfWA7XG4gICAgICAgIGxldCByZXN1bHQgPSBmZXRjaEZyb21VcmwgKHVybCk7XG4gICAgICAgIGlmIChyZXN1bHQgJiYgcmVzdWx0LmRhdGEpIHtcbiAgICAgICAgICAgIGxldCByZWRlbGVnYXRpb25zID0ge31cbiAgICAgICAgICAgIHJlc3VsdC5kYXRhLmZvckVhY2ggKChyZWRlbGVnYXRpb24pID0+IHtcbiAgICAgICAgICAgICAgICBsZXQgZW50cmllcyA9IHJlZGVsZWdhdGlvbi5lbnRyaWVzO1xuICAgICAgICAgICAgICAgIHJlZGVsZWdhdGlvbnNbcmVkZWxlZ2F0aW9uLnZhbGlkYXRvcl9kc3RfYWRkcmVzc10gPSB7XG4gICAgICAgICAgICAgICAgICAgIGNvdW50IDogZW50cmllcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgIGNvbXBsZXRpb25UaW1lIDogZW50cmllc1swXS5jb21wbGV0aW9uX3RpbWVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgcmV0dXJuIHJlZGVsZWdhdGlvbnNcbiAgICAgICAgfVxuICAgIH0sXG4gICAgJ2FjY291bnRzLmdldERpZFRvQWRkcmVzcycgOiBmdW5jdGlvbiAoZGlkX2FkZHJlc3MpIHtcbiAgICAgICAgbGV0IHVybCA9IGAvZGlkVG9BZGRyLyR7ZGlkX2FkZHJlc3N9YDtcbiAgICAgICAgbGV0IHJlc3VsdCA9IGZldGNoRnJvbVVybCAodXJsKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdFxuICAgIH0sXG4gICAgJ2FjY291bnRzLmdldERpZERvYycgOiBmdW5jdGlvbiAoZGlkX2FkZHJlc3MpIHtcbiAgICAgICAgbGV0IHVybCA9IGAvZGlkLyR7ZGlkX2FkZHJlc3N9YDtcbiAgICAgICAgbGV0IHJlc3VsdCA9IGZldGNoRnJvbVVybCAodXJsKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdFxuICAgIH0sXG4gICAgJ2FjY291bnRzLmFsbERpZCcgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGxldCB1cmwgPSBgL2FsbERpZERvY3MvYDtcbiAgICAgICAgbGV0IHJlc3VsdCA9IGZldGNoRnJvbVVybCAodXJsKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdFxuICAgIH0sXG4gICAgJ2FjY291bnRzLmNoZWNrTmFtZScgOiBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICBsZXQgdXJsID0gYC9jaGVja05hbWUvJHtuYW1lfWA7XG4gICAgICAgIGxldCByZXN1bHQgPSBmZXRjaEZyb21VcmwgKHVybCk7XG4gICAgICAgIHJldHVybiByZXN1bHRcbiAgICB9XG5cblxufSlcbiIsImltcG9ydCB7IE1ldGVvciB9IGZyb20gJ21ldGVvci9tZXRlb3InO1xuaW1wb3J0IHsgSFRUUCB9IGZyb20gJ21ldGVvci9odHRwJztcbmltcG9ydCB7IFByb21pc2UgfSBmcm9tIFwibWV0ZW9yL3Byb21pc2VcIjtcbmltcG9ydCB7IEJsb2Nrc2NvbiB9IGZyb20gJy9pbXBvcnRzL2FwaS9ibG9ja3MvYmxvY2tzLmpzJztcbmltcG9ydCB7IENoYWluIH0gZnJvbSAnL2ltcG9ydHMvYXBpL2NoYWluL2NoYWluLmpzJztcbmltcG9ydCB7IFZhbGlkYXRvclNldHMgfSBmcm9tICcvaW1wb3J0cy9hcGkvdmFsaWRhdG9yLXNldHMvdmFsaWRhdG9yLXNldHMuanMnO1xuaW1wb3J0IHsgVmFsaWRhdG9ycyB9IGZyb20gJy9pbXBvcnRzL2FwaS92YWxpZGF0b3JzL3ZhbGlkYXRvcnMuanMnO1xuaW1wb3J0IHsgVmFsaWRhdG9yUmVjb3JkcywgQW5hbHl0aWNzLCBWUERpc3RyaWJ1dGlvbnN9IGZyb20gJy9pbXBvcnRzL2FwaS9yZWNvcmRzL3JlY29yZHMuanMnO1xuaW1wb3J0IHsgVm90aW5nUG93ZXJIaXN0b3J5IH0gZnJvbSAnL2ltcG9ydHMvYXBpL3ZvdGluZy1wb3dlci9oaXN0b3J5LmpzJztcbmltcG9ydCB7IFRyYW5zYWN0aW9ucyB9IGZyb20gJy4uLy4uL3RyYW5zYWN0aW9ucy90cmFuc2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgRXZpZGVuY2VzIH0gZnJvbSAnLi4vLi4vZXZpZGVuY2VzL2V2aWRlbmNlcy5qcyc7XG5pbXBvcnQgeyBzaGEyNTYgfSBmcm9tICdqcy1zaGEyNTYnO1xuaW1wb3J0IHsgZ2V0QWRkcmVzcyB9IGZyb20gJ3RlbmRlcm1pbnQvbGliL3B1YmtleSc7XG5pbXBvcnQgKiBhcyBjaGVlcmlvIGZyb20gJ2NoZWVyaW8nO1xuXG4vLyBpbXBvcnQgQmxvY2sgZnJvbSAnLi4vLi4vLi4vdWkvY29tcG9uZW50cy9CbG9jayc7XG5cbi8vIGdldFZhbGlkYXRvclZvdGluZ1Bvd2VyID0gKHZhbGlkYXRvcnMsIGFkZHJlc3MpID0+IHtcbi8vICAgICBmb3IgKHYgaW4gdmFsaWRhdG9ycyl7XG4vLyAgICAgICAgIGlmICh2YWxpZGF0b3JzW3ZdLmFkZHJlc3MgPT0gYWRkcmVzcyl7XG4vLyAgICAgICAgICAgICByZXR1cm4gcGFyc2VJbnQodmFsaWRhdG9yc1t2XS52b3RpbmdfcG93ZXIpO1xuLy8gICAgICAgICB9XG4vLyAgICAgfVxuLy8gfVxuXG5nZXRSZW1vdmVkVmFsaWRhdG9ycyA9IChwcmV2VmFsaWRhdG9ycywgdmFsaWRhdG9ycykgPT4ge1xuICAgIC8vIGxldCByZW1vdmVWYWxpZGF0b3JzID0gW107XG4gICAgZm9yIChwIGluIHByZXZWYWxpZGF0b3JzKXtcbiAgICAgICAgZm9yICh2IGluIHZhbGlkYXRvcnMpe1xuICAgICAgICAgICAgaWYgKHByZXZWYWxpZGF0b3JzW3BdLmFkZHJlc3MgPT0gdmFsaWRhdG9yc1t2XS5hZGRyZXNzKXtcbiAgICAgICAgICAgICAgICBwcmV2VmFsaWRhdG9ycy5zcGxpY2UocCwxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBwcmV2VmFsaWRhdG9ycztcbn1cblxuZ2V0VmFsaWRhdG9yUHJvZmlsZVVybCA9IChpZGVudGl0eSkgPT4ge1xuICAgIGlmIChpZGVudGl0eS5sZW5ndGggPT0gMTYpe1xuICAgICAgICBsZXQgcmVzcG9uc2UgPSBIVFRQLmdldChgaHR0cHM6Ly9rZXliYXNlLmlvL18vYXBpLzEuMC91c2VyL2xvb2t1cC5qc29uP2tleV9zdWZmaXg9JHtpZGVudGl0eX0mZmllbGRzPXBpY3R1cmVzYClcbiAgICAgICAgaWYgKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT0gMjAwKSB7XG4gICAgICAgICAgICBsZXQgdGhlbSA9IHJlc3BvbnNlLmRhdGEudGhlbVxuICAgICAgICAgICAgcmV0dXJuIHRoZW0gJiYgdGhlbS5sZW5ndGggJiYgdGhlbVswXS5waWN0dXJlcyAmJiB0aGVtWzBdLnBpY3R1cmVzLnByaW1hcnkgJiYgdGhlbVswXS5waWN0dXJlcy5wcmltYXJ5LnVybDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKEpTT04uc3RyaW5naWZ5KHJlc3BvbnNlKSlcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaWRlbnRpdHkuaW5kZXhPZihcImtleWJhc2UuaW8vdGVhbS9cIik+MCl7XG4gICAgICAgIGxldCB0ZWFtUGFnZSA9IEhUVFAuZ2V0KGlkZW50aXR5KTtcbiAgICAgICAgaWYgKHRlYW1QYWdlLnN0YXR1c0NvZGUgPT0gMjAwKXtcbiAgICAgICAgICAgIGxldCBwYWdlID0gY2hlZXJpby5sb2FkKHRlYW1QYWdlLmNvbnRlbnQpO1xuICAgICAgICAgICAgcmV0dXJuIHBhZ2UoXCIua2ItbWFpbi1jYXJkIGltZ1wiKS5hdHRyKCdzcmMnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKEpTT04uc3RyaW5naWZ5KHRlYW1QYWdlKSlcbiAgICAgICAgfVxuICAgIH1cbn1cblxuLy8gdmFyIGZpbHRlcmVkID0gWzEsIDIsIDMsIDQsIDVdLmZpbHRlcihub3RDb250YWluZWRJbihbMSwgMiwgMywgNV0pKTtcbi8vIGNvbnNvbGUubG9nKGZpbHRlcmVkKTsgLy8gWzRdXG5cbk1ldGVvci5tZXRob2RzKHtcbiAgICAnYmxvY2tzLmF2ZXJhZ2VCbG9ja1RpbWUnKGFkZHJlc3Mpe1xuICAgICAgICBsZXQgYmxvY2tzID0gQmxvY2tzY29uLmZpbmQoe3Byb3Bvc2VyQWRkcmVzczphZGRyZXNzfSkuZmV0Y2goKTtcbiAgICAgICAgbGV0IGhlaWdodHMgPSBibG9ja3MubWFwKChibG9jaywgaSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGJsb2NrLmhlaWdodDtcbiAgICAgICAgfSk7XG4gICAgICAgIGxldCBibG9ja3NTdGF0cyA9IEFuYWx5dGljcy5maW5kKHtoZWlnaHQ6eyRpbjpoZWlnaHRzfX0pLmZldGNoKCk7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGJsb2Nrc1N0YXRzKTtcblxuICAgICAgICBsZXQgdG90YWxCbG9ja0RpZmYgPSAwO1xuICAgICAgICBmb3IgKGIgaW4gYmxvY2tzU3RhdHMpe1xuICAgICAgICAgICAgdG90YWxCbG9ja0RpZmYgKz0gYmxvY2tzU3RhdHNbYl0udGltZURpZmY7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRvdGFsQmxvY2tEaWZmL2hlaWdodHMubGVuZ3RoO1xuICAgIH0sXG4gICAgJ2Jsb2Nrcy5maW5kVXBUaW1lJyhhZGRyZXNzKXtcbiAgICAgICAgbGV0IGNvbGxlY3Rpb24gPSBWYWxpZGF0b3JSZWNvcmRzLnJhd0NvbGxlY3Rpb24oKTtcbiAgICAgICAgLy8gbGV0IGFnZ3JlZ2F0ZVF1ZXJ5ID0gTWV0ZW9yLndyYXBBc3luYyhjb2xsZWN0aW9uLmFnZ3JlZ2F0ZSwgY29sbGVjdGlvbik7XG4gICAgICAgIHZhciBwaXBlbGluZSA9IFtcbiAgICAgICAgICAgIHskbWF0Y2g6e1wiYWRkcmVzc1wiOmFkZHJlc3N9fSxcbiAgICAgICAgICAgIC8vIHskcHJvamVjdDp7YWRkcmVzczoxLGhlaWdodDoxLGV4aXN0czoxfX0sXG4gICAgICAgICAgICB7JHNvcnQ6e1wiaGVpZ2h0XCI6LTF9fSxcbiAgICAgICAgICAgIHskbGltaXQ6KE1ldGVvci5zZXR0aW5ncy5wdWJsaWMudXB0aW1lV2luZG93LTEpfSxcbiAgICAgICAgICAgIHskdW53aW5kOiBcIiRfaWRcIn0sXG4gICAgICAgICAgICB7JGdyb3VwOntcbiAgICAgICAgICAgICAgICBcIl9pZFwiOiBcIiRhZGRyZXNzXCIsXG4gICAgICAgICAgICAgICAgXCJ1cHRpbWVcIjoge1xuICAgICAgICAgICAgICAgICAgICBcIiRzdW1cIjp7XG4gICAgICAgICAgICAgICAgICAgICAgICAkY29uZDogW3skZXE6IFsnJGV4aXN0cycsIHRydWVdfSwgMSwgMF1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1dO1xuICAgICAgICAvLyBsZXQgcmVzdWx0ID0gYWdncmVnYXRlUXVlcnkocGlwZWxpbmUsIHsgY3Vyc29yOiB7fSB9KTtcblxuICAgICAgICByZXR1cm4gUHJvbWlzZS5hd2FpdChjb2xsZWN0aW9uLmFnZ3JlZ2F0ZShwaXBlbGluZSkudG9BcnJheSgpKTtcbiAgICAgICAgLy8gcmV0dXJuIC5hZ2dyZWdhdGUoKVxuICAgIH0sXG4gICAgJ2Jsb2Nrcy5nZXRMYXRlc3RIZWlnaHQnOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy51bmJsb2NrKCk7XG4gICAgICAgIGxldCB1cmwgPSBSUEMrJy9zdGF0dXMnO1xuICAgICAgICB0cnl7XG4gICAgICAgICAgICBsZXQgcmVzcG9uc2UgPSBIVFRQLmdldCh1cmwpO1xuICAgICAgICAgICAgbGV0IHN0YXR1cyA9IEpTT04ucGFyc2UocmVzcG9uc2UuY29udGVudCk7XG4gICAgICAgICAgICByZXR1cm4gKHN0YXR1cy5yZXN1bHQuc3luY19pbmZvLmxhdGVzdF9ibG9ja19oZWlnaHQpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlKXtcbiAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9XG4gICAgfSxcbiAgICAnYmxvY2tzLmdldEN1cnJlbnRIZWlnaHQnOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy51bmJsb2NrKCk7XG4gICAgICAgIGxldCBjdXJySGVpZ2h0ID0gQmxvY2tzY29uLmZpbmQoe30se3NvcnQ6e2hlaWdodDotMX0sbGltaXQ6MX0pLmZldGNoKCk7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwiY3VycmVudEhlaWdodDpcIitjdXJySGVpZ2h0KTtcbiAgICAgICAgbGV0IHN0YXJ0SGVpZ2h0ID0gTWV0ZW9yLnNldHRpbmdzLnBhcmFtcy5zdGFydEhlaWdodDtcbiAgICAgICAgaWYgKGN1cnJIZWlnaHQgJiYgY3VyckhlaWdodC5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgbGV0IGhlaWdodCA9IGN1cnJIZWlnaHRbMF0uaGVpZ2h0O1xuICAgICAgICAgICAgaWYgKGhlaWdodCA+IHN0YXJ0SGVpZ2h0KVxuICAgICAgICAgICAgICAgIHJldHVybiBoZWlnaHRcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3RhcnRIZWlnaHRcbiAgICB9LFxuICAgICdibG9ja3MuYmxvY2tzVXBkYXRlJzogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmIChTWU5DSU5HKVxuICAgICAgICAgICAgcmV0dXJuIFwiU3luY2luZy4uLlwiO1xuICAgICAgICBlbHNlIGNvbnNvbGUubG9nKFwic3RhcnQgdG8gc3luY1wiKTtcbiAgICAgICAgLy8gTWV0ZW9yLmNsZWFySW50ZXJ2YWwoTWV0ZW9yLnRpbWVySGFuZGxlKTtcbiAgICAgICAgLy8gZ2V0IHRoZSBsYXRlc3QgaGVpZ2h0XG4gICAgICAgIGxldCB1bnRpbCA9IE1ldGVvci5jYWxsKCdibG9ja3MuZ2V0TGF0ZXN0SGVpZ2h0Jyk7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKHVudGlsKTtcbiAgICAgICAgLy8gZ2V0IHRoZSBjdXJyZW50IGhlaWdodCBpbiBkYlxuICAgICAgICBsZXQgY3VyciA9IE1ldGVvci5jYWxsKCdibG9ja3MuZ2V0Q3VycmVudEhlaWdodCcpO1xuICAgICAgICBjb25zb2xlLmxvZyhjdXJyKTtcbiAgICAgICAgLy8gbG9vcCBpZiB0aGVyZSdzIHVwZGF0ZSBpbiBkYlxuICAgICAgICBpZiAodW50aWwgPiBjdXJyKSB7XG4gICAgICAgICAgICBTWU5DSU5HID0gdHJ1ZTtcblxuICAgICAgICAgICAgbGV0IHZhbGlkYXRvclNldCA9IHt9XG4gICAgICAgICAgICAvLyBnZXQgbGF0ZXN0IHZhbGlkYXRvciBjYW5kaWRhdGUgaW5mb3JtYXRpb25cbiAgICAgICAgICAgIHVybCA9IExDRCsnL3N0YWtpbmcvdmFsaWRhdG9ycyc7XG5cbiAgICAgICAgICAgIHRyeXtcbiAgICAgICAgICAgICAgICByZXNwb25zZSA9IEhUVFAuZ2V0KHVybCk7XG4gICAgICAgICAgICAgICAgSlNPTi5wYXJzZShyZXNwb25zZS5jb250ZW50KS5yZXN1bHQuZm9yRWFjaCgodmFsaWRhdG9yKSA9PiB2YWxpZGF0b3JTZXRbdmFsaWRhdG9yLmNvbnNlbnN1c19wdWJrZXldID0gdmFsaWRhdG9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoKGUpe1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB1cmwgPSBMQ0QrJy9zdGFraW5nL3ZhbGlkYXRvcnM/c3RhdHVzPXVuYm9uZGluZyc7XG5cbiAgICAgICAgICAgIHRyeXtcbiAgICAgICAgICAgICAgICByZXNwb25zZSA9IEhUVFAuZ2V0KHVybCk7XG4gICAgICAgICAgICAgICAgSlNPTi5wYXJzZShyZXNwb25zZS5jb250ZW50KS5yZXN1bHQuZm9yRWFjaCgodmFsaWRhdG9yKSA9PiB2YWxpZGF0b3JTZXRbdmFsaWRhdG9yLmNvbnNlbnN1c19wdWJrZXldID0gdmFsaWRhdG9yKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZSl7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHVybCA9IExDRCsnL3N0YWtpbmcvdmFsaWRhdG9ycz9zdGF0dXM9dW5ib25kZWQnO1xuXG4gICAgICAgICAgICB0cnl7XG4gICAgICAgICAgICAgICAgcmVzcG9uc2UgPSBIVFRQLmdldCh1cmwpO1xuICAgICAgICAgICAgICAgIEpTT04ucGFyc2UocmVzcG9uc2UuY29udGVudCkucmVzdWx0LmZvckVhY2goKHZhbGlkYXRvcikgPT4gdmFsaWRhdG9yU2V0W3ZhbGlkYXRvci5jb25zZW5zdXNfcHVia2V5XSA9IHZhbGlkYXRvcilcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoKGUpe1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IHRvdGFsVmFsaWRhdG9ycyA9IE9iamVjdC5rZXlzKHZhbGlkYXRvclNldCkubGVuZ3RoO1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJhbGwgdmFsaWRhdG9yczogXCIrIHRvdGFsVmFsaWRhdG9ycyk7XG4gICAgICAgICAgICBmb3IgKGxldCBoZWlnaHQgPSBjdXJyKzEgOyBoZWlnaHQgPD0gdW50aWwgOyBoZWlnaHQrKykge1xuICAgICAgICAgICAgICAgIGxldCBzdGFydEJsb2NrVGltZSA9IG5ldyBEYXRlKCk7XG4gICAgICAgICAgICAgICAgLy8gYWRkIHRpbWVvdXQgaGVyZT8gYW5kIG91dHNpZGUgdGhpcyBsb29wIChmb3IgY2F0Y2hlZCB1cCBhbmQga2VlcCBmZXRjaGluZyk/XG4gICAgICAgICAgICAgICAgdGhpcy51bmJsb2NrKCk7XG4gICAgICAgICAgICAgICAgbGV0IHVybCA9IFJQQysnL2Jsb2NrP2hlaWdodD0nICsgaGVpZ2h0O1xuICAgICAgICAgICAgICAgIGxldCBhbmFseXRpY3NEYXRhID0ge307XG5cbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyh1cmwpO1xuICAgICAgICAgICAgICAgIHRyeXtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYnVsa1ZhbGlkYXRvcnMgPSBWYWxpZGF0b3JzLnJhd0NvbGxlY3Rpb24oKS5pbml0aWFsaXplVW5vcmRlcmVkQnVsa09wKCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJ1bGtWYWxpZGF0b3JSZWNvcmRzID0gVmFsaWRhdG9yUmVjb3Jkcy5yYXdDb2xsZWN0aW9uKCkuaW5pdGlhbGl6ZVVub3JkZXJlZEJ1bGtPcCgpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBidWxrVlBIaXN0b3J5ID0gVm90aW5nUG93ZXJIaXN0b3J5LnJhd0NvbGxlY3Rpb24oKS5pbml0aWFsaXplVW5vcmRlcmVkQnVsa09wKCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJ1bGtUcmFuc2F0aW9ucyA9IFRyYW5zYWN0aW9ucy5yYXdDb2xsZWN0aW9uKCkuaW5pdGlhbGl6ZVVub3JkZXJlZEJ1bGtPcCgpO1xuXG4gICAgICAgICAgICAgICAgICAgIGxldCBzdGFydEdldEhlaWdodFRpbWUgPSBuZXcgRGF0ZSgpO1xuICAgICAgICAgICAgICAgICAgICBsZXQgcmVzcG9uc2UgPSBIVFRQLmdldCh1cmwpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PSAyMDApe1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGJsb2NrID0gSlNPTi5wYXJzZShyZXNwb25zZS5jb250ZW50KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJsb2NrID0gYmxvY2sucmVzdWx0O1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gc3RvcmUgaGVpZ2h0LCBoYXNoLCBudW10cmFuc2FjdGlvbiBhbmQgdGltZSBpbiBkYlxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGJsb2NrRGF0YSA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgYmxvY2tEYXRhLmhlaWdodCA9IGhlaWdodDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJsb2NrRGF0YS5oYXNoID0gYmxvY2suYmxvY2tfaWQuaGFzaDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJsb2NrRGF0YS50cmFuc051bSA9IGJsb2NrLmJsb2NrLmRhdGEudHhzP2Jsb2NrLmJsb2NrLmRhdGEudHhzLmxlbmd0aDowO1xuICAgICAgICAgICAgICAgICAgICAgICAgYmxvY2tEYXRhLnRpbWUgPSBuZXcgRGF0ZShibG9jay5ibG9jay5oZWFkZXIudGltZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBibG9ja0RhdGEubGFzdEJsb2NrSGFzaCA9IGJsb2NrLmJsb2NrLmhlYWRlci5sYXN0X2Jsb2NrX2lkLmhhc2g7XG4gICAgICAgICAgICAgICAgICAgICAgICBibG9ja0RhdGEucHJvcG9zZXJBZGRyZXNzID0gYmxvY2suYmxvY2suaGVhZGVyLnByb3Bvc2VyX2FkZHJlc3M7XG4gICAgICAgICAgICAgICAgICAgICAgICBibG9ja0RhdGEudmFsaWRhdG9ycyA9IFtdO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBUZW5kZXJtaW50IHYwLjMzIHN0YXJ0IHVzaW5nIFwic2lnbmF0dXJlc1wiIGluIGxhc3QgYmxvY2sgaW5zdGVhZCBvZiBcInByZWNvbW1pdHNcIlxuXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgcHJlY29tbWl0cyA9IGJsb2NrLmJsb2NrLmxhc3RfY29tbWl0LnNpZ25hdHVyZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocHJlY29tbWl0cyAhPSBudWxsKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhwcmVjb21taXRzLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaT0wOyBpPHByZWNvbW1pdHMubGVuZ3RoOyBpKyspe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocHJlY29tbWl0c1tpXSAhPSBudWxsKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJsb2NrRGF0YS52YWxpZGF0b3JzLnB1c2gocHJlY29tbWl0c1tpXS52YWxpZGF0b3JfYWRkcmVzcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbmFseXRpY3NEYXRhLnByZWNvbW1pdHMgPSBwcmVjb21taXRzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyByZWNvcmQgZm9yIGFuYWx5dGljc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFByZWNvbW1pdFJlY29yZHMuaW5zZXJ0KHtoZWlnaHQ6aGVpZ2h0LCBwcmVjb21taXRzOnByZWNvbW1pdHMubGVuZ3RofSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNhdmUgdHhzIGluIGRhdGFiYXNlXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYmxvY2suYmxvY2suZGF0YS50eHMgJiYgYmxvY2suYmxvY2suZGF0YS50eHMubGVuZ3RoID4gMCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh0IGluIGJsb2NrLmJsb2NrLmRhdGEudHhzKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWV0ZW9yLmNhbGwoJ1RyYW5zYWN0aW9ucy5pbmRleCcsIHNoYTI1NihCdWZmZXIuZnJvbShibG9jay5ibG9jay5kYXRhLnR4c1t0XSwgJ2Jhc2U2NCcpKSwgYmxvY2tEYXRhLnRpbWUsIChlcnIsIHJlc3VsdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycil7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzYXZlIGRvdWJsZSBzaWduIGV2aWRlbmNlc1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJsb2NrLmJsb2NrLmV2aWRlbmNlLmV2aWRlbmNlKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBFdmlkZW5jZXMuaW5zZXJ0KHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVpZ2h0OiBoZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2aWRlbmNlOiBibG9jay5ibG9jay5ldmlkZW5jZS5ldmlkZW5jZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBibG9ja0RhdGEucHJlY29tbWl0c0NvdW50ID0gYmxvY2tEYXRhLnZhbGlkYXRvcnMubGVuZ3RoO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBhbmFseXRpY3NEYXRhLmhlaWdodCA9IGhlaWdodDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGVuZEdldEhlaWdodFRpbWUgPSBuZXcgRGF0ZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJHZXQgaGVpZ2h0IHRpbWU6IFwiKygoZW5kR2V0SGVpZ2h0VGltZS1zdGFydEdldEhlaWdodFRpbWUpLzEwMDApK1wic2Vjb25kcy5cIik7XG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHN0YXJ0R2V0VmFsaWRhdG9yc1RpbWUgPSBuZXcgRGF0ZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdXBkYXRlIGNoYWluIHN0YXR1c1xuICAgICAgICAgICAgICAgICAgICAgICAgLy91cmwgPSBSUEMrJy92YWxpZGF0b3JzP2hlaWdodD0nK2hlaWdodDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVybCA9IFJQQytgL3ZhbGlkYXRvcnM/aGVpZ2h0PSR7aGVpZ2h0fSZwYWdlPTEmcGVyX3BhZ2U9MTAwYDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlID0gSFRUUC5nZXQodXJsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHVybCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgdmFsaWRhdG9ycyA9IEpTT04ucGFyc2UocmVzcG9uc2UuY29udGVudCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3JzLnJlc3VsdC5ibG9ja19oZWlnaHQgPSBwYXJzZUludCh2YWxpZGF0b3JzLnJlc3VsdC5ibG9ja19oZWlnaHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgVmFsaWRhdG9yU2V0cy5pbnNlcnQodmFsaWRhdG9ycy5yZXN1bHQpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBibG9ja0RhdGEudmFsaWRhdG9yc0NvdW50ID0gdmFsaWRhdG9ycy5yZXN1bHQudmFsaWRhdG9ycy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgc3RhcnRCbG9ja0luc2VydFRpbWUgPSBuZXcgRGF0ZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgQmxvY2tzY29uLmluc2VydChibG9ja0RhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGVuZEJsb2NrSW5zZXJ0VGltZSA9IG5ldyBEYXRlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIkJsb2NrIGluc2VydCB0aW1lOiBcIisoKGVuZEJsb2NrSW5zZXJ0VGltZS1zdGFydEJsb2NrSW5zZXJ0VGltZSkvMTAwMCkrXCJzZWNvbmRzLlwiKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gc3RvcmUgdmFsZGlhdG9ycyBleGlzdCByZWNvcmRzXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZXhpc3RpbmdWYWxpZGF0b3JzID0gVmFsaWRhdG9ycy5maW5kKHthZGRyZXNzOnskZXhpc3RzOnRydWV9fSkuZmV0Y2goKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGhlaWdodCA+IDEpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHJlY29yZCBwcmVjb21taXRzIGFuZCBjYWxjdWxhdGUgdXB0aW1lXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gb25seSByZWNvcmQgZnJvbSBibG9jayAyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChpIGluIHZhbGlkYXRvcnMucmVzdWx0LnZhbGlkYXRvcnMpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgYWRkcmVzcyA9IHZhbGlkYXRvcnMucmVzdWx0LnZhbGlkYXRvcnNbaV0uYWRkcmVzcztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHJlY29yZCA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlaWdodDogaGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkcmVzczogYWRkcmVzcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4aXN0czogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2b3RpbmdfcG93ZXI6IHBhcnNlSW50KHZhbGlkYXRvcnMucmVzdWx0LnZhbGlkYXRvcnNbaV0udm90aW5nX3Bvd2VyKS8vZ2V0VmFsaWRhdG9yVm90aW5nUG93ZXIoZXhpc3RpbmdWYWxpZGF0b3JzLCBhZGRyZXNzKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChqIGluIHByZWNvbW1pdHMpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByZWNvbW1pdHNbal0gIT0gbnVsbCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFkZHJlc3MgPT0gcHJlY29tbWl0c1tqXS52YWxpZGF0b3JfYWRkcmVzcyl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlY29yZC5leGlzdHMgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmVjb21taXRzLnNwbGljZShqLDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjYWxjdWxhdGUgdGhlIHVwdGltZSBiYXNlZCBvbiB0aGUgcmVjb3JkcyBzdG9yZWQgaW4gcHJldmlvdXMgYmxvY2tzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIG9ubHkgZG8gdGhpcyBldmVyeSAxNSBibG9ja3MgflxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICgoaGVpZ2h0ICUgMTUpID09IDApe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbGV0IHN0YXJ0QWdnVGltZSA9IG5ldyBEYXRlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgbnVtQmxvY2tzID0gTWV0ZW9yLmNhbGwoJ2Jsb2Nrcy5maW5kVXBUaW1lJywgYWRkcmVzcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgdXB0aW1lID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxldCBlbmRBZ2dUaW1lID0gbmV3IERhdGUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwiR2V0IGFnZ3JlZ2F0ZWQgdXB0aW1lIGZvciBcIitleGlzdGluZ1ZhbGlkYXRvcnNbaV0uYWRkcmVzcytcIjogXCIrKChlbmRBZ2dUaW1lLXN0YXJ0QWdnVGltZSkvMTAwMCkrXCJzZWNvbmRzLlwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICgobnVtQmxvY2tzWzBdICE9IG51bGwpICYmIChudW1CbG9ja3NbMF0udXB0aW1lICE9IG51bGwpKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cHRpbWUgPSBudW1CbG9ja3NbMF0udXB0aW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgYmFzZSA9IE1ldGVvci5zZXR0aW5ncy5wdWJsaWMudXB0aW1lV2luZG93O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGhlaWdodCA8IGJhc2Upe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJhc2UgPSBoZWlnaHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZWNvcmQuZXhpc3RzKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodXB0aW1lIDwgYmFzZSl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVwdGltZSsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cHRpbWUgPSAodXB0aW1lIC8gYmFzZSkqMTAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJ1bGtWYWxpZGF0b3JzLmZpbmQoe2FkZHJlc3M6YWRkcmVzc30pLnVwc2VydCgpLnVwZGF0ZU9uZSh7JHNldDp7dXB0aW1lOnVwdGltZSwgbGFzdFNlZW46YmxvY2tEYXRhLnRpbWV9fSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNle1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVwdGltZSA9ICh1cHRpbWUgLyBiYXNlKSoxMDA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnVsa1ZhbGlkYXRvcnMuZmluZCh7YWRkcmVzczphZGRyZXNzfSkudXBzZXJ0KCkudXBkYXRlT25lKHskc2V0Ont1cHRpbWU6dXB0aW1lfX0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnVsa1ZhbGlkYXRvclJlY29yZHMuaW5zZXJ0KHJlY29yZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFZhbGlkYXRvclJlY29yZHMudXBkYXRlKHtoZWlnaHQ6aGVpZ2h0LGFkZHJlc3M6cmVjb3JkLmFkZHJlc3N9LHJlY29yZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgY2hhaW5TdGF0dXMgPSBDaGFpbi5maW5kT25lKHtjaGFpbklkOmJsb2NrLmJsb2NrLmhlYWRlci5jaGFpbl9pZH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGxhc3RTeW5jZWRUaW1lID0gY2hhaW5TdGF0dXM/Y2hhaW5TdGF0dXMubGFzdFN5bmNlZFRpbWU6MDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCB0aW1lRGlmZjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBibG9ja1RpbWUgPSBNZXRlb3Iuc2V0dGluZ3MucGFyYW1zLmRlZmF1bHRCbG9ja1RpbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGFzdFN5bmNlZFRpbWUpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBkYXRlTGF0ZXN0ID0gYmxvY2tEYXRhLnRpbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGRhdGVMYXN0ID0gbmV3IERhdGUobGFzdFN5bmNlZFRpbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVEaWZmID0gTWF0aC5hYnMoZGF0ZUxhdGVzdC5nZXRUaW1lKCkgLSBkYXRlTGFzdC5nZXRUaW1lKCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJsb2NrVGltZSA9IChjaGFpblN0YXR1cy5ibG9ja1RpbWUgKiAoYmxvY2tEYXRhLmhlaWdodCAtIDEpICsgdGltZURpZmYpIC8gYmxvY2tEYXRhLmhlaWdodDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGVuZEdldFZhbGlkYXRvcnNUaW1lID0gbmV3IERhdGUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiR2V0IGhlaWdodCB2YWxpZGF0b3JzIHRpbWU6IFwiKygoZW5kR2V0VmFsaWRhdG9yc1RpbWUtc3RhcnRHZXRWYWxpZGF0b3JzVGltZSkvMTAwMCkrXCJzZWNvbmRzLlwiKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgQ2hhaW4udXBkYXRlKHtjaGFpbklkOmJsb2NrLmJsb2NrLmhlYWRlci5jaGFpbl9pZH0sIHskc2V0OntsYXN0U3luY2VkVGltZTpibG9ja0RhdGEudGltZSwgYmxvY2tUaW1lOmJsb2NrVGltZX19KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgYW5hbHl0aWNzRGF0YS5hdmVyYWdlQmxvY2tUaW1lID0gYmxvY2tUaW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgYW5hbHl0aWNzRGF0YS50aW1lRGlmZiA9IHRpbWVEaWZmO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBhbmFseXRpY3NEYXRhLnRpbWUgPSBibG9ja0RhdGEudGltZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gaW5pdGlhbGl6ZSB2YWxpZGF0b3IgZGF0YSBhdCBmaXJzdCBibG9ja1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gaWYgKGhlaWdodCA9PSAxKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgICBWYWxpZGF0b3JzLnJlbW92ZSh7fSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGFuYWx5dGljc0RhdGEudm90aW5nX3Bvd2VyID0gMDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHN0YXJ0RmluZFZhbGlkYXRvcnNOYW1lVGltZSA9IG5ldyBEYXRlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodmFsaWRhdG9ycy5yZXN1bHQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHZhbGlkYXRvcnMgYXJlIGFsbCB0aGUgdmFsaWRhdG9ycyBpbiB0aGUgY3VycmVudCBoZWlnaHRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInZhbGlkYXRvclNldCBzaXplOiBcIit2YWxpZGF0b3JzLnJlc3VsdC52YWxpZGF0b3JzLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2IGluIHZhbGlkYXRvcnMucmVzdWx0LnZhbGlkYXRvcnMpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBWYWxpZGF0b3JzLmluc2VydCh2YWxpZGF0b3JzLnJlc3VsdC52YWxpZGF0b3JzW3ZdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHZhbGlkYXRvciA9IHZhbGlkYXRvcnMucmVzdWx0LnZhbGlkYXRvcnNbdl07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRvci52b3RpbmdfcG93ZXIgPSBwYXJzZUludCh2YWxpZGF0b3Iudm90aW5nX3Bvd2VyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdG9yLnByb3Bvc2VyX3ByaW9yaXR5ID0gcGFyc2VJbnQodmFsaWRhdG9yLnByb3Bvc2VyX3ByaW9yaXR5KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgdmFsRXhpc3QgPSBWYWxpZGF0b3JzLmZpbmRPbmUoe1wicHViX2tleS52YWx1ZVwiOnZhbGlkYXRvci5wdWJfa2V5LnZhbHVlfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdmFsRXhpc3Qpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYHZhbGlkYXRvciBwdWJfa2V5ICR7dmFsaWRhdG9yLmFkZHJlc3N9ICR7dmFsaWRhdG9yLnB1Yl9rZXkudmFsdWV9IG5vdCBpbiBkYmApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbGV0IGNvbW1hbmQgPSBNZXRlb3Iuc2V0dGluZ3MuYmluLmdhaWFkZWJ1ZytcIiBwdWJrZXkgXCIrdmFsaWRhdG9yLnB1Yl9rZXkudmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhjb21tYW5kKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxldCB0ZW1wVmFsID0gdmFsaWRhdG9yO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3IuYWRkcmVzcyA9IGdldEFkZHJlc3ModmFsaWRhdG9yLnB1Yl9rZXkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdG9yLmFjY3B1YiA9IE1ldGVvci5jYWxsKCdwdWJrZXlUb0JlY2gzMicsIHZhbGlkYXRvci5wdWJfa2V5LCBNZXRlb3Iuc2V0dGluZ3MucHVibGljLmJlY2gzMlByZWZpeEFjY1B1Yik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3Iub3BlcmF0b3JfcHVia2V5ID0gTWV0ZW9yLmNhbGwoJ3B1YmtleVRvQmVjaDMyJywgdmFsaWRhdG9yLnB1Yl9rZXksIE1ldGVvci5zZXR0aW5ncy5wdWJsaWMuYmVjaDMyUHJlZml4VmFsUHViKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRvci5jb25zZW5zdXNfcHVia2V5ID0gTWV0ZW9yLmNhbGwoJ3B1YmtleVRvQmVjaDMyJywgdmFsaWRhdG9yLnB1Yl9rZXksIE1ldGVvci5zZXR0aW5ncy5wdWJsaWMuYmVjaDMyUHJlZml4Q29uc1B1Yik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCB2YWxpZGF0b3JEYXRhID0gdmFsaWRhdG9yU2V0W3ZhbGlkYXRvci5jb25zZW5zdXNfcHVia2V5XVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHZhbGlkYXRvckRhdGEpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh2YWxpZGF0b3JEYXRhLmRlc2NyaXB0aW9uLmlkZW50aXR5KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3IucHJvZmlsZV91cmwgPSAgZ2V0VmFsaWRhdG9yUHJvZmlsZVVybCh2YWxpZGF0b3JEYXRhLmRlc2NyaXB0aW9uLmlkZW50aXR5KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRvci5vcGVyYXRvcl9hZGRyZXNzID0gdmFsaWRhdG9yRGF0YS5vcGVyYXRvcl9hZGRyZXNzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRvci5kZWxlZ2F0b3JfYWRkcmVzcyA9IE1ldGVvci5jYWxsKCdnZXREZWxlZ2F0b3InLCB2YWxpZGF0b3JEYXRhLm9wZXJhdG9yX2FkZHJlc3MpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRvci5qYWlsZWQgPSB2YWxpZGF0b3JEYXRhLmphaWxlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3Iuc3RhdHVzID0gdmFsaWRhdG9yRGF0YS5zdGF0dXM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdG9yLm1pbl9zZWxmX2RlbGVnYXRpb24gPSB2YWxpZGF0b3JEYXRhLm1pbl9zZWxmX2RlbGVnYXRpb247XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdG9yLnRva2VucyA9IHZhbGlkYXRvckRhdGEudG9rZW5zO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRvci5kZWxlZ2F0b3Jfc2hhcmVzID0gdmFsaWRhdG9yRGF0YS5kZWxlZ2F0b3Jfc2hhcmVzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRvci5kZXNjcmlwdGlvbiA9IHZhbGlkYXRvckRhdGEuZGVzY3JpcHRpb247XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdG9yLmJvbmRfaGVpZ2h0ID0gdmFsaWRhdG9yRGF0YS5ib25kX2hlaWdodDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3IuYm9uZF9pbnRyYV90eF9jb3VudGVyID0gdmFsaWRhdG9yRGF0YS5ib25kX2ludHJhX3R4X2NvdW50ZXI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdG9yLnVuYm9uZGluZ19oZWlnaHQgPSB2YWxpZGF0b3JEYXRhLnVuYm9uZGluZ19oZWlnaHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdG9yLnVuYm9uZGluZ190aW1lID0gdmFsaWRhdG9yRGF0YS51bmJvbmRpbmdfdGltZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3IuY29tbWlzc2lvbiA9IHZhbGlkYXRvckRhdGEuY29tbWlzc2lvbjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3Iuc2VsZl9kZWxlZ2F0aW9uID0gdmFsaWRhdG9yLmRlbGVnYXRvcl9zaGFyZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdmFsaWRhdG9yLnJlbW92ZWQgPSBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB2YWxpZGF0b3IucmVtb3ZlZEF0ID0gMFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHZhbGlkYXRvclNldC5zcGxpY2UodmFsLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ25vIGNvbiBwdWIga2V5PycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGJ1bGtWYWxpZGF0b3JzLmluc2VydCh2YWxpZGF0b3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnVsa1ZhbGlkYXRvcnMuZmluZCh7YWRkcmVzczogdmFsaWRhdG9yLmFkZHJlc3N9KS51cHNlcnQoKS51cGRhdGVPbmUoeyRzZXQ6dmFsaWRhdG9yfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcInZhbGlkYXRvciBmaXJzdCBhcHBlYXJzOiBcIitidWxrVmFsaWRhdG9ycy5sZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnVsa1ZQSGlzdG9yeS5pbnNlcnQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZHJlc3M6IHZhbGlkYXRvci5hZGRyZXNzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZXZfdm90aW5nX3Bvd2VyOiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZvdGluZ19wb3dlcjogdmFsaWRhdG9yLnZvdGluZ19wb3dlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYWRkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZWlnaHQ6IGJsb2NrRGF0YS5oZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYmxvY2tfdGltZTogYmxvY2tEYXRhLnRpbWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBNZXRlb3IuY2FsbCgncnVuQ29kZScsIGNvbW1hbmQsIGZ1bmN0aW9uKGVycm9yLCByZXN1bHQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdmFsaWRhdG9yLmFkZHJlc3MgPSByZXN1bHQubWF0Y2goL1xcc1swLTlBLUZdezQwfSQvaWdtKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHZhbGlkYXRvci5hZGRyZXNzID0gdmFsaWRhdG9yLmFkZHJlc3NbMF0udHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdmFsaWRhdG9yLmhleCA9IHJlc3VsdC5tYXRjaCgvXFxzWzAtOUEtRl17NjR9JC9pZ20pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdmFsaWRhdG9yLmhleCA9IHZhbGlkYXRvci5oZXhbMF0udHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdmFsaWRhdG9yLmNvc21vc2FjY3B1YiA9IHJlc3VsdC5tYXRjaCgvZHgwcHViLiokL2lnbSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB2YWxpZGF0b3IuY29zbW9zYWNjcHViID0gdmFsaWRhdG9yLmR4MGFjY3B1YlswXS50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB2YWxpZGF0b3Iub3BlcmF0b3JfcHVia2V5ID0gcmVzdWx0Lm1hdGNoKC9keDB2YWxvcGVycHViLiokL2lnbSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB2YWxpZGF0b3Iub3BlcmF0b3JfcHVia2V5ID0gdmFsaWRhdG9yLm9wZXJhdG9yX3B1YmtleVswXS50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB2YWxpZGF0b3IuY29uc2Vuc3VzX3B1YmtleSA9IHJlc3VsdC5tYXRjaCgvZHgwc3ZhbGNvbnNwdWIuKiQvaWdtKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHZhbGlkYXRvci5jb25zZW5zdXNfcHVia2V5ID0gdmFsaWRhdG9yLmNvbnNlbnN1c19wdWJrZXlbMF0udHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCB2YWxpZGF0b3JEYXRhID0gdmFsaWRhdG9yU2V0W3ZhbEV4aXN0LmNvbnNlbnN1c19wdWJrZXldXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodmFsaWRhdG9yRGF0YSl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHZhbGlkYXRvckRhdGEuZGVzY3JpcHRpb24gJiYgKCF2YWxFeGlzdC5kZXNjcmlwdGlvbiB8fCB2YWxpZGF0b3JEYXRhLmRlc2NyaXB0aW9uLmlkZW50aXR5ICE9PSB2YWxFeGlzdC5kZXNjcmlwdGlvbi5pZGVudGl0eSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRvci5wcm9maWxlX3VybCA9ICBnZXRWYWxpZGF0b3JQcm9maWxlVXJsKHZhbGlkYXRvckRhdGEuZGVzY3JpcHRpb24uaWRlbnRpdHkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdG9yLmphaWxlZCA9IHZhbGlkYXRvckRhdGEuamFpbGVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRvci5zdGF0dXMgPSB2YWxpZGF0b3JEYXRhLnN0YXR1cztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3IudG9rZW5zID0gdmFsaWRhdG9yRGF0YS50b2tlbnM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdG9yLmRlbGVnYXRvcl9zaGFyZXMgPSB2YWxpZGF0b3JEYXRhLmRlbGVnYXRvcl9zaGFyZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdG9yLmRlc2NyaXB0aW9uID0gdmFsaWRhdG9yRGF0YS5kZXNjcmlwdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3IuYm9uZF9oZWlnaHQgPSB2YWxpZGF0b3JEYXRhLmJvbmRfaGVpZ2h0O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRvci5ib25kX2ludHJhX3R4X2NvdW50ZXIgPSB2YWxpZGF0b3JEYXRhLmJvbmRfaW50cmFfdHhfY291bnRlcjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3IudW5ib25kaW5nX2hlaWdodCA9IHZhbGlkYXRvckRhdGEudW5ib25kaW5nX2hlaWdodDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3IudW5ib25kaW5nX3RpbWUgPSB2YWxpZGF0b3JEYXRhLnVuYm9uZGluZ190aW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRvci5jb21taXNzaW9uID0gdmFsaWRhdG9yRGF0YS5jb21taXNzaW9uO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2FsY3VsYXRlIHNlbGYgZGVsZWdhdGlvbiBwZXJjZW50YWdlIGV2ZXJ5IDMwIGJsb2Nrc1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGhlaWdodCAlIDMwID09IDEpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cnl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgcmVzcG9uc2UgPSBIVFRQLmdldChMQ0QgKyAnL3N0YWtpbmcvZGVsZWdhdG9ycy8nK3ZhbEV4aXN0LmRlbGVnYXRvcl9hZGRyZXNzKycvZGVsZWdhdGlvbnMvJyt2YWxFeGlzdC5vcGVyYXRvcl9hZGRyZXNzKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT0gMjAwKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgc2VsZkRlbGVnYXRpb24gPSBKU09OLnBhcnNlKHJlc3BvbnNlLmNvbnRlbnQpLnJlc3VsdDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZkRlbGVnYXRpb24uc2hhcmVzKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdG9yLnNlbGZfZGVsZWdhdGlvbiA9IHBhcnNlRmxvYXQoc2VsZkRlbGVnYXRpb24uc2hhcmVzKS9wYXJzZUZsb2F0KHZhbGlkYXRvci5kZWxlZ2F0b3Jfc2hhcmVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2F0Y2goZSl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJ1bGtWYWxpZGF0b3JzLmZpbmQoe2NvbnNlbnN1c19wdWJrZXk6IHZhbEV4aXN0LmNvbnNlbnN1c19wdWJrZXl9KS51cGRhdGVPbmUoeyRzZXQ6dmFsaWRhdG9yfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coXCJ2YWxpZGF0b3IgZXhpc2l0czogXCIrYnVsa1ZhbGlkYXRvcnMubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB2YWxpZGF0b3JTZXQuc3BsaWNlKHZhbCwgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9ICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnbm8gY29uIHB1YiBrZXk/JylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBwcmV2Vm90aW5nUG93ZXIgPSBWb3RpbmdQb3dlckhpc3RvcnkuZmluZE9uZSh7YWRkcmVzczp2YWxpZGF0b3IuYWRkcmVzc30sIHtoZWlnaHQ6LTEsIGxpbWl0OjF9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByZXZWb3RpbmdQb3dlcil7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByZXZWb3RpbmdQb3dlci52b3RpbmdfcG93ZXIgIT0gdmFsaWRhdG9yLnZvdGluZ19wb3dlcil7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBjaGFuZ2VUeXBlID0gKHByZXZWb3RpbmdQb3dlci52b3RpbmdfcG93ZXIgPiB2YWxpZGF0b3Iudm90aW5nX3Bvd2VyKT8nZG93bic6J3VwJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGNoYW5nZURhdGEgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhZGRyZXNzOiB2YWxpZGF0b3IuYWRkcmVzcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZXZfdm90aW5nX3Bvd2VyOiBwcmV2Vm90aW5nUG93ZXIudm90aW5nX3Bvd2VyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdm90aW5nX3Bvd2VyOiB2YWxpZGF0b3Iudm90aW5nX3Bvd2VyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogY2hhbmdlVHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlaWdodDogYmxvY2tEYXRhLmhlaWdodCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJsb2NrX3RpbWU6IGJsb2NrRGF0YS50aW1lXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCd2b3RpbmcgcG93ZXIgY2hhbmdlZC4nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coY2hhbmdlRGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJ1bGtWUEhpc3RvcnkuaW5zZXJ0KGNoYW5nZURhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyh2YWxpZGF0b3IpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFuYWx5dGljc0RhdGEudm90aW5nX3Bvd2VyICs9IHZhbGlkYXRvci52b3RpbmdfcG93ZXI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaWYgdGhlcmUgaXMgdmFsaWRhdG9yIHJlbW92ZWRcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBwcmV2VmFsaWRhdG9ycyA9IFZhbGlkYXRvclNldHMuZmluZE9uZSh7YmxvY2tfaGVpZ2h0OmhlaWdodC0xfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocHJldlZhbGlkYXRvcnMpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgcmVtb3ZlZFZhbGlkYXRvcnMgPSBnZXRSZW1vdmVkVmFsaWRhdG9ycyhwcmV2VmFsaWRhdG9ycy52YWxpZGF0b3JzLCB2YWxpZGF0b3JzLnJlc3VsdC52YWxpZGF0b3JzKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHIgaW4gcmVtb3ZlZFZhbGlkYXRvcnMpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnVsa1ZQSGlzdG9yeS5pbnNlcnQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZHJlc3M6IHJlbW92ZWRWYWxpZGF0b3JzW3JdLmFkZHJlc3MsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJldl92b3RpbmdfcG93ZXI6IHJlbW92ZWRWYWxpZGF0b3JzW3JdLnZvdGluZ19wb3dlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2b3RpbmdfcG93ZXI6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3JlbW92ZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVpZ2h0OiBibG9ja0RhdGEuaGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJsb2NrX3RpbWU6IGJsb2NrRGF0YS50aW1lXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNoZWNrIGlmIHRoZXJlJ3MgYW55IHZhbGlkYXRvciBub3QgaW4gZGIgMTQ0MDAgYmxvY2tzKH4xIGRheSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChoZWlnaHQgJSAxNDQwMCA9PSAwKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnQ2hlY2tpbmcgYWxsIHZhbGlkYXRvcnMgYWdhaW5zdCBkYi4uLicpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBkYlZhbGlkYXRvcnMgPSB7fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBWYWxpZGF0b3JzLmZpbmQoe30sIHtmaWVsZHM6IHtjb25zZW5zdXNfcHVia2V5OiAxLCBzdGF0dXM6IDF9fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApLmZvckVhY2goKHYpID0+IGRiVmFsaWRhdG9yc1t2LmNvbnNlbnN1c19wdWJrZXldID0gdi5zdGF0dXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzKHZhbGlkYXRvclNldCkuZm9yRWFjaCgoY29uUHViS2V5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgdmFsaWRhdG9yRGF0YSA9IHZhbGlkYXRvclNldFtjb25QdWJLZXldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQWN0aXZlIHZhbGlkYXRvcnMgc2hvdWxkIGhhdmUgYmVlbiB1cGRhdGVkIGluIHByZXZpb3VzIHN0ZXBzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodmFsaWRhdG9yRGF0YS5zdGF0dXMgPT09IDIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkYlZhbGlkYXRvcnNbY29uUHViS2V5XSA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgdmFsaWRhdG9yIHdpdGggY29uc2Vuc3VzX3B1YmtleSAke2NvblB1YktleX0gbm90IGluIGRiYCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3JEYXRhLnB1Yl9rZXkgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwidHlwZVwiIDogXCJ0ZW5kZXJtaW50L1B1YktleUVkMjU1MTlcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJ2YWx1ZVwiOiBNZXRlb3IuY2FsbCgnYmVjaDMyVG9QdWJrZXknLCBjb25QdWJLZXkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRvckRhdGEuYWRkcmVzcyA9IGdldEFkZHJlc3ModmFsaWRhdG9yRGF0YS5wdWJfa2V5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3JEYXRhLmRlbGVnYXRvcl9hZGRyZXNzID0gTWV0ZW9yLmNhbGwoJ2dldERlbGVnYXRvcicsIHZhbGlkYXRvckRhdGEub3BlcmF0b3JfYWRkcmVzcyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3JEYXRhLmFjY3B1YiA9IE1ldGVvci5jYWxsKCdwdWJrZXlUb0JlY2gzMicsIHZhbGlkYXRvckRhdGEucHViX2tleSwgTWV0ZW9yLnNldHRpbmdzLnB1YmxpYy5iZWNoMzJQcmVmaXhBY2NQdWIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRvckRhdGEub3BlcmF0b3JfcHVia2V5ID0gTWV0ZW9yLmNhbGwoJ3B1YmtleVRvQmVjaDMyJywgdmFsaWRhdG9yRGF0YS5wdWJfa2V5LCBNZXRlb3Iuc2V0dGluZ3MucHVibGljLmJlY2gzMlByZWZpeFZhbFB1Yik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coSlNPTi5zdHJpbmdpZnkodmFsaWRhdG9yRGF0YSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnVsa1ZhbGlkYXRvcnMuZmluZCh7Y29uc2Vuc3VzX3B1YmtleTogY29uUHViS2V5fSkudXBzZXJ0KCkudXBkYXRlT25lKHskc2V0OnZhbGlkYXRvckRhdGF9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZGJWYWxpZGF0b3JzW2NvblB1YktleV0gPT0gMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJ1bGtWYWxpZGF0b3JzLmZpbmQoe2NvbnNlbnN1c19wdWJrZXk6IGNvblB1YktleX0pLnVwc2VydCgpLnVwZGF0ZU9uZSh7JHNldDp2YWxpZGF0b3JEYXRhfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBmZXRjaGluZyBrZXliYXNlIGV2ZXJ5IDE0NDAwIGJsb2Nrcyh+MSBkYXkpXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaGVpZ2h0ICUgMTQ0MDAgPT0gMSl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0ZldGNoaW5nIGtleWJhc2UuLi4nKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFZhbGlkYXRvcnMuZmluZCh7fSkuZm9yRWFjaCgodmFsaWRhdG9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgcHJvZmlsZVVybCA9ICBnZXRWYWxpZGF0b3JQcm9maWxlVXJsKHZhbGlkYXRvci5kZXNjcmlwdGlvbi5pZGVudGl0eSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcm9maWxlVXJsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnVsa1ZhbGlkYXRvcnMuZmluZCh7YWRkcmVzczogdmFsaWRhdG9yLmFkZHJlc3N9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKS51cHNlcnQoKS51cGRhdGVPbmUoeyRzZXQ6eydwcm9maWxlX3VybCc6cHJvZmlsZVVybH19KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2cocHJvZmlsZVVybCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGVuZEZpbmRWYWxpZGF0b3JzTmFtZVRpbWUgPSBuZXcgRGF0ZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJHZXQgdmFsaWRhdG9ycyBuYW1lIHRpbWU6IFwiKygoZW5kRmluZFZhbGlkYXRvcnNOYW1lVGltZS1zdGFydEZpbmRWYWxpZGF0b3JzTmFtZVRpbWUpLzEwMDApK1wic2Vjb25kcy5cIik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHJlY29yZCBmb3IgYW5hbHl0aWNzXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgc3RhcnRBbmF5dGljc0luc2VydFRpbWUgPSBuZXcgRGF0ZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgQW5hbHl0aWNzLmluc2VydChhbmFseXRpY3NEYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBlbmRBbmFseXRpY3NJbnNlcnRUaW1lID0gbmV3IERhdGUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiQW5hbHl0aWNzIGluc2VydCB0aW1lOiBcIisoKGVuZEFuYWx5dGljc0luc2VydFRpbWUtc3RhcnRBbmF5dGljc0luc2VydFRpbWUpLzEwMDApK1wic2Vjb25kcy5cIik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBzdGFydFZVcFRpbWUgPSBuZXcgRGF0ZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJ1bGtWYWxpZGF0b3JzLmxlbmd0aCA+IDApe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGJ1bGtWYWxpZGF0b3JzLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnVsa1ZhbGlkYXRvcnMuZXhlY3V0ZSgoZXJyLCByZXN1bHQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycil7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2cocmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZW5kVlVwVGltZSA9IG5ldyBEYXRlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIlZhbGlkYXRvciB1cGRhdGUgdGltZTogXCIrKChlbmRWVXBUaW1lLXN0YXJ0VlVwVGltZSkvMTAwMCkrXCJzZWNvbmRzLlwiKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHN0YXJ0VlJUaW1lID0gbmV3IERhdGUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChidWxrVmFsaWRhdG9yUmVjb3Jkcy5sZW5ndGggPiAwKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBidWxrVmFsaWRhdG9yUmVjb3Jkcy5leGVjdXRlKChlcnIsIHJlc3VsdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGVuZFZSVGltZSA9IG5ldyBEYXRlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIlZhbGlkYXRvciByZWNvcmRzIHVwZGF0ZSB0aW1lOiBcIisoKGVuZFZSVGltZS1zdGFydFZSVGltZSkvMTAwMCkrXCJzZWNvbmRzLlwiKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJ1bGtWUEhpc3RvcnkubGVuZ3RoID4gMCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnVsa1ZQSGlzdG9yeS5leGVjdXRlKChlcnIsIHJlc3VsdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJ1bGtUcmFuc2F0aW9ucy5sZW5ndGggPiAwKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBidWxrVHJhbnNhdGlvbnMuZXhlY3V0ZSgoZXJyLCByZXN1bHQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycil7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNhbGN1bGF0ZSB2b3RpbmcgcG93ZXIgZGlzdHJpYnV0aW9uIGV2ZXJ5IDYwIGJsb2NrcyB+IDVtaW5zXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChoZWlnaHQgJSA2MCA9PSAxKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIj09PT09IGNhbGN1bGF0ZSB2b3RpbmcgcG93ZXIgZGlzdHJpYnV0aW9uID09PT09XCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBhY3RpdmVWYWxpZGF0b3JzID0gVmFsaWRhdG9ycy5maW5kKHtzdGF0dXM6MixqYWlsZWQ6ZmFsc2V9LHtzb3J0Ont2b3RpbmdfcG93ZXI6LTF9fSkuZmV0Y2goKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgbnVtVG9wVHdlbnR5ID0gTWF0aC5jZWlsKGFjdGl2ZVZhbGlkYXRvcnMubGVuZ3RoKjAuMik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IG51bUJvdHRvbUVpZ2h0eSA9IGFjdGl2ZVZhbGlkYXRvcnMubGVuZ3RoIC0gbnVtVG9wVHdlbnR5O1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHRvcFR3ZW50eVBvd2VyID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgYm90dG9tRWlnaHR5UG93ZXIgPSAwO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IG51bVRvcFRoaXJ0eUZvdXIgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBudW1Cb3R0b21TaXh0eVNpeCA9IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHRvcFRoaXJ0eUZvdXJQZXJjZW50ID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgYm90dG9tU2l4dHlTaXhQZXJjZW50ID0gMDtcblxuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHYgaW4gYWN0aXZlVmFsaWRhdG9ycyl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh2IDwgbnVtVG9wVHdlbnR5KXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvcFR3ZW50eVBvd2VyICs9IGFjdGl2ZVZhbGlkYXRvcnNbdl0udm90aW5nX3Bvd2VyO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2V7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBib3R0b21FaWdodHlQb3dlciArPSBhY3RpdmVWYWxpZGF0b3JzW3ZdLnZvdGluZ19wb3dlcjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRvcFRoaXJ0eUZvdXJQZXJjZW50IDwgMC4zNCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b3BUaGlydHlGb3VyUGVyY2VudCArPSBhY3RpdmVWYWxpZGF0b3JzW3ZdLnZvdGluZ19wb3dlciAvIGFuYWx5dGljc0RhdGEudm90aW5nX3Bvd2VyO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVtVG9wVGhpcnR5Rm91cisrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYm90dG9tU2l4dHlTaXhQZXJjZW50ID0gMSAtIHRvcFRoaXJ0eUZvdXJQZXJjZW50O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bUJvdHRvbVNpeHR5U2l4ID0gYWN0aXZlVmFsaWRhdG9ycy5sZW5ndGggLSBudW1Ub3BUaGlydHlGb3VyO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHZwRGlzdCA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVpZ2h0OiBoZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bVRvcFR3ZW50eTogbnVtVG9wVHdlbnR5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b3BUd2VudHlQb3dlcjogdG9wVHdlbnR5UG93ZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bUJvdHRvbUVpZ2h0eTogbnVtQm90dG9tRWlnaHR5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBib3R0b21FaWdodHlQb3dlcjogYm90dG9tRWlnaHR5UG93ZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bVRvcFRoaXJ0eUZvdXI6IG51bVRvcFRoaXJ0eUZvdXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvcFRoaXJ0eUZvdXJQZXJjZW50OiB0b3BUaGlydHlGb3VyUGVyY2VudCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVtQm90dG9tU2l4dHlTaXg6IG51bUJvdHRvbVNpeHR5U2l4LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBib3R0b21TaXh0eVNpeFBlcmNlbnQ6IGJvdHRvbVNpeHR5U2l4UGVyY2VudCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVtVmFsaWRhdG9yczogYWN0aXZlVmFsaWRhdG9ycy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvdGFsVm90aW5nUG93ZXI6IGFuYWx5dGljc0RhdGEudm90aW5nX3Bvd2VyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBibG9ja1RpbWU6IGJsb2NrRGF0YS50aW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVBdDogbmV3IERhdGUoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHZwRGlzdCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBWUERpc3RyaWJ1dGlvbnMuaW5zZXJ0KHZwRGlzdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGUpe1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlKTtcbiAgICAgICAgICAgICAgICAgICAgU1lOQ0lORyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gXCJTdG9wcGVkXCI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGxldCBlbmRCbG9ja1RpbWUgPSBuZXcgRGF0ZSgpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiVGhpcyBibG9jayB1c2VkOiBcIisoKGVuZEJsb2NrVGltZS1zdGFydEJsb2NrVGltZSkvMTAwMCkrXCJzZWNvbmRzLlwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFNZTkNJTkcgPSBmYWxzZTtcbiAgICAgICAgICAgIENoYWluLnVwZGF0ZSh7Y2hhaW5JZDpNZXRlb3Iuc2V0dGluZ3MucHVibGljLmNoYWluSWR9LCB7JHNldDp7bGFzdEJsb2Nrc1N5bmNlZFRpbWU6bmV3IERhdGUoKSwgdG90YWxWYWxpZGF0b3JzOnRvdGFsVmFsaWRhdG9yc319KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB1bnRpbDtcbiAgICB9LFxuICAgICdhZGRMaW1pdCc6IGZ1bmN0aW9uKGxpbWl0KSB7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGxpbWl0KzEwKVxuICAgICAgICByZXR1cm4gKGxpbWl0KzEwKTtcbiAgICB9LFxuICAgICdoYXNNb3JlJzogZnVuY3Rpb24obGltaXQpIHtcbiAgICAgICAgaWYgKGxpbWl0ID4gTWV0ZW9yLmNhbGwoJ2dldEN1cnJlbnRIZWlnaHQnKSkge1xuICAgICAgICAgICAgcmV0dXJuIChmYWxzZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gKHRydWUpO1xuICAgICAgICB9XG4gICAgfVxufSk7XG4iLCJpbXBvcnQgeyBNZXRlb3IgfSBmcm9tICdtZXRlb3IvbWV0ZW9yJztcbmltcG9ydCB7IEJsb2Nrc2NvbiB9IGZyb20gJy4uL2Jsb2Nrcy5qcyc7XG5pbXBvcnQgeyBWYWxpZGF0b3JzIH0gZnJvbSAnLi4vLi4vdmFsaWRhdG9ycy92YWxpZGF0b3JzLmpzJztcbmltcG9ydCB7IFRyYW5zYWN0aW9ucyB9IGZyb20gJy4uLy4uL3RyYW5zYWN0aW9ucy90cmFuc2FjdGlvbnMuanMnO1xuXG5wdWJsaXNoQ29tcG9zaXRlKCdibG9ja3MuaGVpZ2h0JywgZnVuY3Rpb24obGltaXQpe1xuICAgIHJldHVybiB7XG4gICAgICAgIGZpbmQoKXtcbiAgICAgICAgICAgIHJldHVybiBCbG9ja3Njb24uZmluZCh7fSwge2xpbWl0OiBsaW1pdCwgc29ydDoge2hlaWdodDogLTF9fSlcbiAgICAgICAgfSxcbiAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBmaW5kKGJsb2NrKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFZhbGlkYXRvcnMuZmluZChcbiAgICAgICAgICAgICAgICAgICAgICAgIHthZGRyZXNzOmJsb2NrLnByb3Bvc2VyQWRkcmVzc30sXG4gICAgICAgICAgICAgICAgICAgICAgICB7bGltaXQ6MX1cbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgXVxuICAgIH1cbn0pO1xuXG5wdWJsaXNoQ29tcG9zaXRlKCdibG9ja3MuZmluZE9uZScsIGZ1bmN0aW9uKGhlaWdodCl7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgZmluZCgpe1xuICAgICAgICAgICAgcmV0dXJuIEJsb2Nrc2Nvbi5maW5kKHtoZWlnaHQ6aGVpZ2h0fSlcbiAgICAgICAgfSxcbiAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBmaW5kKGJsb2NrKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFRyYW5zYWN0aW9ucy5maW5kKFxuICAgICAgICAgICAgICAgICAgICAgICAge2hlaWdodDpibG9jay5oZWlnaHR9XG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGZpbmQoYmxvY2spe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gVmFsaWRhdG9ycy5maW5kKFxuICAgICAgICAgICAgICAgICAgICAgICAge2FkZHJlc3M6YmxvY2sucHJvcG9zZXJBZGRyZXNzfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHtsaW1pdDoxfVxuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICBdXG4gICAgfVxufSk7XG4iLCJpbXBvcnQgeyBNb25nbyB9IGZyb20gJ21ldGVvci9tb25nbyc7XG5pbXBvcnQgeyBWYWxpZGF0b3JzIH0gZnJvbSAnLi4vdmFsaWRhdG9ycy92YWxpZGF0b3JzLmpzJztcblxuZXhwb3J0IGNvbnN0IEJsb2Nrc2NvbiA9IG5ldyBNb25nby5Db2xsZWN0aW9uICgnYmxvY2tzJyk7XG5cbkJsb2Nrc2Nvbi5oZWxwZXJzICh7XG4gICAgcHJvcG9zZXIgKCkge1xuICAgICAgICByZXR1cm4gVmFsaWRhdG9ycy5maW5kT25lICh7IGFkZHJlc3MgOiB0aGlzLnByb3Bvc2VyQWRkcmVzcyB9KTtcbiAgICB9LFxuICAgIHNvcnRlZCAobGltaXQpIHtcbiAgICAgICAgcmV0dXJuIEJsb2Nrc2Nvbi5maW5kICh7fSwgeyBzb3J0IDogeyBoZWlnaHQgOiAtMSB9LCBsaW1pdCA6IGxpbWl0IH0pO1xuICAgIH1cbn0pO1xuXG4vLyBCbG9ja3Njb24uaGVscGVycyh7XG4vLyAgICAgc29ydGVkKGxpbWl0KSB7XG4vLyAgICAgICAgIHJldHVybiBCbG9ja3Njb24uZmluZCh7fSwge3NvcnQ6IHtoZWlnaHQ6LTF9LCBsaW1pdDogbGltaXR9KTtcbi8vICAgICB9XG4vLyB9KTtcblxuXG4vLyBNZXRlb3Iuc2V0SW50ZXJ2YWwoZnVuY3Rpb24oKSB7XG4vLyAgICAgTWV0ZW9yLmNhbGwoJ2Jsb2Nrc1VwZGF0ZScsIChlcnJvciwgcmVzdWx0KSA9PiB7XG4vLyAgICAgICAgIGNvbnNvbGUubG9nKHJlc3VsdCk7XG4vLyAgICAgfSlcbi8vIH0sIDMwMDAwMDAwKTtcbiIsImltcG9ydCB7IE1ldGVvciB9IGZyb20gJ21ldGVvci9tZXRlb3InO1xuaW1wb3J0IHsgSFRUUCB9IGZyb20gJ21ldGVvci9odHRwJztcbmltcG9ydCB7IGdldEFkZHJlc3MgfSBmcm9tICd0ZW5kZXJtaW50L2xpYi9wdWJrZXkuanMnO1xuaW1wb3J0IHsgQ2hhaW4sIENoYWluU3RhdGVzIH0gZnJvbSAnLi4vY2hhaW4uanMnO1xuaW1wb3J0IHsgVmFsaWRhdG9ycyB9IGZyb20gJy4uLy4uL3ZhbGlkYXRvcnMvdmFsaWRhdG9ycy5qcyc7XG5pbXBvcnQgeyBWb3RpbmdQb3dlckhpc3RvcnkgfSBmcm9tICcuLi8uLi92b3RpbmctcG93ZXIvaGlzdG9yeS5qcyc7XG5pbXBvcnQgQ29pbiBmcm9tICcuLi8uLi8uLi8uLi9ib3RoL3V0aWxzL2NvaW5zLmpzJztcblxuZmluZFZvdGluZ1Bvd2VyID0gKHZhbGlkYXRvciwgZ2VuVmFsaWRhdG9ycykgPT4ge1xuICAgIGZvciAobGV0IHYgaW4gZ2VuVmFsaWRhdG9ycyl7XG4gICAgICAgIGlmICh2YWxpZGF0b3IucHViX2tleS52YWx1ZSA9PSBnZW5WYWxpZGF0b3JzW3ZdLnB1Yl9rZXkudmFsdWUpe1xuICAgICAgICAgICAgcmV0dXJuIHBhcnNlSW50KGdlblZhbGlkYXRvcnNbdl0ucG93ZXIpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5NZXRlb3IubWV0aG9kcyh7XG4gICAgJ2NoYWluLmdldENvbnNlbnN1c1N0YXRlJzogZnVuY3Rpb24oKXtcbiAgICAgICAgdGhpcy51bmJsb2NrKCk7XG4gICAgICAgIGxldCB1cmwgPSBSUEMrJy9kdW1wX2NvbnNlbnN1c19zdGF0ZSc7XG4gICAgICAgIHRyeXtcbiAgICAgICAgICAgIGxldCByZXNwb25zZSA9IEhUVFAuZ2V0KHVybCk7XG4gICAgICAgICAgICBsZXQgY29uc2Vuc3VzID0gSlNPTi5wYXJzZShyZXNwb25zZS5jb250ZW50KTtcbiAgICAgICAgICAgIGNvbnNlbnN1cyA9IGNvbnNlbnN1cy5yZXN1bHQ7XG4gICAgICAgICAgICBsZXQgaGVpZ2h0ID0gY29uc2Vuc3VzLnJvdW5kX3N0YXRlLmhlaWdodDtcbiAgICAgICAgICAgIGxldCByb3VuZCA9IGNvbnNlbnN1cy5yb3VuZF9zdGF0ZS5yb3VuZDtcbiAgICAgICAgICAgIGxldCBzdGVwID0gY29uc2Vuc3VzLnJvdW5kX3N0YXRlLnN0ZXA7XG4gICAgICAgICAgICBsZXQgdm90ZWRQb3dlciA9IE1hdGgucm91bmQocGFyc2VGbG9hdChjb25zZW5zdXMucm91bmRfc3RhdGUudm90ZXNbcm91bmRdLnByZXZvdGVzX2JpdF9hcnJheS5zcGxpdChcIiBcIilbM10pKjEwMCk7XG5cbiAgICAgICAgICAgIENoYWluLnVwZGF0ZSh7Y2hhaW5JZDpNZXRlb3Iuc2V0dGluZ3MucHVibGljLmNoYWluSWR9LCB7JHNldDp7XG4gICAgICAgICAgICAgICAgICAgIHZvdGluZ0hlaWdodDogaGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgICB2b3RpbmdSb3VuZDogcm91bmQsXG4gICAgICAgICAgICAgICAgICAgIHZvdGluZ1N0ZXA6IHN0ZXAsXG4gICAgICAgICAgICAgICAgICAgIHZvdGVkUG93ZXI6IHZvdGVkUG93ZXIsXG4gICAgICAgICAgICAgICAgICAgIHByb3Bvc2VyQWRkcmVzczogY29uc2Vuc3VzLnJvdW5kX3N0YXRlLnZhbGlkYXRvcnMucHJvcG9zZXIuYWRkcmVzcyxcbiAgICAgICAgICAgICAgICAgICAgcHJldm90ZXM6IGNvbnNlbnN1cy5yb3VuZF9zdGF0ZS52b3Rlc1tyb3VuZF0ucHJldm90ZXMsXG4gICAgICAgICAgICAgICAgICAgIHByZWNvbW1pdHM6IGNvbnNlbnN1cy5yb3VuZF9zdGF0ZS52b3Rlc1tyb3VuZF0ucHJlY29tbWl0c1xuICAgICAgICAgICAgICAgIH19KTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaChlKXtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKHVybCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhlKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgJ2NoYWluLnVwZGF0ZVN0YXR1cyc6IGZ1bmN0aW9uKCl7XG4gICAgICAgIHRoaXMudW5ibG9jaygpO1xuICAgICAgICBsZXQgdXJsID0gUlBDKycvc3RhdHVzJztcbiAgICAgICAgdHJ5e1xuICAgICAgICAgICAgbGV0IHJlc3BvbnNlID0gSFRUUC5nZXQodXJsKTtcbiAgICAgICAgICAgIGxldCBzdGF0dXMgPSBKU09OLnBhcnNlKHJlc3BvbnNlLmNvbnRlbnQpO1xuICAgICAgICAgICAgc3RhdHVzID0gc3RhdHVzLnJlc3VsdDtcbiAgICAgICAgICAgIGxldCBjaGFpbiA9IHt9O1xuICAgICAgICAgICAgY2hhaW4uY2hhaW5JZCA9IHN0YXR1cy5ub2RlX2luZm8ubmV0d29yaztcbiAgICAgICAgICAgIGNoYWluLmxhdGVzdEJsb2NrSGVpZ2h0ID0gc3RhdHVzLnN5bmNfaW5mby5sYXRlc3RfYmxvY2tfaGVpZ2h0O1xuICAgICAgICAgICAgY2hhaW4ubGF0ZXN0QmxvY2tUaW1lID0gc3RhdHVzLnN5bmNfaW5mby5sYXRlc3RfYmxvY2tfdGltZTtcblxuICAgICAgICAgICAgbGV0IGxhdGVzdFN0YXRlID0gQ2hhaW5TdGF0ZXMuZmluZE9uZSh7fSwge3NvcnQ6IHtoZWlnaHQ6IC0xfX0pXG4gICAgICAgICAgICBpZiAobGF0ZXN0U3RhdGUgJiYgbGF0ZXN0U3RhdGUuaGVpZ2h0ID49IGNoYWluLmxhdGVzdEJsb2NrSGVpZ2h0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGBubyB1cGRhdGVzIChnZXR0aW5nIGJsb2NrICR7Y2hhaW4ubGF0ZXN0QmxvY2tIZWlnaHR9IGF0IGJsb2NrICR7bGF0ZXN0U3RhdGUuaGVpZ2h0fSlgXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFNpbmNlIFRlbmRlcm1pbnQgdjAuMzMsIHZhbGlkYXRvciBwYWdlIGRlZmF1bHQgc2V0IHRvIHJldHVybiAzMCB2YWxpZGF0b3JzLlxuICAgICAgICAgICAgLy8gUXVlcnkgbGF0ZXN0IGhlaWdodCB3aXRoIHBhZ2UgMSBhbmQgMTAwIHZhbGlkYXRvcnMgcGVyIHBhZ2UuXG4gICAgICAgICAgICB1cmwgPSBSUEMrYC92YWxpZGF0b3JzP2hlaWdodD0ke2NoYWluLmxhdGVzdEJsb2NrSGVpZ2h0fSZwYWdlPTEmcGVyX3BhZ2U9MTAwYDtcbiAgICAgICAgICAgIHJlc3BvbnNlID0gSFRUUC5nZXQodXJsKTtcbiAgICAgICAgICAgIGxldCB2YWxpZGF0b3JzID0gSlNPTi5wYXJzZShyZXNwb25zZS5jb250ZW50KTtcbiAgICAgICAgICAgIHZhbGlkYXRvcnMgPSB2YWxpZGF0b3JzLnJlc3VsdC52YWxpZGF0b3JzO1xuICAgICAgICAgICAgY2hhaW4udmFsaWRhdG9ycyA9IHZhbGlkYXRvcnMubGVuZ3RoO1xuICAgICAgICAgICAgbGV0IGFjdGl2ZVZQID0gMDtcbiAgICAgICAgICAgIGZvciAodiBpbiB2YWxpZGF0b3JzKXtcbiAgICAgICAgICAgICAgICBhY3RpdmVWUCArPSBwYXJzZUludCh2YWxpZGF0b3JzW3ZdLnZvdGluZ19wb3dlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjaGFpbi5hY3RpdmVWb3RpbmdQb3dlciA9IGFjdGl2ZVZQO1xuXG5cbiAgICAgICAgICAgIENoYWluLnVwZGF0ZSh7Y2hhaW5JZDpjaGFpbi5jaGFpbklkfSwgeyRzZXQ6Y2hhaW59LCB7dXBzZXJ0OiB0cnVlfSk7XG4gICAgICAgICAgICAvLyBHZXQgY2hhaW4gc3RhdGVzXG4gICAgICAgICAgICBpZiAocGFyc2VJbnQoY2hhaW4ubGF0ZXN0QmxvY2tIZWlnaHQpID4gMCl7XG4gICAgICAgICAgICAgICAgbGV0IGNoYWluU3RhdGVzID0ge307XG4gICAgICAgICAgICAgICAgY2hhaW5TdGF0ZXMuaGVpZ2h0ID0gcGFyc2VJbnQoc3RhdHVzLnN5bmNfaW5mby5sYXRlc3RfYmxvY2tfaGVpZ2h0KTtcbiAgICAgICAgICAgICAgICBjaGFpblN0YXRlcy50aW1lID0gbmV3IERhdGUoc3RhdHVzLnN5bmNfaW5mby5sYXRlc3RfYmxvY2tfdGltZSk7XG5cbiAgICAgICAgICAgICAgICB1cmwgPSBMQ0QgKyAnL3N0YWtpbmcvcG9vbCc7XG4gICAgICAgICAgICAgICAgdHJ5e1xuICAgICAgICAgICAgICAgICAgICByZXNwb25zZSA9IEhUVFAuZ2V0KHVybCk7XG4gICAgICAgICAgICAgICAgICAgIGxldCBib25kaW5nID0gSlNPTi5wYXJzZShyZXNwb25zZS5jb250ZW50KS5yZXN1bHQ7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNoYWluLmJvbmRlZFRva2VucyA9IGJvbmRpbmcuYm9uZGVkX3Rva2VucztcbiAgICAgICAgICAgICAgICAgICAgLy8gY2hhaW4ubm90Qm9uZGVkVG9rZW5zID0gYm9uZGluZy5ub3RfYm9uZGVkX3Rva2VucztcbiAgICAgICAgICAgICAgICAgICAgY2hhaW5TdGF0ZXMuYm9uZGVkVG9rZW5zID0gcGFyc2VJbnQoYm9uZGluZy5ib25kZWRfdG9rZW5zKTtcbiAgICAgICAgICAgICAgICAgICAgY2hhaW5TdGF0ZXMubm90Qm9uZGVkVG9rZW5zID0gcGFyc2VJbnQoYm9uZGluZy5ub3RfYm9uZGVkX3Rva2Vucyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGUpe1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyh1cmwpO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIENvaW4uU3Rha2luZ0NvaW4uZGVub20gKSB7XG4gICAgICAgICAgICAgICAgICAgIHVybCA9IExDRCArICcvc3VwcGx5L3RvdGFsLycrIENvaW4uU3Rha2luZ0NvaW4uZGVub207XG4gICAgICAgICAgICAgICAgICAgIHRyeXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlID0gSFRUUC5nZXQodXJsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBzdXBwbHkgPSBKU09OLnBhcnNlKHJlc3BvbnNlLmNvbnRlbnQpLnJlc3VsdDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoYWluU3RhdGVzLnRvdGFsU3VwcGx5ID0gcGFyc2VJbnQoc3VwcGx5KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjYXRjaChlKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHVybCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHVybCA9IExDRCArICcvZGlzdHJpYnV0aW9uL2NvbW11bml0eV9wb29sJztcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlID0gSFRUUC5nZXQodXJsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBwb29sID0gSlNPTi5wYXJzZShyZXNwb25zZS5jb250ZW50KS5yZXN1bHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocG9vbCAmJiBwb29sLmxlbmd0aCA+IDApe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoYWluU3RhdGVzLmNvbW11bml0eVBvb2wgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb29sLmZvckVhY2goKGFtb3VudCwgaSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaGFpblN0YXRlcy5jb21tdW5pdHlQb29sLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVub206IGFtb3VudC5kZW5vbSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFtb3VudDogcGFyc2VGbG9hdChhbW91bnQuYW1vdW50KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGUpe1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2codXJsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGUpXG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB1cmwgPSBMQ0QgKyAnL21pbnRpbmcvaW5mbGF0aW9uJztcbiAgICAgICAgICAgICAgICAgICAgdHJ5e1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2UgPSBIVFRQLmdldCh1cmwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGluZmxhdGlvbiA9IEpTT04ucGFyc2UocmVzcG9uc2UuY29udGVudCkucmVzdWx0O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGluZmxhdGlvbil7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hhaW5TdGF0ZXMuaW5mbGF0aW9uID0gcGFyc2VGbG9hdChpbmZsYXRpb24pXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY2F0Y2goZSl7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyh1cmwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB1cmwgPSBMQ0QgKyAnL21pbnRpbmcvYW5udWFsLXByb3Zpc2lvbnMnO1xuICAgICAgICAgICAgICAgICAgICB0cnl7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXNwb25zZSA9IEhUVFAuZ2V0KHVybCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgcHJvdmlzaW9ucyA9IEpTT04ucGFyc2UocmVzcG9uc2UuY29udGVudCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocHJvdmlzaW9ucyl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hhaW5TdGF0ZXMuYW5udWFsUHJvdmlzaW9ucyA9IHBhcnNlRmxvYXQocHJvdmlzaW9ucy5yZXN1bHQpXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY2F0Y2goZSl7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyh1cmwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBDaGFpblN0YXRlcy5pbnNlcnQoY2hhaW5TdGF0ZXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBjaGFpbi50b3RhbFZvdGluZ1Bvd2VyID0gdG90YWxWUDtcblxuICAgICAgICAgICAgLy8gdmFsaWRhdG9ycyA9IFZhbGlkYXRvcnMuZmluZCh7fSkuZmV0Y2goKTtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKHZhbGlkYXRvcnMpO1xuICAgICAgICAgICAgcmV0dXJuIGNoYWluLmxhdGVzdEJsb2NrSGVpZ2h0O1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlKXtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKHVybCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhlKTtcbiAgICAgICAgICAgIHJldHVybiBcIkVycm9yIGdldHRpbmcgY2hhaW4gc3RhdHVzLlwiO1xuICAgICAgICB9XG4gICAgfSxcbiAgICAnY2hhaW4uZ2V0TGF0ZXN0U3RhdHVzJzogZnVuY3Rpb24oKXtcbiAgICAgICAgQ2hhaW4uZmluZCgpLnNvcnQoe2NyZWF0ZWQ6LTF9KS5saW1pdCgxKTtcbiAgICB9LFxuICAgICdjaGFpbi5nZW5lc2lzJzogZnVuY3Rpb24oKXtcbiAgICAgICAgbGV0IGNoYWluID0gQ2hhaW4uZmluZE9uZSh7Y2hhaW5JZDogTWV0ZW9yLnNldHRpbmdzLnB1YmxpYy5jaGFpbklkfSk7XG5cbiAgICAgICAgaWYgKGNoYWluICYmIGNoYWluLnJlYWRHZW5lc2lzKXtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdHZW5lc2lzIGZpbGUgaGFzIGJlZW4gcHJvY2Vzc2VkJyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoTWV0ZW9yLnNldHRpbmdzLmRlYnVnLnJlYWRHZW5lc2lzKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnPT09IFN0YXJ0IHByb2Nlc3NpbmcgZ2VuZXNpcyBmaWxlID09PScpO1xuICAgICAgICAgICAgbGV0IHJlc3BvbnNlID0gSFRUUC5nZXQoTWV0ZW9yLnNldHRpbmdzLmdlbmVzaXNGaWxlKTtcbiAgICAgICAgICAgIGxldCBnZW5lc2lzID0gSlNPTi5wYXJzZShyZXNwb25zZS5jb250ZW50KTtcbiAgICAgICAgICAgIGxldCBkaXN0ciA9IGdlbmVzaXMuYXBwX3N0YXRlLmRpc3RyIHx8IGdlbmVzaXMuYXBwX3N0YXRlLmRpc3RyaWJ1dGlvblxuICAgICAgICAgICAgbGV0IGNoYWluUGFyYW1zID0ge1xuICAgICAgICAgICAgICAgIGNoYWluSWQ6IGdlbmVzaXMuY2hhaW5faWQsXG4gICAgICAgICAgICAgICAgZ2VuZXNpc1RpbWU6IGdlbmVzaXMuZ2VuZXNpc190aW1lLFxuICAgICAgICAgICAgICAgIGNvbnNlbnN1c1BhcmFtczogZ2VuZXNpcy5jb25zZW5zdXNfcGFyYW1zLFxuICAgICAgICAgICAgICAgIGF1dGg6IGdlbmVzaXMuYXBwX3N0YXRlLmF1dGgsXG4gICAgICAgICAgICAgICAgYmFuazogZ2VuZXNpcy5hcHBfc3RhdGUuYmFuayxcbiAgICAgICAgICAgICAgICBzdGFraW5nOiB7XG4gICAgICAgICAgICAgICAgICAgIHBvb2w6IGdlbmVzaXMuYXBwX3N0YXRlLnN0YWtpbmcucG9vbCxcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zOiBnZW5lc2lzLmFwcF9zdGF0ZS5zdGFraW5nLnBhcmFtc1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgbWludDogZ2VuZXNpcy5hcHBfc3RhdGUubWludCxcbiAgICAgICAgICAgICAgICBkaXN0cjoge1xuICAgICAgICAgICAgICAgICAgICBjb21tdW5pdHlUYXg6IGRpc3RyLmNvbW11bml0eV90YXgsXG4gICAgICAgICAgICAgICAgICAgIGJhc2VQcm9wb3NlclJld2FyZDogZGlzdHIuYmFzZV9wcm9wb3Nlcl9yZXdhcmQsXG4gICAgICAgICAgICAgICAgICAgIGJvbnVzUHJvcG9zZXJSZXdhcmQ6IGRpc3RyLmJvbnVzX3Byb3Bvc2VyX3Jld2FyZCxcbiAgICAgICAgICAgICAgICAgICAgd2l0aGRyYXdBZGRyRW5hYmxlZDogZGlzdHIud2l0aGRyYXdfYWRkcl9lbmFibGVkXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBnb3Y6IHtcbiAgICAgICAgICAgICAgICAgICAgc3RhcnRpbmdQcm9wb3NhbElkOiAwLFxuICAgICAgICAgICAgICAgICAgICBkZXBvc2l0UGFyYW1zOiB7fSxcbiAgICAgICAgICAgICAgICAgICAgdm90aW5nUGFyYW1zOiB7fSxcbiAgICAgICAgICAgICAgICAgICAgdGFsbHlQYXJhbXM6IHt9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBzbGFzaGluZzp7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtczogZ2VuZXNpcy5hcHBfc3RhdGUuc2xhc2hpbmcucGFyYW1zXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBzdXBwbHk6IGdlbmVzaXMuYXBwX3N0YXRlLnN1cHBseSxcbiAgICAgICAgICAgICAgICBjcmlzaXM6IGdlbmVzaXMuYXBwX3N0YXRlLmNyaXNpc1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZ2VuZXNpcy5hcHBfc3RhdGUuZ292KSB7XG4gICAgICAgICAgICAgICAgY2hhaW5QYXJhbXMuZ292ID0ge1xuICAgICAgICAgICAgICAgICAgICBzdGFydGluZ1Byb3Bvc2FsSWQ6IGdlbmVzaXMuYXBwX3N0YXRlLmdvdi5zdGFydGluZ19wcm9wb3NhbF9pZCxcbiAgICAgICAgICAgICAgICAgICAgZGVwb3NpdFBhcmFtczogZ2VuZXNpcy5hcHBfc3RhdGUuZ292LmRlcG9zaXRfcGFyYW1zLFxuICAgICAgICAgICAgICAgICAgICB2b3RpbmdQYXJhbXM6IGdlbmVzaXMuYXBwX3N0YXRlLmdvdi52b3RpbmdfcGFyYW1zLFxuICAgICAgICAgICAgICAgICAgICB0YWxseVBhcmFtczogZ2VuZXNpcy5hcHBfc3RhdGUuZ292LnRhbGx5X3BhcmFtc1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgdG90YWxWb3RpbmdQb3dlciA9IDA7XG5cbiAgICAgICAgICAgIC8vIHJlYWQgZ2VudHhcbiAgICAgICAgICAgIGlmIChnZW5lc2lzLmFwcF9zdGF0ZS5nZW51dGlsICYmIGdlbmVzaXMuYXBwX3N0YXRlLmdlbnV0aWwuZ2VudHhzICYmIChnZW5lc2lzLmFwcF9zdGF0ZS5nZW51dGlsLmdlbnR4cy5sZW5ndGggPiAwKSl7XG4gICAgICAgICAgICAgICAgZm9yIChpIGluIGdlbmVzaXMuYXBwX3N0YXRlLmdlbnV0aWwuZ2VudHhzKXtcbiAgICAgICAgICAgICAgICAgICAgbGV0IG1zZyA9IGdlbmVzaXMuYXBwX3N0YXRlLmdlbnV0aWwuZ2VudHhzW2ldLnZhbHVlLm1zZztcbiAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2cobXNnLnR5cGUpO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKG0gaW4gbXNnKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChtc2dbbV0udHlwZSA9PSBcImNvc21vcy1zZGsvTXNnQ3JlYXRlVmFsaWRhdG9yXCIpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKG1zZ1ttXS52YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbGV0IGNvbW1hbmQgPSBNZXRlb3Iuc2V0dGluZ3MuYmluLmdhaWFkZWJ1ZytcIiBwdWJrZXkgXCIrbXNnW21dLnZhbHVlLnB1YmtleTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgdmFsaWRhdG9yID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zZW5zdXNfcHVia2V5OiBtc2dbbV0udmFsdWUucHVia2V5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogbXNnW21dLnZhbHVlLmRlc2NyaXB0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21taXNzaW9uOiBtc2dbbV0udmFsdWUuY29tbWlzc2lvbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWluX3NlbGZfZGVsZWdhdGlvbjogbXNnW21dLnZhbHVlLm1pbl9zZWxmX2RlbGVnYXRpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wZXJhdG9yX2FkZHJlc3M6IG1zZ1ttXS52YWx1ZS52YWxpZGF0b3JfYWRkcmVzcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVsZWdhdG9yX2FkZHJlc3M6IG1zZ1ttXS52YWx1ZS5kZWxlZ2F0b3JfYWRkcmVzcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdm90aW5nX3Bvd2VyOiBNYXRoLmZsb29yKHBhcnNlSW50KG1zZ1ttXS52YWx1ZS52YWx1ZS5hbW91bnQpIC8gQ29pbi5TdGFraW5nQ29pbi5mcmFjdGlvbiksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGphaWxlZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1czogMlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvdGFsVm90aW5nUG93ZXIgKz0gdmFsaWRhdG9yLnZvdGluZ19wb3dlcjtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBwdWJrZXlWYWx1ZSA9IE1ldGVvci5jYWxsKCdiZWNoMzJUb1B1YmtleScsIG1zZ1ttXS52YWx1ZS5wdWJrZXkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFZhbGlkYXRvcnMudXBzZXJ0KHtjb25zZW5zdXNfcHVia2V5Om1zZ1ttXS52YWx1ZS5wdWJrZXl9LHZhbGlkYXRvcik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3IucHViX2tleSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJ0eXBlXCI6XCJ0ZW5kZXJtaW50L1B1YktleUVkMjU1MTlcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJ2YWx1ZVwiOnB1YmtleVZhbHVlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdG9yLmFkZHJlc3MgPSBnZXRBZGRyZXNzKHZhbGlkYXRvci5wdWJfa2V5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3IuYWNjcHViID0gTWV0ZW9yLmNhbGwoJ3B1YmtleVRvQmVjaDMyJywgdmFsaWRhdG9yLnB1Yl9rZXksIE1ldGVvci5zZXR0aW5ncy5wdWJsaWMuYmVjaDMyUHJlZml4QWNjUHViKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3Iub3BlcmF0b3JfcHVia2V5ID0gTWV0ZW9yLmNhbGwoJ3B1YmtleVRvQmVjaDMyJywgdmFsaWRhdG9yLnB1Yl9rZXksIE1ldGVvci5zZXR0aW5ncy5wdWJsaWMuYmVjaDMyUHJlZml4VmFsUHViKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBWb3RpbmdQb3dlckhpc3RvcnkuaW5zZXJ0KHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkcmVzczogdmFsaWRhdG9yLmFkZHJlc3MsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZXZfdm90aW5nX3Bvd2VyOiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2b3RpbmdfcG93ZXI6IHZhbGlkYXRvci52b3RpbmdfcG93ZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdhZGQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZWlnaHQ6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJsb2NrX3RpbWU6IGdlbmVzaXMuZ2VuZXNpc190aW1lXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBWYWxpZGF0b3JzLmluc2VydCh2YWxpZGF0b3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyByZWFkIHZhbGlkYXRvcnMgZnJvbSBwcmV2aW91cyBjaGFpblxuICAgICAgICAgICAgY29uc29sZS5sb2coJ3JlYWQgdmFsaWRhdG9ycyBmcm9tIHByZXZpb3VzIGNoYWluJyk7XG4gICAgICAgICAgICBpZiAoZ2VuZXNpcy5hcHBfc3RhdGUuc3Rha2luZy52YWxpZGF0b3JzICYmIGdlbmVzaXMuYXBwX3N0YXRlLnN0YWtpbmcudmFsaWRhdG9ycy5sZW5ndGggPiAwKXtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhnZW5lc2lzLmFwcF9zdGF0ZS5zdGFraW5nLnZhbGlkYXRvcnMubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICBsZXQgZ2VuVmFsaWRhdG9yc1NldCA9IGdlbmVzaXMuYXBwX3N0YXRlLnN0YWtpbmcudmFsaWRhdG9ycztcbiAgICAgICAgICAgICAgICBsZXQgZ2VuVmFsaWRhdG9ycyA9IGdlbmVzaXMudmFsaWRhdG9ycztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCB2IGluIGdlblZhbGlkYXRvcnNTZXQpe1xuICAgICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhnZW5WYWxpZGF0b3JzW3ZdKTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHZhbGlkYXRvciA9IGdlblZhbGlkYXRvcnNTZXRbdl07XG4gICAgICAgICAgICAgICAgICAgIHZhbGlkYXRvci5kZWxlZ2F0b3JfYWRkcmVzcyA9IE1ldGVvci5jYWxsKCdnZXREZWxlZ2F0b3InLCBnZW5WYWxpZGF0b3JzU2V0W3ZdLm9wZXJhdG9yX2FkZHJlc3MpO1xuXG4gICAgICAgICAgICAgICAgICAgIGxldCBwdWJrZXlWYWx1ZSA9IE1ldGVvci5jYWxsKCdiZWNoMzJUb1B1YmtleScsIHZhbGlkYXRvci5jb25zZW5zdXNfcHVia2V5KTtcblxuICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3IucHViX2tleSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOlwidGVuZGVybWludC9QdWJLZXlFZDI1NTE5XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBcInZhbHVlXCI6cHVia2V5VmFsdWVcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHZhbGlkYXRvci5hZGRyZXNzID0gZ2V0QWRkcmVzcyh2YWxpZGF0b3IucHViX2tleSk7XG4gICAgICAgICAgICAgICAgICAgIHZhbGlkYXRvci5wdWJfa2V5ID0gdmFsaWRhdG9yLnB1Yl9rZXk7XG4gICAgICAgICAgICAgICAgICAgIHZhbGlkYXRvci5hY2NwdWIgPSBNZXRlb3IuY2FsbCgncHVia2V5VG9CZWNoMzInLCB2YWxpZGF0b3IucHViX2tleSwgTWV0ZW9yLnNldHRpbmdzLnB1YmxpYy5iZWNoMzJQcmVmaXhBY2NQdWIpO1xuICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3Iub3BlcmF0b3JfcHVia2V5ID0gTWV0ZW9yLmNhbGwoJ3B1YmtleVRvQmVjaDMyJywgdmFsaWRhdG9yLnB1Yl9rZXksIE1ldGVvci5zZXR0aW5ncy5wdWJsaWMuYmVjaDMyUHJlZml4VmFsUHViKTtcblxuICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3Iudm90aW5nX3Bvd2VyID0gZmluZFZvdGluZ1Bvd2VyKHZhbGlkYXRvciwgZ2VuVmFsaWRhdG9ycyk7XG4gICAgICAgICAgICAgICAgICAgIHRvdGFsVm90aW5nUG93ZXIgKz0gdmFsaWRhdG9yLnZvdGluZ19wb3dlcjtcblxuICAgICAgICAgICAgICAgICAgICBWYWxpZGF0b3JzLnVwc2VydCh7Y29uc2Vuc3VzX3B1YmtleTp2YWxpZGF0b3IuY29uc2Vuc3VzX3B1YmtleX0sdmFsaWRhdG9yKTtcbiAgICAgICAgICAgICAgICAgICAgVm90aW5nUG93ZXJIaXN0b3J5Lmluc2VydCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBhZGRyZXNzOiB2YWxpZGF0b3IuYWRkcmVzcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZXZfdm90aW5nX3Bvd2VyOiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgdm90aW5nX3Bvd2VyOiB2YWxpZGF0b3Iudm90aW5nX3Bvd2VyLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2FkZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBoZWlnaHQ6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICBibG9ja190aW1lOiBnZW5lc2lzLmdlbmVzaXNfdGltZVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNoYWluUGFyYW1zLnJlYWRHZW5lc2lzID0gdHJ1ZTtcbiAgICAgICAgICAgIGNoYWluUGFyYW1zLmFjdGl2ZVZvdGluZ1Bvd2VyID0gdG90YWxWb3RpbmdQb3dlcjtcbiAgICAgICAgICAgIGxldCByZXN1bHQgPSBDaGFpbi51cHNlcnQoe2NoYWluSWQ6Y2hhaW5QYXJhbXMuY2hhaW5JZH0sIHskc2V0OmNoYWluUGFyYW1zfSk7XG5cblxuICAgICAgICAgICAgY29uc29sZS5sb2coJz09PSBGaW5pc2hlZCBwcm9jZXNzaW5nIGdlbmVzaXMgZmlsZSA9PT0nKTtcblxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxufSlcbiIsImltcG9ydCB7IE1ldGVvciB9IGZyb20gJ21ldGVvci9tZXRlb3InO1xuaW1wb3J0IHsgQ2hhaW4sIENoYWluU3RhdGVzIH0gZnJvbSAnLi4vY2hhaW4uanMnO1xuaW1wb3J0IHsgQ29pblN0YXRzIH0gZnJvbSAnLi4vLi4vY29pbi1zdGF0cy9jb2luLXN0YXRzLmpzJztcbmltcG9ydCB7IFZhbGlkYXRvcnMgfSBmcm9tICcuLi8uLi92YWxpZGF0b3JzL3ZhbGlkYXRvcnMuanMnO1xuXG5NZXRlb3IucHVibGlzaCgnY2hhaW5TdGF0ZXMubGF0ZXN0JywgZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBbXG4gICAgICAgIENoYWluU3RhdGVzLmZpbmQoe30se3NvcnQ6e2hlaWdodDotMX0sbGltaXQ6MX0pLFxuICAgICAgICBDb2luU3RhdHMuZmluZCh7fSx7c29ydDp7bGFzdF91cGRhdGVkX2F0Oi0xfSxsaW1pdDoxfSlcbiAgICBdO1xufSk7XG5cbnB1Ymxpc2hDb21wb3NpdGUoJ2NoYWluLnN0YXR1cycsIGZ1bmN0aW9uKCl7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgZmluZCgpe1xuICAgICAgICAgICAgcmV0dXJuIENoYWluLmZpbmQoe2NoYWluSWQ6TWV0ZW9yLnNldHRpbmdzLnB1YmxpYy5jaGFpbklkfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZmluZChjaGFpbil7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBWYWxpZGF0b3JzLmZpbmQoXG4gICAgICAgICAgICAgICAgICAgICAgICB7fSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHtmaWVsZHM6e1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZHJlc3M6MSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjoxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wZXJhdG9yX2FkZHJlc3M6MSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXM6LTEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgamFpbGVkOjEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvZmlsZV91cmw6MVxuICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgXVxuICAgIH1cbn0pOyIsImltcG9ydCB7IE1vbmdvIH0gZnJvbSAnbWV0ZW9yL21vbmdvJztcbmltcG9ydCB7IFZhbGlkYXRvcnMgfSBmcm9tICcuLi92YWxpZGF0b3JzL3ZhbGlkYXRvcnMuanMnO1xuXG5leHBvcnQgY29uc3QgQ2hhaW4gPSBuZXcgTW9uZ28uQ29sbGVjdGlvbignY2hhaW4nKTtcbmV4cG9ydCBjb25zdCBDaGFpblN0YXRlcyA9IG5ldyBNb25nby5Db2xsZWN0aW9uKCdjaGFpbl9zdGF0ZXMnKVxuXG5DaGFpbi5oZWxwZXJzKHtcbiAgICBwcm9wb3Nlcigpe1xuICAgICAgICByZXR1cm4gVmFsaWRhdG9ycy5maW5kT25lKHthZGRyZXNzOnRoaXMucHJvcG9zZXJBZGRyZXNzfSk7XG4gICAgfVxufSkiLCJpbXBvcnQgeyBNZXRlb3IgfSBmcm9tICdtZXRlb3IvbWV0ZW9yJztcbmltcG9ydCB7IENvaW5TdGF0cyB9IGZyb20gJy4uL2NvaW4tc3RhdHMuanMnO1xuaW1wb3J0IHsgSFRUUCB9IGZyb20gJ21ldGVvci9odHRwJztcblxuTWV0ZW9yLm1ldGhvZHMoe1xuICAgICdjb2luU3RhdHMuZ2V0Q29pblN0YXRzJzogZnVuY3Rpb24oKXtcbiAgICAgICAgdGhpcy51bmJsb2NrKCk7XG4gICAgICAgIGxldCBjb2luSWQgPSBNZXRlb3Iuc2V0dGluZ3MucHVibGljLmNvaW5nZWNrb0lkO1xuICAgICAgICBpZiAoY29pbklkKXtcbiAgICAgICAgICAgIHRyeXtcbiAgICAgICAgICAgICAgICBsZXQgbm93ID0gbmV3IERhdGUoKTtcbiAgICAgICAgICAgICAgICBub3cuc2V0TWludXRlcygwKTtcbiAgICAgICAgICAgICAgICBsZXQgdXJsID0gXCJodHRwczovL2FwaS5jb2luZ2Vja28uY29tL2FwaS92My9zaW1wbGUvcHJpY2U/aWRzPVwiK2NvaW5JZCtcIiZ2c19jdXJyZW5jaWVzPXVzZCZpbmNsdWRlX21hcmtldF9jYXA9dHJ1ZSZpbmNsdWRlXzI0aHJfdm9sPXRydWUmaW5jbHVkZV8yNGhyX2NoYW5nZT10cnVlJmluY2x1ZGVfbGFzdF91cGRhdGVkX2F0PXRydWVcIjtcbiAgICAgICAgICAgICAgICBsZXQgcmVzcG9uc2UgPSBIVFRQLmdldCh1cmwpO1xuICAgICAgICAgICAgICAgIGlmIChyZXNwb25zZS5zdGF0dXNDb2RlID09IDIwMCl7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKEpTT04ucGFyc2UocmVzcG9uc2UuY29udGVudCkpO1xuICAgICAgICAgICAgICAgICAgICBsZXQgZGF0YSA9IEpTT04ucGFyc2UocmVzcG9uc2UuY29udGVudCk7XG4gICAgICAgICAgICAgICAgICAgIGRhdGEgPSBkYXRhW2NvaW5JZF07XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGNvaW5TdGF0cyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBDb2luU3RhdHMudXBzZXJ0KHtsYXN0X3VwZGF0ZWRfYXQ6ZGF0YS5sYXN0X3VwZGF0ZWRfYXR9LCB7JHNldDpkYXRhfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZSl7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2codXJsKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNle1xuICAgICAgICAgICAgcmV0dXJuIFwiTm8gY29pbmdlY2tvIElkIHByb3ZpZGVkLlwiXG4gICAgICAgIH1cbiAgICB9LFxuICAgICdjb2luU3RhdHMuZ2V0U3RhdHMnOiBmdW5jdGlvbigpe1xuICAgICAgICB0aGlzLnVuYmxvY2soKTtcbiAgICAgICAgbGV0IGNvaW5JZCA9IE1ldGVvci5zZXR0aW5ncy5wdWJsaWMuY29pbmdlY2tvSWQ7XG4gICAgICAgIGlmIChjb2luSWQpe1xuICAgICAgICAgICAgcmV0dXJuIChDb2luU3RhdHMuZmluZE9uZSh7fSx7c29ydDp7bGFzdF91cGRhdGVkX2F0Oi0xfX0pKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNle1xuICAgICAgICAgICAgcmV0dXJuIFwiTm8gY29pbmdlY2tvIElkIHByb3ZpZGVkLlwiO1xuICAgICAgICB9XG5cbiAgICB9XG59KVxuIiwiaW1wb3J0IHsgTW9uZ28gfSBmcm9tICdtZXRlb3IvbW9uZ28nO1xuXG5leHBvcnQgY29uc3QgQ29pblN0YXRzID0gbmV3IE1vbmdvLkNvbGxlY3Rpb24oJ2NvaW5fc3RhdHMnKTtcbiIsImltcG9ydCB7IE1ldGVvciB9IGZyb20gJ21ldGVvci9tZXRlb3InO1xuaW1wb3J0IHsgRGVsZWdhdGlvbnMgfSBmcm9tICcuLi9kZWxlZ2F0aW9ucy5qcyc7XG5pbXBvcnQgeyBWYWxpZGF0b3JzIH0gZnJvbSAnLi4vLi4vdmFsaWRhdG9ycy92YWxpZGF0b3JzLmpzJztcblxuTWV0ZW9yLm1ldGhvZHMoe1xuICAgICdkZWxlZ2F0aW9ucy5nZXREZWxlZ2F0aW9ucyc6IGZ1bmN0aW9uKCl7XG4gICAgICAgIHRoaXMudW5ibG9jaygpO1xuICAgICAgICBsZXQgdmFsaWRhdG9ycyA9IFZhbGlkYXRvcnMuZmluZCh7fSkuZmV0Y2goKTtcbiAgICAgICAgbGV0IGRlbGVnYXRpb25zID0gW107XG4gICAgICAgIGNvbnNvbGUubG9nKFwiPT09IEdldHRpbmcgZGVsZWdhdGlvbnMgPT09XCIpO1xuICAgICAgICBmb3IgKHYgaW4gdmFsaWRhdG9ycyl7XG4gICAgICAgICAgICBpZiAodmFsaWRhdG9yc1t2XS5vcGVyYXRvcl9hZGRyZXNzKXtcbiAgICAgICAgICAgICAgICBsZXQgdXJsID0gTENEICsgJy9zdGFraW5nL3ZhbGlkYXRvcnMvJyt2YWxpZGF0b3JzW3ZdLm9wZXJhdG9yX2FkZHJlc3MrXCIvZGVsZWdhdGlvbnNcIjtcbiAgICAgICAgICAgICAgICB0cnl7XG4gICAgICAgICAgICAgICAgICAgIGxldCByZXNwb25zZSA9IEhUVFAuZ2V0KHVybCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXNwb25zZS5zdGF0dXNDb2RlID09IDIwMCl7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZGVsZWdhdGlvbiA9IEpTT04ucGFyc2UocmVzcG9uc2UuY29udGVudCkucmVzdWx0O1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coZGVsZWdhdGlvbik7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWxlZ2F0aW9ucyA9IGRlbGVnYXRpb25zLmNvbmNhdChkZWxlZ2F0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNle1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2cocmVzcG9uc2Uuc3RhdHVzQ29kZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGUpe1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyh1cmwpO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGkgaW4gZGVsZWdhdGlvbnMpe1xuICAgICAgICAgICAgaWYgKGRlbGVnYXRpb25zW2ldICYmIGRlbGVnYXRpb25zW2ldLnNoYXJlcylcbiAgICAgICAgICAgICAgICBkZWxlZ2F0aW9uc1tpXS5zaGFyZXMgPSBwYXJzZUZsb2F0KGRlbGVnYXRpb25zW2ldLnNoYXJlcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjb25zb2xlLmxvZyhkZWxlZ2F0aW9ucyk7XG4gICAgICAgIGxldCBkYXRhID0ge1xuICAgICAgICAgICAgZGVsZWdhdGlvbnM6IGRlbGVnYXRpb25zLFxuICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLFxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIERlbGVnYXRpb25zLmluc2VydChkYXRhKTtcbiAgICB9XG59KVxuIiwiaW1wb3J0IHsgTW9uZ28gfSBmcm9tICdtZXRlb3IvbW9uZ28nO1xuXG5leHBvcnQgY29uc3QgRGVsZWdhdGlvbnMgPSBuZXcgTW9uZ28uQ29sbGVjdGlvbignZGVsZWdhdGlvbnMnKTtcbiIsImltcG9ydCB7IEhUVFAgfSBmcm9tICdtZXRlb3IvaHR0cCc7XG5cbk1ldGVvci5tZXRob2RzKHtcbiAgICAndHJhbnNhY3Rpb24uc3VibWl0JzogZnVuY3Rpb24odHhJbmZvKSB7XG4gICAgICAgIGNvbnN0IHVybCA9IGAke0xDRH0vdHhzYDtcbiAgICAgICAgZGF0YSA9IHtcbiAgICAgICAgICAgIFwidHhcIjogdHhJbmZvLnZhbHVlLFxuICAgICAgICAgICAgXCJtb2RlXCI6IFwic3luY1wiXG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdGltZXN0YW1wID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGBzdWJtaXR0aW5nIHRyYW5zYWN0aW9uJHt0aW1lc3RhbXB9ICR7dXJsfSB3aXRoIGRhdGEgJHtKU09OLnN0cmluZ2lmeShkYXRhKX1gKVxuXG4gICAgICAgIGxldCByZXNwb25zZSA9IEhUVFAucG9zdCh1cmwsIHtkYXRhfSk7XG4gICAgICAgIGNvbnNvbGUubG9nKGByZXNwb25zZSBmb3IgdHJhbnNhY3Rpb24ke3RpbWVzdGFtcH0gJHt1cmx9OiAke0pTT04uc3RyaW5naWZ5KHJlc3BvbnNlKX1gKVxuICAgICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PSAyMDApIHtcbiAgICAgICAgICAgIGxldCBkYXRhID0gcmVzcG9uc2UuZGF0YVxuICAgICAgICAgICAgaWYgKGRhdGEuY29kZSlcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKGRhdGEuY29kZSwgSlNPTi5wYXJzZShkYXRhLnJhd19sb2cpLm1lc3NhZ2UpXG4gICAgICAgICAgICByZXR1cm4gcmVzcG9uc2UuZGF0YS50eGhhc2g7XG4gICAgICAgIH1cbiAgICB9LFxuICAgICd0cmFuc2FjdGlvbi5leGVjdXRlJzogZnVuY3Rpb24oYm9keSwgcGF0aCkge1xuICAgICAgICBjb25zdCB1cmwgPSBgJHtMQ0R9LyR7cGF0aH1gO1xuICAgICAgICBkYXRhID0ge1xuICAgICAgICAgICAgXCJiYXNlX3JlcVwiOiB7XG4gICAgICAgICAgICAgICAgLi4uYm9keSxcbiAgICAgICAgICAgICAgICBcImNoYWluX2lkXCI6IE1ldGVvci5zZXR0aW5ncy5wdWJsaWMuY2hhaW5JZCxcbiAgICAgICAgICAgICAgICBcInNpbXVsYXRlXCI6IGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIGxldCByZXNwb25zZSA9IEhUVFAucG9zdCh1cmwsIHtkYXRhfSk7XG4gICAgICAgIGlmIChyZXNwb25zZS5zdGF0dXNDb2RlID09IDIwMCkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UocmVzcG9uc2UuY29udGVudCk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgICd0cmFuc2FjdGlvbi5zaW11bGF0ZSc6IGZ1bmN0aW9uKHR4TXNnLCBmcm9tLCBwYXRoLCBhZGp1c3RtZW50PScxLjInKSB7XG4gICAgICAgIGNvbnN0IHVybCA9IGAke0xDRH0vJHtwYXRofWA7XG4gICAgICAgIGRhdGEgPSB7Li4udHhNc2csXG4gICAgICAgICAgICBcImJhc2VfcmVxXCI6IHtcbiAgICAgICAgICAgICAgICBcImZyb21cIjogZnJvbSxcbiAgICAgICAgICAgICAgICBcImNoYWluX2lkXCI6IE1ldGVvci5zZXR0aW5ncy5wdWJsaWMuY2hhaW5JZCxcbiAgICAgICAgICAgICAgICBcImdhc19hZGp1c3RtZW50XCI6IGFkanVzdG1lbnQsXG4gICAgICAgICAgICAgICAgXCJzaW11bGF0ZVwiOiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIGxldCByZXNwb25zZSA9IEhUVFAucG9zdCh1cmwsIHtkYXRhfSk7XG4gICAgICAgIGlmIChyZXNwb25zZS5zdGF0dXNDb2RlID09IDIwMCkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UocmVzcG9uc2UuY29udGVudCkuZ2FzX2VzdGltYXRlO1xuICAgICAgICB9XG4gICAgfSxcbn0pIiwiaW1wb3J0IHsgTWV0ZW9yIH0gZnJvbSAnbWV0ZW9yL21ldGVvcic7XG5pbXBvcnQgeyBIVFRQIH0gZnJvbSAnbWV0ZW9yL2h0dHAnO1xuaW1wb3J0IHsgUHJvcG9zYWxzIH0gZnJvbSAnLi4vcHJvcG9zYWxzLmpzJztcbmltcG9ydCB7IFZhbGlkYXRvcnMgfSBmcm9tICcuLi8uLi92YWxpZGF0b3JzL3ZhbGlkYXRvcnMuanMnO1xuLy8gaW1wb3J0IHsgUHJvbWlzZSB9IGZyb20gJ21ldGVvci9wcm9taXNlJztcblxuTWV0ZW9yLm1ldGhvZHMoe1xuICAgICdwcm9wb3NhbHMuZ2V0UHJvcG9zYWxzJzogZnVuY3Rpb24oKXtcbiAgICAgICAgdGhpcy51bmJsb2NrKCk7XG4gICAgICAgIHRyeXtcbiAgICAgICAgICAgIGxldCB1cmwgPSBMQ0QgKyAnL2dvdi9wcm9wb3NhbHMnO1xuICAgICAgICAgICAgbGV0IHJlc3BvbnNlID0gSFRUUC5nZXQodXJsKTtcbiAgICAgICAgICAgIGxldCBwcm9wb3NhbHMgPSBKU09OLnBhcnNlKHJlc3BvbnNlLmNvbnRlbnQpLnJlc3VsdDtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKHByb3Bvc2Fscyk7XG5cbiAgICAgICAgICAgIGxldCBmaW5pc2hlZFByb3Bvc2FsSWRzID0gbmV3IFNldChQcm9wb3NhbHMuZmluZChcbiAgICAgICAgICAgICAgICB7XCJwcm9wb3NhbF9zdGF0dXNcIjp7JGluOltcIlBhc3NlZFwiLCBcIlJlamVjdGVkXCIsIFwiUmVtb3ZlZFwiXX19XG4gICAgICAgICAgICApLmZldGNoKCkubWFwKChwKT0+IHAucHJvcG9zYWxJZCkpO1xuXG4gICAgICAgICAgICBsZXQgcHJvcG9zYWxJZHMgPSBbXTtcbiAgICAgICAgICAgIGlmIChwcm9wb3NhbHMubGVuZ3RoID4gMCl7XG4gICAgICAgICAgICAgICAgLy8gUHJvcG9zYWxzLnVwc2VydCgpXG4gICAgICAgICAgICAgICAgY29uc3QgYnVsa1Byb3Bvc2FscyA9IFByb3Bvc2Fscy5yYXdDb2xsZWN0aW9uKCkuaW5pdGlhbGl6ZVVub3JkZXJlZEJ1bGtPcCgpO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgaW4gcHJvcG9zYWxzKXtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHByb3Bvc2FsID0gcHJvcG9zYWxzW2ldO1xuICAgICAgICAgICAgICAgICAgICBwcm9wb3NhbC5wcm9wb3NhbElkID0gcGFyc2VJbnQocHJvcG9zYWwuaWQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocHJvcG9zYWwucHJvcG9zYWxJZCA+IDAgJiYgIWZpbmlzaGVkUHJvcG9zYWxJZHMuaGFzKHByb3Bvc2FsLnByb3Bvc2FsSWQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHVybCA9IExDRCArICcvZ292L3Byb3Bvc2Fscy8nK3Byb3Bvc2FsLnByb3Bvc2FsSWQrJy9wcm9wb3Nlcic7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHJlc3BvbnNlID0gSFRUUC5nZXQodXJsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PSAyMDApe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgcHJvcG9zZXIgPSBKU09OLnBhcnNlKHJlc3BvbnNlLmNvbnRlbnQpLnJlc3VsdDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByb3Bvc2VyLnByb3Bvc2FsX2lkICYmIChwcm9wb3Nlci5wcm9wb3NhbF9pZCA9PSBwcm9wb3NhbC5pZCkpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcG9zYWwucHJvcG9zZXIgPSBwcm9wb3Nlci5wcm9wb3NlcjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBidWxrUHJvcG9zYWxzLmZpbmQoe3Byb3Bvc2FsSWQ6IHByb3Bvc2FsLnByb3Bvc2FsSWR9KS51cHNlcnQoKS51cGRhdGVPbmUoeyRzZXQ6cHJvcG9zYWx9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wb3NhbElkcy5wdXNoKHByb3Bvc2FsLnByb3Bvc2FsSWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY2F0Y2goZSl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnVsa1Byb3Bvc2Fscy5maW5kKHtwcm9wb3NhbElkOiBwcm9wb3NhbC5wcm9wb3NhbElkfSkudXBzZXJ0KCkudXBkYXRlT25lKHskc2V0OnByb3Bvc2FsfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcG9zYWxJZHMucHVzaChwcm9wb3NhbC5wcm9wb3NhbElkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlLnJlc3BvbnNlLmNvbnRlbnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJ1bGtQcm9wb3NhbHMuZmluZCh7cHJvcG9zYWxJZDp7JG5pbjpwcm9wb3NhbElkc30sIHByb3Bvc2FsX3N0YXR1czp7JG5pbjpbXCJQYXNzZWRcIiwgXCJSZWplY3RlZFwiLCBcIlJlbW92ZWRcIl19fSlcbiAgICAgICAgICAgICAgICAgICAgLnVwZGF0ZSh7JHNldDoge1wicHJvcG9zYWxfc3RhdHVzXCI6IFwiUmVtb3ZlZFwifX0pO1xuICAgICAgICAgICAgICAgIGJ1bGtQcm9wb3NhbHMuZXhlY3V0ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZSl7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhlKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgJ3Byb3Bvc2Fscy5nZXRQcm9wb3NhbFJlc3VsdHMnOiBmdW5jdGlvbigpe1xuICAgICAgICB0aGlzLnVuYmxvY2soKTtcbiAgICAgICAgbGV0IHByb3Bvc2FscyA9IFByb3Bvc2Fscy5maW5kKHtcInByb3Bvc2FsX3N0YXR1c1wiOnskbmluOltcIlBhc3NlZFwiLCBcIlJlamVjdGVkXCIsIFwiUmVtb3ZlZFwiXX19KS5mZXRjaCgpO1xuXG4gICAgICAgIGlmIChwcm9wb3NhbHMgJiYgKHByb3Bvc2Fscy5sZW5ndGggPiAwKSl7XG4gICAgICAgICAgICBmb3IgKGxldCBpIGluIHByb3Bvc2Fscyl7XG4gICAgICAgICAgICAgICAgaWYgKHBhcnNlSW50KHByb3Bvc2Fsc1tpXS5wcm9wb3NhbElkKSA+IDApe1xuICAgICAgICAgICAgICAgICAgICB0cnl7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBnZXQgcHJvcG9zYWwgZGVwb3NpdHNcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCB1cmwgPSBMQ0QgKyAnL2dvdi9wcm9wb3NhbHMvJytwcm9wb3NhbHNbaV0ucHJvcG9zYWxJZCsnL2RlcG9zaXRzJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCByZXNwb25zZSA9IEhUVFAuZ2V0KHVybCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgcHJvcG9zYWwgPSB7cHJvcG9zYWxJZDogcHJvcG9zYWxzW2ldLnByb3Bvc2FsSWR9O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT0gMjAwKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgZGVwb3NpdHMgPSBKU09OLnBhcnNlKHJlc3BvbnNlLmNvbnRlbnQpLnJlc3VsdDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wb3NhbC5kZXBvc2l0cyA9IGRlcG9zaXRzO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICB1cmwgPSBMQ0QgKyAnL2dvdi9wcm9wb3NhbHMvJytwcm9wb3NhbHNbaV0ucHJvcG9zYWxJZCsnL3ZvdGVzJztcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlID0gSFRUUC5nZXQodXJsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXNwb25zZS5zdGF0dXNDb2RlID09IDIwMCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHZvdGVzID0gSlNPTi5wYXJzZShyZXNwb25zZS5jb250ZW50KS5yZXN1bHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcG9zYWwudm90ZXMgPSBnZXRWb3RlRGV0YWlsKHZvdGVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgdXJsID0gTENEICsgJy9nb3YvcHJvcG9zYWxzLycrcHJvcG9zYWxzW2ldLnByb3Bvc2FsSWQrJy90YWxseSc7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXNwb25zZSA9IEhUVFAuZ2V0KHVybCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PSAyMDApe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCB0YWxseSA9IEpTT04ucGFyc2UocmVzcG9uc2UuY29udGVudCkucmVzdWx0O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3Bvc2FsLnRhbGx5ID0gdGFsbHk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3Bvc2FsLnVwZGF0ZWRBdCA9IG5ldyBEYXRlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBQcm9wb3NhbHMudXBkYXRlKHtwcm9wb3NhbElkOiBwcm9wb3NhbHNbaV0ucHJvcG9zYWxJZH0sIHskc2V0OnByb3Bvc2FsfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY2F0Y2goZSl7XG5cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbn0pXG5cbmNvbnN0IGdldFZvdGVEZXRhaWwgPSAodm90ZXMpID0+IHtcbiAgICBpZiAoIXZvdGVzKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBsZXQgdm90ZXJzID0gdm90ZXMubWFwKCh2b3RlKSA9PiB2b3RlLnZvdGVyKTtcbiAgICBsZXQgdm90aW5nUG93ZXJNYXAgPSB7fTtcbiAgICBsZXQgdmFsaWRhdG9yQWRkcmVzc01hcCA9IHt9O1xuICAgIFZhbGlkYXRvcnMuZmluZCh7ZGVsZWdhdG9yX2FkZHJlc3M6IHskaW46IHZvdGVyc319KS5mb3JFYWNoKCh2YWxpZGF0b3IpID0+IHtcbiAgICAgICAgdm90aW5nUG93ZXJNYXBbdmFsaWRhdG9yLmRlbGVnYXRvcl9hZGRyZXNzXSA9IHtcbiAgICAgICAgICAgIG1vbmlrZXI6IHZhbGlkYXRvci5kZXNjcmlwdGlvbi5tb25pa2VyLFxuICAgICAgICAgICAgYWRkcmVzczogdmFsaWRhdG9yLmFkZHJlc3MsXG4gICAgICAgICAgICB0b2tlbnM6IHBhcnNlRmxvYXQodmFsaWRhdG9yLnRva2VucyksXG4gICAgICAgICAgICBkZWxlZ2F0b3JTaGFyZXM6IHBhcnNlRmxvYXQodmFsaWRhdG9yLmRlbGVnYXRvcl9zaGFyZXMpLFxuICAgICAgICAgICAgZGVkdWN0ZWRTaGFyZXM6IHBhcnNlRmxvYXQodmFsaWRhdG9yLmRlbGVnYXRvcl9zaGFyZXMpXG4gICAgICAgIH1cbiAgICAgICAgdmFsaWRhdG9yQWRkcmVzc01hcFt2YWxpZGF0b3Iub3BlcmF0b3JfYWRkcmVzc10gPSB2YWxpZGF0b3IuZGVsZWdhdG9yX2FkZHJlc3M7XG4gICAgfSk7XG4gICAgdm90ZXJzLmZvckVhY2goKHZvdGVyKSA9PiB7XG4gICAgICAgIGlmICghdm90aW5nUG93ZXJNYXBbdm90ZXJdKSB7XG4gICAgICAgICAgICAvLyB2b3RlciBpcyBub3QgYSB2YWxpZGF0b3JcbiAgICAgICAgICAgIGxldCB1cmwgPSBgJHtMQ0R9L3N0YWtpbmcvZGVsZWdhdG9ycy8ke3ZvdGVyfS9kZWxlZ2F0aW9uc2A7XG4gICAgICAgICAgICBsZXQgZGVsZWdhdGlvbnM7XG4gICAgICAgICAgICBsZXQgdm90aW5nUG93ZXIgPSAwO1xuICAgICAgICAgICAgdHJ5e1xuICAgICAgICAgICAgICAgIGxldCByZXNwb25zZSA9IEhUVFAuZ2V0KHVybCk7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT0gMjAwKXtcbiAgICAgICAgICAgICAgICAgICAgZGVsZWdhdGlvbnMgPSBKU09OLnBhcnNlKHJlc3BvbnNlLmNvbnRlbnQpLnJlc3VsdDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRlbGVnYXRpb25zICYmIGRlbGVnYXRpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGVnYXRpb25zLmZvckVhY2goKGRlbGVnYXRpb24pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgc2hhcmVzID0gcGFyc2VGbG9hdChkZWxlZ2F0aW9uLnNoYXJlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHZhbGlkYXRvckFkZHJlc3NNYXBbZGVsZWdhdGlvbi52YWxpZGF0b3JfYWRkcmVzc10pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZGVkdWN0IGRlbGVnYXRlZCBzaGFyZWRzIGZyb20gdmFsaWRhdG9yIGlmIGEgZGVsZWdhdG9yIHZvdGVzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCB2YWxpZGF0b3IgPSB2b3RpbmdQb3dlck1hcFt2YWxpZGF0b3JBZGRyZXNzTWFwW2RlbGVnYXRpb24udmFsaWRhdG9yX2FkZHJlc3NdXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdG9yLmRlZHVjdGVkU2hhcmVzIC09IHNoYXJlcztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHZhbGlkYXRvci5kZWxlZ2F0b3Jfc2hhcmVzICE9IDApeyAvLyBhdm9pZGluZyBkaXZpc2lvbiBieSB6ZXJvXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2b3RpbmdQb3dlciArPSAoc2hhcmVzL3ZhbGlkYXRvci5kZWxlZ2F0b3JTaGFyZXMpICogdmFsaWRhdG9yLnRva2VucztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHZhbGlkYXRvciA9IFZhbGlkYXRvcnMuZmluZE9uZSh7b3BlcmF0b3JfYWRkcmVzczogZGVsZWdhdGlvbi52YWxpZGF0b3JfYWRkcmVzc30pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodmFsaWRhdG9yICYmIHZhbGlkYXRvci5kZWxlZ2F0b3Jfc2hhcmVzICE9IDApeyAvLyBhdm9pZGluZyBkaXZpc2lvbiBieSB6ZXJvXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2b3RpbmdQb3dlciArPSAoc2hhcmVzL3BhcnNlRmxvYXQodmFsaWRhdG9yLmRlbGVnYXRvcl9zaGFyZXMpKSAqIHBhcnNlRmxvYXQodmFsaWRhdG9yLnRva2Vucyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKXtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZvdGluZ1Bvd2VyTWFwW3ZvdGVyXSA9IHt2b3RpbmdQb3dlcjogdm90aW5nUG93ZXJ9O1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHZvdGVzLm1hcCgodm90ZSkgPT4ge1xuICAgICAgICBsZXQgdm90ZXIgPSB2b3RpbmdQb3dlck1hcFt2b3RlLnZvdGVyXTtcbiAgICAgICAgbGV0IHZvdGluZ1Bvd2VyID0gdm90ZXIudm90aW5nUG93ZXI7XG4gICAgICAgIGlmICh2b3RpbmdQb3dlciA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vIHZvdGVyIGlzIGEgdmFsaWRhdG9yXG4gICAgICAgICAgICB2b3RpbmdQb3dlciA9IHZvdGVyLmRlbGVnYXRvclNoYXJlcz8oKHZvdGVyLmRlZHVjdGVkU2hhcmVzL3ZvdGVyLmRlbGVnYXRvclNoYXJlcykgKiB2b3Rlci50b2tlbnMpOjA7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHsuLi52b3RlLCB2b3RpbmdQb3dlcn07XG4gICAgfSk7XG59XG4iLCJpbXBvcnQgeyBNZXRlb3IgfSBmcm9tICdtZXRlb3IvbWV0ZW9yJztcbmltcG9ydCB7IFByb3Bvc2FscyB9IGZyb20gJy4uL3Byb3Bvc2Fscy5qcyc7XG5pbXBvcnQgeyBjaGVjayB9IGZyb20gJ21ldGVvci9jaGVjaydcblxuTWV0ZW9yLnB1Ymxpc2goJ3Byb3Bvc2Fscy5saXN0JywgZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBQcm9wb3NhbHMuZmluZCh7fSwge3NvcnQ6e3Byb3Bvc2FsSWQ6LTF9fSk7XG59KTtcblxuTWV0ZW9yLnB1Ymxpc2goJ3Byb3Bvc2Fscy5vbmUnLCBmdW5jdGlvbiAoaWQpe1xuICAgIGNoZWNrKGlkLCBOdW1iZXIpO1xuICAgIHJldHVybiBQcm9wb3NhbHMuZmluZCh7cHJvcG9zYWxJZDppZH0pO1xufSkiLCJpbXBvcnQgeyBNb25nbyB9IGZyb20gJ21ldGVvci9tb25nbyc7XG5cbmV4cG9ydCBjb25zdCBQcm9wb3NhbHMgPSBuZXcgTW9uZ28uQ29sbGVjdGlvbigncHJvcG9zYWxzJyk7XG4iLCJpbXBvcnQgeyBNZXRlb3IgfSBmcm9tICdtZXRlb3IvbWV0ZW9yJztcbmltcG9ydCB7IE1vbmdvIH0gZnJvbSAnbWV0ZW9yL21vbmdvJztcbmltcG9ydCB7IFZhbGlkYXRvclJlY29yZHMsIEFuYWx5dGljcywgQXZlcmFnZURhdGEsIEF2ZXJhZ2VWYWxpZGF0b3JEYXRhIH0gZnJvbSAnLi4vcmVjb3Jkcy5qcyc7XG5pbXBvcnQgeyBWYWxpZGF0b3JzIH0gZnJvbSAnLi4vLi4vdmFsaWRhdG9ycy92YWxpZGF0b3JzLmpzJztcbmltcG9ydCB7IFZhbGlkYXRvclNldHMgfSBmcm9tICcvaW1wb3J0cy9hcGkvdmFsaWRhdG9yLXNldHMvdmFsaWRhdG9yLXNldHMuanMnO1xuaW1wb3J0IHsgU3RhdHVzIH0gZnJvbSAnLi4vLi4vc3RhdHVzL3N0YXR1cy5qcyc7XG5pbXBvcnQgeyBNaXNzZWRCbG9ja3NTdGF0cyB9IGZyb20gJy4uL3JlY29yZHMuanMnO1xuaW1wb3J0IHsgTWlzc2VkQmxvY2tzIH0gZnJvbSAnLi4vcmVjb3Jkcy5qcyc7XG5pbXBvcnQgeyBCbG9ja3Njb24gfSBmcm9tICcuLi8uLi9ibG9ja3MvYmxvY2tzLmpzJztcbmltcG9ydCB7IENoYWluIH0gZnJvbSAnLi4vLi4vY2hhaW4vY2hhaW4uanMnO1xuaW1wb3J0IF8gZnJvbSAnbG9kYXNoJztcbmNvbnN0IEJVTEtVUERBVEVNQVhTSVpFID0gMTAwMDtcblxuY29uc3QgZ2V0QmxvY2tTdGF0cyA9IChzdGFydEhlaWdodCwgbGF0ZXN0SGVpZ2h0KSA9PiB7XG4gICAgbGV0IGJsb2NrU3RhdHMgPSB7fTtcbiAgICBjb25zdCBjb25kID0geyRhbmQ6IFtcbiAgICAgICAgeyBoZWlnaHQ6IHsgJGd0OiBzdGFydEhlaWdodCB9IH0sXG4gICAgICAgIHsgaGVpZ2h0OiB7ICRsdGU6IGxhdGVzdEhlaWdodCB9IH0gXX07XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtzb3J0OntoZWlnaHQ6IDF9fTtcbiAgICBCbG9ja3Njb24uZmluZChjb25kLCBvcHRpb25zKS5mb3JFYWNoKChibG9jaykgPT4ge1xuICAgICAgICBibG9ja1N0YXRzW2Jsb2NrLmhlaWdodF0gPSB7XG4gICAgICAgICAgICBoZWlnaHQ6IGJsb2NrLmhlaWdodCxcbiAgICAgICAgICAgIHByb3Bvc2VyQWRkcmVzczogYmxvY2sucHJvcG9zZXJBZGRyZXNzLFxuICAgICAgICAgICAgcHJlY29tbWl0c0NvdW50OiBibG9jay5wcmVjb21taXRzQ291bnQsXG4gICAgICAgICAgICB2YWxpZGF0b3JzQ291bnQ6IGJsb2NrLnZhbGlkYXRvcnNDb3VudCxcbiAgICAgICAgICAgIHZhbGlkYXRvcnM6IGJsb2NrLnZhbGlkYXRvcnMsXG4gICAgICAgICAgICB0aW1lOiBibG9jay50aW1lXG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIEFuYWx5dGljcy5maW5kKGNvbmQsIG9wdGlvbnMpLmZvckVhY2goKGJsb2NrKSA9PiB7XG4gICAgICAgIGlmICghYmxvY2tTdGF0c1tibG9jay5oZWlnaHRdKSB7XG4gICAgICAgICAgICBibG9ja1N0YXRzW2Jsb2NrLmhlaWdodF0gPSB7IGhlaWdodDogYmxvY2suaGVpZ2h0IH07XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgYmxvY2sgJHtibG9jay5oZWlnaHR9IGRvZXMgbm90IGhhdmUgYW4gZW50cnlgKTtcbiAgICAgICAgfVxuICAgICAgICBfLmFzc2lnbihibG9ja1N0YXRzW2Jsb2NrLmhlaWdodF0sIHtcbiAgICAgICAgICAgIHByZWNvbW1pdHM6IGJsb2NrLnByZWNvbW1pdHMsXG4gICAgICAgICAgICBhdmVyYWdlQmxvY2tUaW1lOiBibG9jay5hdmVyYWdlQmxvY2tUaW1lLFxuICAgICAgICAgICAgdGltZURpZmY6IGJsb2NrLnRpbWVEaWZmLFxuICAgICAgICAgICAgdm90aW5nX3Bvd2VyOiBibG9jay52b3RpbmdfcG93ZXJcbiAgICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIGJsb2NrU3RhdHM7XG59XG5cbmNvbnN0IGdldFByZXZpb3VzUmVjb3JkID0gKHZvdGVyQWRkcmVzcywgcHJvcG9zZXJBZGRyZXNzKSA9PiB7XG4gICAgbGV0IHByZXZpb3VzUmVjb3JkID0gTWlzc2VkQmxvY2tzLmZpbmRPbmUoXG4gICAgICAgIHt2b3Rlcjp2b3RlckFkZHJlc3MsIHByb3Bvc2VyOnByb3Bvc2VyQWRkcmVzcywgYmxvY2tIZWlnaHQ6IC0xfSk7XG4gICAgbGV0IGxhc3RVcGRhdGVkSGVpZ2h0ID0gTWV0ZW9yLnNldHRpbmdzLnBhcmFtcy5zdGFydEhlaWdodDtcbiAgICBsZXQgcHJldlN0YXRzID0ge307XG4gICAgaWYgKHByZXZpb3VzUmVjb3JkKSB7XG4gICAgICAgIHByZXZTdGF0cyA9IF8ucGljayhwcmV2aW91c1JlY29yZCwgWydtaXNzQ291bnQnLCAndG90YWxDb3VudCddKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwcmV2U3RhdHMgPSB7XG4gICAgICAgICAgICBtaXNzQ291bnQ6IDAsXG4gICAgICAgICAgICB0b3RhbENvdW50OiAwXG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHByZXZTdGF0cztcbn1cblxuTWV0ZW9yLm1ldGhvZHMoe1xuICAgICdWYWxpZGF0b3JSZWNvcmRzLmNhbGN1bGF0ZU1pc3NlZEJsb2Nrcyc6IGZ1bmN0aW9uKCl7XG4gICAgICAgIGlmICghQ09VTlRNSVNTRURCTE9DS1Mpe1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBsZXQgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICAgICAgICAgICAgICBDT1VOVE1JU1NFREJMT0NLUyA9IHRydWU7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ2NhbHVsYXRlIG1pc3NlZCBibG9ja3MgY291bnQnKTtcbiAgICAgICAgICAgICAgICB0aGlzLnVuYmxvY2soKTtcbiAgICAgICAgICAgICAgICBsZXQgdmFsaWRhdG9ycyA9IFZhbGlkYXRvcnMuZmluZCh7fSkuZmV0Y2goKTtcbiAgICAgICAgICAgICAgICBsZXQgbGF0ZXN0SGVpZ2h0ID0gTWV0ZW9yLmNhbGwoJ2Jsb2Nrcy5nZXRDdXJyZW50SGVpZ2h0Jyk7XG4gICAgICAgICAgICAgICAgbGV0IGV4cGxvcmVyU3RhdHVzID0gU3RhdHVzLmZpbmRPbmUoe2NoYWluSWQ6IE1ldGVvci5zZXR0aW5ncy5wdWJsaWMuY2hhaW5JZH0pO1xuICAgICAgICAgICAgICAgIGxldCBzdGFydEhlaWdodCA9IChleHBsb3JlclN0YXR1cyYmZXhwbG9yZXJTdGF0dXMubGFzdFByb2Nlc3NlZE1pc3NlZEJsb2NrSGVpZ2h0KT9leHBsb3JlclN0YXR1cy5sYXN0UHJvY2Vzc2VkTWlzc2VkQmxvY2tIZWlnaHQ6TWV0ZW9yLnNldHRpbmdzLnBhcmFtcy5zdGFydEhlaWdodDtcbiAgICAgICAgICAgICAgICBsYXRlc3RIZWlnaHQgPSBNYXRoLm1pbihzdGFydEhlaWdodCArIEJVTEtVUERBVEVNQVhTSVpFLCBsYXRlc3RIZWlnaHQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJ1bGtNaXNzZWRTdGF0cyA9IE1pc3NlZEJsb2Nrcy5yYXdDb2xsZWN0aW9uKCkuaW5pdGlhbGl6ZU9yZGVyZWRCdWxrT3AoKTtcblxuICAgICAgICAgICAgICAgIGxldCB2YWxpZGF0b3JzTWFwID0ge307XG4gICAgICAgICAgICAgICAgdmFsaWRhdG9ycy5mb3JFYWNoKCh2YWxpZGF0b3IpID0+IHZhbGlkYXRvcnNNYXBbdmFsaWRhdG9yLmFkZHJlc3NdID0gdmFsaWRhdG9yKTtcblxuICAgICAgICAgICAgICAgIC8vIGEgbWFwIG9mIGJsb2NrIGhlaWdodCB0byBibG9jayBzdGF0c1xuICAgICAgICAgICAgICAgIGxldCBibG9ja1N0YXRzID0gZ2V0QmxvY2tTdGF0cyhzdGFydEhlaWdodCwgbGF0ZXN0SGVpZ2h0KTtcblxuICAgICAgICAgICAgICAgIC8vIHByb3Bvc2VyVm90ZXJTdGF0cyBpcyBhIHByb3Bvc2VyLXZvdGVyIG1hcCBjb3VudGluZyBudW1iZXJzIG9mIHByb3Bvc2VkIGJsb2NrcyBvZiB3aGljaCB2b3RlciBpcyBhbiBhY3RpdmUgdmFsaWRhdG9yXG4gICAgICAgICAgICAgICAgbGV0IHByb3Bvc2VyVm90ZXJTdGF0cyA9IHt9XG5cbiAgICAgICAgICAgICAgICBfLmZvckVhY2goYmxvY2tTdGF0cywgKGJsb2NrLCBibG9ja0hlaWdodCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBsZXQgcHJvcG9zZXJBZGRyZXNzID0gYmxvY2sucHJvcG9zZXJBZGRyZXNzO1xuICAgICAgICAgICAgICAgICAgICBsZXQgdm90ZWRWYWxpZGF0b3JzID0gbmV3IFNldChibG9jay52YWxpZGF0b3JzKTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHZhbGlkYXRvclNldHMgPSBWYWxpZGF0b3JTZXRzLmZpbmRPbmUoe2Jsb2NrX2hlaWdodDpibG9jay5oZWlnaHR9KTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHZvdGVkVm90aW5nUG93ZXIgPSAwO1xuXG4gICAgICAgICAgICAgICAgICAgIHZhbGlkYXRvclNldHMudmFsaWRhdG9ycy5mb3JFYWNoKChhY3RpdmVWYWxpZGF0b3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh2b3RlZFZhbGlkYXRvcnMuaGFzKGFjdGl2ZVZhbGlkYXRvci5hZGRyZXNzKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2b3RlZFZvdGluZ1Bvd2VyICs9IHBhcnNlRmxvYXQoYWN0aXZlVmFsaWRhdG9yLnZvdGluZ19wb3dlcilcbiAgICAgICAgICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3JTZXRzLnZhbGlkYXRvcnMuZm9yRWFjaCgoYWN0aXZlVmFsaWRhdG9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgY3VycmVudFZhbGlkYXRvciA9IGFjdGl2ZVZhbGlkYXRvci5hZGRyZXNzXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIV8uaGFzKHByb3Bvc2VyVm90ZXJTdGF0cywgW3Byb3Bvc2VyQWRkcmVzcywgY3VycmVudFZhbGlkYXRvcl0pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHByZXZTdGF0cyA9IGdldFByZXZpb3VzUmVjb3JkKGN1cnJlbnRWYWxpZGF0b3IsIHByb3Bvc2VyQWRkcmVzcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXy5zZXQocHJvcG9zZXJWb3RlclN0YXRzLCBbcHJvcG9zZXJBZGRyZXNzLCBjdXJyZW50VmFsaWRhdG9yXSwgcHJldlN0YXRzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgXy51cGRhdGUocHJvcG9zZXJWb3RlclN0YXRzLCBbcHJvcG9zZXJBZGRyZXNzLCBjdXJyZW50VmFsaWRhdG9yLCAndG90YWxDb3VudCddLCAobikgPT4gbisxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdm90ZWRWYWxpZGF0b3JzLmhhcyhjdXJyZW50VmFsaWRhdG9yKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF8udXBkYXRlKHByb3Bvc2VyVm90ZXJTdGF0cywgW3Byb3Bvc2VyQWRkcmVzcywgY3VycmVudFZhbGlkYXRvciwgJ21pc3NDb3VudCddLCAobikgPT4gbisxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBidWxrTWlzc2VkU3RhdHMuaW5zZXJ0KHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdm90ZXI6IGN1cnJlbnRWYWxpZGF0b3IsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJsb2NrSGVpZ2h0OiBibG9jay5oZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3Bvc2VyOiBwcm9wb3NlckFkZHJlc3MsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZWNvbW1pdHNDb3VudDogYmxvY2sucHJlY29tbWl0c0NvdW50LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3JzQ291bnQ6IGJsb2NrLnZhbGlkYXRvcnNDb3VudCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGltZTogYmxvY2sudGltZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJlY29tbWl0czogYmxvY2sucHJlY29tbWl0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXZlcmFnZUJsb2NrVGltZTogYmxvY2suYXZlcmFnZUJsb2NrVGltZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGltZURpZmY6IGJsb2NrLnRpbWVEaWZmLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2b3RpbmdQb3dlcjogYmxvY2sudm90aW5nX3Bvd2VyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2b3RlZFZvdGluZ1Bvd2VyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVkQXQ6IGxhdGVzdEhlaWdodCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlzc0NvdW50OiBfLmdldChwcm9wb3NlclZvdGVyU3RhdHMsIFtwcm9wb3NlckFkZHJlc3MsIGN1cnJlbnRWYWxpZGF0b3IsICdtaXNzQ291bnQnXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvdGFsQ291bnQ6IF8uZ2V0KHByb3Bvc2VyVm90ZXJTdGF0cywgW3Byb3Bvc2VyQWRkcmVzcywgY3VycmVudFZhbGlkYXRvciwgJ3RvdGFsQ291bnQnXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIF8uZm9yRWFjaChwcm9wb3NlclZvdGVyU3RhdHMsICh2b3RlcnMsIHByb3Bvc2VyQWRkcmVzcykgPT4ge1xuICAgICAgICAgICAgICAgICAgICBfLmZvckVhY2godm90ZXJzLCAoc3RhdHMsIHZvdGVyQWRkcmVzcykgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgYnVsa01pc3NlZFN0YXRzLmZpbmQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZvdGVyOiB2b3RlckFkZHJlc3MsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcG9zZXI6IHByb3Bvc2VyQWRkcmVzcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBibG9ja0hlaWdodDogLTFcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pLnVwc2VydCgpLnVwZGF0ZU9uZSh7JHNldDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZvdGVyOiB2b3RlckFkZHJlc3MsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcG9zZXI6IHByb3Bvc2VyQWRkcmVzcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBibG9ja0hlaWdodDogLTEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlZEF0OiBsYXRlc3RIZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlzc0NvdW50OiBfLmdldChzdGF0cywgJ21pc3NDb3VudCcpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvdGFsQ291bnQ6IF8uZ2V0KHN0YXRzLCAndG90YWxDb3VudCcpXG4gICAgICAgICAgICAgICAgICAgICAgICB9fSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgbGV0IG1lc3NhZ2UgPSAnJztcbiAgICAgICAgICAgICAgICBpZiAoYnVsa01pc3NlZFN0YXRzLmxlbmd0aCA+IDApe1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjbGllbnQgPSBNaXNzZWRCbG9ja3MuX2RyaXZlci5tb25nby5jbGllbnQ7XG4gICAgICAgICAgICAgICAgICAgIC8vIFRPRE86IGFkZCB0cmFuc2FjdGlvbiBiYWNrIGFmdGVyIHJlcGxpY2Egc2V0KCMxNDYpIGlzIHNldCB1cFxuICAgICAgICAgICAgICAgICAgICAvLyBsZXQgc2Vzc2lvbiA9IGNsaWVudC5zdGFydFNlc3Npb24oKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gc2Vzc2lvbi5zdGFydFRyYW5zYWN0aW9uKCk7XG4gICAgICAgICAgICAgICAgICAgIGxldCBidWxrUHJvbWlzZSA9IGJ1bGtNaXNzZWRTdGF0cy5leGVjdXRlKG51bGwvKiwge3Nlc3Npb259Ki8pLnRoZW4oXG4gICAgICAgICAgICAgICAgICAgICAgICBNZXRlb3IuYmluZEVudmlyb25tZW50KChyZXN1bHQsIGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBDT1VOVE1JU1NFREJMT0NLUyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBQcm9taXNlLmF3YWl0KHNlc3Npb24uYWJvcnRUcmFuc2FjdGlvbigpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0KXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gUHJvbWlzZS5hd2FpdChzZXNzaW9uLmNvbW1pdFRyYW5zYWN0aW9uKCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlID0gYCgke3Jlc3VsdC5yZXN1bHQubkluc2VydGVkfSBpbnNlcnRlZCwgYCArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYCR7cmVzdWx0LnJlc3VsdC5uVXBzZXJ0ZWR9IHVwc2VydGVkLCBgICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgJHtyZXN1bHQucmVzdWx0Lm5Nb2RpZmllZH0gbW9kaWZpZWQpYDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgICAgICAgICAgUHJvbWlzZS5hd2FpdChidWxrUHJvbWlzZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgQ09VTlRNSVNTRURCTE9DS1MgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBTdGF0dXMudXBzZXJ0KHtjaGFpbklkOiBNZXRlb3Iuc2V0dGluZ3MucHVibGljLmNoYWluSWR9LCB7JHNldDp7bGFzdFByb2Nlc3NlZE1pc3NlZEJsb2NrSGVpZ2h0OmxhdGVzdEhlaWdodCwgbGFzdFByb2Nlc3NlZE1pc3NlZEJsb2NrVGltZTogbmV3IERhdGUoKX19KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYGRvbmUgaW4gJHtEYXRlLm5vdygpIC0gc3RhcnRUaW1lfW1zICR7bWVzc2FnZX1gO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIENPVU5UTUlTU0VEQkxPQ0tTID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNle1xuICAgICAgICAgICAgcmV0dXJuIFwidXBkYXRpbmcuLi5cIjtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgJ1ZhbGlkYXRvclJlY29yZHMuY2FsY3VsYXRlTWlzc2VkQmxvY2tzU3RhdHMnOiBmdW5jdGlvbigpe1xuICAgICAgICAvLyBUT0RPOiBkZXByZWNhdGUgdGhpcyBtZXRob2QgYW5kIE1pc3NlZEJsb2Nrc1N0YXRzIGNvbGxlY3Rpb25cbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJWYWxpZGF0b3JSZWNvcmRzLmNhbGN1bGF0ZU1pc3NlZEJsb2NrczogXCIrQ09VTlRNSVNTRURCTE9DS1MpO1xuICAgICAgICBpZiAoIUNPVU5UTUlTU0VEQkxPQ0tTU1RBVFMpe1xuICAgICAgICAgICAgQ09VTlRNSVNTRURCTE9DS1NTVEFUUyA9IHRydWU7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnY2FsdWxhdGUgbWlzc2VkIGJsb2NrcyBzdGF0cycpO1xuICAgICAgICAgICAgdGhpcy51bmJsb2NrKCk7XG4gICAgICAgICAgICBsZXQgdmFsaWRhdG9ycyA9IFZhbGlkYXRvcnMuZmluZCh7fSkuZmV0Y2goKTtcbiAgICAgICAgICAgIGxldCBsYXRlc3RIZWlnaHQgPSBNZXRlb3IuY2FsbCgnYmxvY2tzLmdldEN1cnJlbnRIZWlnaHQnKTtcbiAgICAgICAgICAgIGxldCBleHBsb3JlclN0YXR1cyA9IFN0YXR1cy5maW5kT25lKHtjaGFpbklkOiBNZXRlb3Iuc2V0dGluZ3MucHVibGljLmNoYWluSWR9KTtcbiAgICAgICAgICAgIGxldCBzdGFydEhlaWdodCA9IChleHBsb3JlclN0YXR1cyYmZXhwbG9yZXJTdGF0dXMubGFzdE1pc3NlZEJsb2NrSGVpZ2h0KT9leHBsb3JlclN0YXR1cy5sYXN0TWlzc2VkQmxvY2tIZWlnaHQ6TWV0ZW9yLnNldHRpbmdzLnBhcmFtcy5zdGFydEhlaWdodDtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGxhdGVzdEhlaWdodCk7XG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhzdGFydEhlaWdodCk7XG4gICAgICAgICAgICBjb25zdCBidWxrTWlzc2VkU3RhdHMgPSBNaXNzZWRCbG9ja3NTdGF0cy5yYXdDb2xsZWN0aW9uKCkuaW5pdGlhbGl6ZVVub3JkZXJlZEJ1bGtPcCgpO1xuICAgICAgICAgICAgZm9yIChpIGluIHZhbGlkYXRvcnMpe1xuICAgICAgICAgICAgICAgIC8vIGlmICgodmFsaWRhdG9yc1tpXS5hZGRyZXNzID09IFwiQjg1NTJFQUMwRDEyM0E2QkY2MDkxMjMwNDdBNTE4MUQ0NUVFOTBCNVwiKSB8fCAodmFsaWRhdG9yc1tpXS5hZGRyZXNzID09IFwiNjlEOTlCMkM2NjA0M0FDQkVBQTg0NDc1MjVDMzU2QUZDNjQwOEUwQ1wiKSB8fCAodmFsaWRhdG9yc1tpXS5hZGRyZXNzID09IFwiMzVBRDdBMkNEMkZDNzE3MTFBNjc1ODMwRUMxMTU4MDgyMjczRDQ1N1wiKSl7XG4gICAgICAgICAgICAgICAgbGV0IHZvdGVyQWRkcmVzcyA9IHZhbGlkYXRvcnNbaV0uYWRkcmVzcztcbiAgICAgICAgICAgICAgICBsZXQgbWlzc2VkUmVjb3JkcyA9IFZhbGlkYXRvclJlY29yZHMuZmluZCh7XG4gICAgICAgICAgICAgICAgICAgIGFkZHJlc3M6dm90ZXJBZGRyZXNzLFxuICAgICAgICAgICAgICAgICAgICBleGlzdHM6ZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICRhbmQ6IFsgeyBoZWlnaHQ6IHsgJGd0OiBzdGFydEhlaWdodCB9IH0sIHsgaGVpZ2h0OiB7ICRsdGU6IGxhdGVzdEhlaWdodCB9IH0gXVxuICAgICAgICAgICAgICAgIH0pLmZldGNoKCk7XG5cbiAgICAgICAgICAgICAgICBsZXQgY291bnRzID0ge307XG5cbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcIm1pc3NlZFJlY29yZHMgdG8gcHJvY2VzczogXCIrbWlzc2VkUmVjb3Jkcy5sZW5ndGgpO1xuICAgICAgICAgICAgICAgIGZvciAoYiBpbiBtaXNzZWRSZWNvcmRzKXtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGJsb2NrID0gQmxvY2tzY29uLmZpbmRPbmUoe2hlaWdodDptaXNzZWRSZWNvcmRzW2JdLmhlaWdodH0pO1xuICAgICAgICAgICAgICAgICAgICBsZXQgZXhpc3RpbmdSZWNvcmQgPSBNaXNzZWRCbG9ja3NTdGF0cy5maW5kT25lKHt2b3Rlcjp2b3RlckFkZHJlc3MsIHByb3Bvc2VyOmJsb2NrLnByb3Bvc2VyQWRkcmVzc30pO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY291bnRzW2Jsb2NrLnByb3Bvc2VyQWRkcmVzc10gPT09ICd1bmRlZmluZWQnKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChleGlzdGluZ1JlY29yZCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY291bnRzW2Jsb2NrLnByb3Bvc2VyQWRkcmVzc10gPSBleGlzdGluZ1JlY29yZC5jb3VudCsxO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb3VudHNbYmxvY2sucHJvcG9zZXJBZGRyZXNzXSA9IDE7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvdW50c1tibG9jay5wcm9wb3NlckFkZHJlc3NdKys7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBmb3IgKGFkZHJlc3MgaW4gY291bnRzKXtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGRhdGEgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2b3Rlcjogdm90ZXJBZGRyZXNzLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcG9zZXI6YWRkcmVzcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvdW50OiBjb3VudHNbYWRkcmVzc11cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGJ1bGtNaXNzZWRTdGF0cy5maW5kKHt2b3Rlcjp2b3RlckFkZHJlc3MsIHByb3Bvc2VyOmFkZHJlc3N9KS51cHNlcnQoKS51cGRhdGVPbmUoeyRzZXQ6ZGF0YX0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyB9XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGJ1bGtNaXNzZWRTdGF0cy5sZW5ndGggPiAwKXtcbiAgICAgICAgICAgICAgICBidWxrTWlzc2VkU3RhdHMuZXhlY3V0ZShNZXRlb3IuYmluZEVudmlyb25tZW50KChlcnIsIHJlc3VsdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIENPVU5UTUlTU0VEQkxPQ0tTU1RBVFMgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGVycik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdCl7XG4gICAgICAgICAgICAgICAgICAgICAgICBTdGF0dXMudXBzZXJ0KHtjaGFpbklkOiBNZXRlb3Iuc2V0dGluZ3MucHVibGljLmNoYWluSWR9LCB7JHNldDp7bGFzdE1pc3NlZEJsb2NrSGVpZ2h0OmxhdGVzdEhlaWdodCwgbGFzdE1pc3NlZEJsb2NrVGltZTogbmV3IERhdGUoKX19KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIENPVU5UTUlTU0VEQkxPQ0tTU1RBVFMgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiZG9uZVwiKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2V7XG4gICAgICAgICAgICAgICAgQ09VTlRNSVNTRURCTE9DS1NTVEFUUyA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNle1xuICAgICAgICAgICAgcmV0dXJuIFwidXBkYXRpbmcuLi5cIjtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgJ0FuYWx5dGljcy5hZ2dyZWdhdGVCbG9ja1RpbWVBbmRWb3RpbmdQb3dlcic6IGZ1bmN0aW9uKHRpbWUpe1xuICAgICAgICB0aGlzLnVuYmxvY2soKTtcbiAgICAgICAgbGV0IG5vdyA9IG5ldyBEYXRlKCk7XG5cbiAgICAgICAgaWYgKHRpbWUgPT0gJ20nKXtcbiAgICAgICAgICAgIGxldCBhdmVyYWdlQmxvY2tUaW1lID0gMDtcbiAgICAgICAgICAgIGxldCBhdmVyYWdlVm90aW5nUG93ZXIgPSAwO1xuXG4gICAgICAgICAgICBsZXQgYW5hbHl0aWNzID0gQW5hbHl0aWNzLmZpbmQoeyBcInRpbWVcIjogeyAkZ3Q6IG5ldyBEYXRlKERhdGUubm93KCkgLSA2MCAqIDEwMDApIH0gfSkuZmV0Y2goKTtcbiAgICAgICAgICAgIGlmIChhbmFseXRpY3MubGVuZ3RoID4gMCl7XG4gICAgICAgICAgICAgICAgZm9yIChpIGluIGFuYWx5dGljcyl7XG4gICAgICAgICAgICAgICAgICAgIGF2ZXJhZ2VCbG9ja1RpbWUgKz0gYW5hbHl0aWNzW2ldLnRpbWVEaWZmO1xuICAgICAgICAgICAgICAgICAgICBhdmVyYWdlVm90aW5nUG93ZXIgKz0gYW5hbHl0aWNzW2ldLnZvdGluZ19wb3dlcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYXZlcmFnZUJsb2NrVGltZSA9IGF2ZXJhZ2VCbG9ja1RpbWUgLyBhbmFseXRpY3MubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGF2ZXJhZ2VWb3RpbmdQb3dlciA9IGF2ZXJhZ2VWb3RpbmdQb3dlciAvIGFuYWx5dGljcy5sZW5ndGg7XG5cbiAgICAgICAgICAgICAgICBDaGFpbi51cGRhdGUoe2NoYWluSWQ6TWV0ZW9yLnNldHRpbmdzLnB1YmxpYy5jaGFpbklkfSx7JHNldDp7bGFzdE1pbnV0ZVZvdGluZ1Bvd2VyOmF2ZXJhZ2VWb3RpbmdQb3dlciwgbGFzdE1pbnV0ZUJsb2NrVGltZTphdmVyYWdlQmxvY2tUaW1lfX0pO1xuICAgICAgICAgICAgICAgIEF2ZXJhZ2VEYXRhLmluc2VydCh7XG4gICAgICAgICAgICAgICAgICAgIGF2ZXJhZ2VCbG9ja1RpbWU6IGF2ZXJhZ2VCbG9ja1RpbWUsXG4gICAgICAgICAgICAgICAgICAgIGF2ZXJhZ2VWb3RpbmdQb3dlcjogYXZlcmFnZVZvdGluZ1Bvd2VyLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiB0aW1lLFxuICAgICAgICAgICAgICAgICAgICBjcmVhdGVkQXQ6IG5vd1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRpbWUgPT0gJ2gnKXtcbiAgICAgICAgICAgIGxldCBhdmVyYWdlQmxvY2tUaW1lID0gMDtcbiAgICAgICAgICAgIGxldCBhdmVyYWdlVm90aW5nUG93ZXIgPSAwO1xuICAgICAgICAgICAgbGV0IGFuYWx5dGljcyA9IEFuYWx5dGljcy5maW5kKHsgXCJ0aW1lXCI6IHsgJGd0OiBuZXcgRGF0ZShEYXRlLm5vdygpIC0gNjAqNjAgKiAxMDAwKSB9IH0pLmZldGNoKCk7XG4gICAgICAgICAgICBpZiAoYW5hbHl0aWNzLmxlbmd0aCA+IDApe1xuICAgICAgICAgICAgICAgIGZvciAoaSBpbiBhbmFseXRpY3Mpe1xuICAgICAgICAgICAgICAgICAgICBhdmVyYWdlQmxvY2tUaW1lICs9IGFuYWx5dGljc1tpXS50aW1lRGlmZjtcbiAgICAgICAgICAgICAgICAgICAgYXZlcmFnZVZvdGluZ1Bvd2VyICs9IGFuYWx5dGljc1tpXS52b3RpbmdfcG93ZXI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGF2ZXJhZ2VCbG9ja1RpbWUgPSBhdmVyYWdlQmxvY2tUaW1lIC8gYW5hbHl0aWNzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBhdmVyYWdlVm90aW5nUG93ZXIgPSBhdmVyYWdlVm90aW5nUG93ZXIgLyBhbmFseXRpY3MubGVuZ3RoO1xuXG4gICAgICAgICAgICAgICAgQ2hhaW4udXBkYXRlKHtjaGFpbklkOk1ldGVvci5zZXR0aW5ncy5wdWJsaWMuY2hhaW5JZH0seyRzZXQ6e2xhc3RIb3VyVm90aW5nUG93ZXI6YXZlcmFnZVZvdGluZ1Bvd2VyLCBsYXN0SG91ckJsb2NrVGltZTphdmVyYWdlQmxvY2tUaW1lfX0pO1xuICAgICAgICAgICAgICAgIEF2ZXJhZ2VEYXRhLmluc2VydCh7XG4gICAgICAgICAgICAgICAgICAgIGF2ZXJhZ2VCbG9ja1RpbWU6IGF2ZXJhZ2VCbG9ja1RpbWUsXG4gICAgICAgICAgICAgICAgICAgIGF2ZXJhZ2VWb3RpbmdQb3dlcjogYXZlcmFnZVZvdGluZ1Bvd2VyLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiB0aW1lLFxuICAgICAgICAgICAgICAgICAgICBjcmVhdGVkQXQ6IG5vd1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGltZSA9PSAnZCcpe1xuICAgICAgICAgICAgbGV0IGF2ZXJhZ2VCbG9ja1RpbWUgPSAwO1xuICAgICAgICAgICAgbGV0IGF2ZXJhZ2VWb3RpbmdQb3dlciA9IDA7XG4gICAgICAgICAgICBsZXQgYW5hbHl0aWNzID0gQW5hbHl0aWNzLmZpbmQoeyBcInRpbWVcIjogeyAkZ3Q6IG5ldyBEYXRlKERhdGUubm93KCkgLSAyNCo2MCo2MCAqIDEwMDApIH0gfSkuZmV0Y2goKTtcbiAgICAgICAgICAgIGlmIChhbmFseXRpY3MubGVuZ3RoID4gMCl7XG4gICAgICAgICAgICAgICAgZm9yIChpIGluIGFuYWx5dGljcyl7XG4gICAgICAgICAgICAgICAgICAgIGF2ZXJhZ2VCbG9ja1RpbWUgKz0gYW5hbHl0aWNzW2ldLnRpbWVEaWZmO1xuICAgICAgICAgICAgICAgICAgICBhdmVyYWdlVm90aW5nUG93ZXIgKz0gYW5hbHl0aWNzW2ldLnZvdGluZ19wb3dlcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYXZlcmFnZUJsb2NrVGltZSA9IGF2ZXJhZ2VCbG9ja1RpbWUgLyBhbmFseXRpY3MubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGF2ZXJhZ2VWb3RpbmdQb3dlciA9IGF2ZXJhZ2VWb3RpbmdQb3dlciAvIGFuYWx5dGljcy5sZW5ndGg7XG5cbiAgICAgICAgICAgICAgICBDaGFpbi51cGRhdGUoe2NoYWluSWQ6TWV0ZW9yLnNldHRpbmdzLnB1YmxpYy5jaGFpbklkfSx7JHNldDp7bGFzdERheVZvdGluZ1Bvd2VyOmF2ZXJhZ2VWb3RpbmdQb3dlciwgbGFzdERheUJsb2NrVGltZTphdmVyYWdlQmxvY2tUaW1lfX0pO1xuICAgICAgICAgICAgICAgIEF2ZXJhZ2VEYXRhLmluc2VydCh7XG4gICAgICAgICAgICAgICAgICAgIGF2ZXJhZ2VCbG9ja1RpbWU6IGF2ZXJhZ2VCbG9ja1RpbWUsXG4gICAgICAgICAgICAgICAgICAgIGF2ZXJhZ2VWb3RpbmdQb3dlcjogYXZlcmFnZVZvdGluZ1Bvd2VyLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiB0aW1lLFxuICAgICAgICAgICAgICAgICAgICBjcmVhdGVkQXQ6IG5vd1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZXR1cm4gYW5hbHl0aWNzLmxlbmd0aDtcbiAgICB9LFxuICAgICdBbmFseXRpY3MuYWdncmVnYXRlVmFsaWRhdG9yRGFpbHlCbG9ja1RpbWUnOiBmdW5jdGlvbigpe1xuICAgICAgICB0aGlzLnVuYmxvY2soKTtcbiAgICAgICAgbGV0IHZhbGlkYXRvcnMgPSBWYWxpZGF0b3JzLmZpbmQoe30pLmZldGNoKCk7XG4gICAgICAgIGxldCBub3cgPSBuZXcgRGF0ZSgpO1xuICAgICAgICBmb3IgKGkgaW4gdmFsaWRhdG9ycyl7XG4gICAgICAgICAgICBsZXQgYXZlcmFnZUJsb2NrVGltZSA9IDA7XG5cbiAgICAgICAgICAgIGxldCBibG9ja3MgPSBCbG9ja3Njb24uZmluZCh7cHJvcG9zZXJBZGRyZXNzOnZhbGlkYXRvcnNbaV0uYWRkcmVzcywgXCJ0aW1lXCI6IHsgJGd0OiBuZXcgRGF0ZShEYXRlLm5vdygpIC0gMjQqNjAqNjAgKiAxMDAwKSB9fSwge2ZpZWxkczp7aGVpZ2h0OjF9fSkuZmV0Y2goKTtcblxuICAgICAgICAgICAgaWYgKGJsb2Nrcy5sZW5ndGggPiAwKXtcbiAgICAgICAgICAgICAgICBsZXQgYmxvY2tIZWlnaHRzID0gW107XG4gICAgICAgICAgICAgICAgZm9yIChiIGluIGJsb2Nrcyl7XG4gICAgICAgICAgICAgICAgICAgIGJsb2NrSGVpZ2h0cy5wdXNoKGJsb2Nrc1tiXS5oZWlnaHQpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGxldCBhbmFseXRpY3MgPSBBbmFseXRpY3MuZmluZCh7aGVpZ2h0OiB7JGluOmJsb2NrSGVpZ2h0c319LCB7ZmllbGRzOntoZWlnaHQ6MSx0aW1lRGlmZjoxfX0pLmZldGNoKCk7XG5cblxuICAgICAgICAgICAgICAgIGZvciAoYSBpbiBhbmFseXRpY3Mpe1xuICAgICAgICAgICAgICAgICAgICBhdmVyYWdlQmxvY2tUaW1lICs9IGFuYWx5dGljc1thXS50aW1lRGlmZjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBhdmVyYWdlQmxvY2tUaW1lID0gYXZlcmFnZUJsb2NrVGltZSAvIGFuYWx5dGljcy5sZW5ndGg7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIEF2ZXJhZ2VWYWxpZGF0b3JEYXRhLmluc2VydCh7XG4gICAgICAgICAgICAgICAgcHJvcG9zZXJBZGRyZXNzOiB2YWxpZGF0b3JzW2ldLmFkZHJlc3MsXG4gICAgICAgICAgICAgICAgYXZlcmFnZUJsb2NrVGltZTogYXZlcmFnZUJsb2NrVGltZSxcbiAgICAgICAgICAgICAgICB0eXBlOiAnVmFsaWRhdG9yRGFpbHlBdmVyYWdlQmxvY2tUaW1lJyxcbiAgICAgICAgICAgICAgICBjcmVhdGVkQXQ6IG5vd1xuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbn0pXG4iLCJpbXBvcnQgeyBNZXRlb3IgfSBmcm9tICdtZXRlb3IvbWV0ZW9yJztcbmltcG9ydCB7IFZhbGlkYXRvclJlY29yZHMsIEFuYWx5dGljcywgTWlzc2VkQmxvY2tzLCBNaXNzZWRCbG9ja3NTdGF0cywgVlBEaXN0cmlidXRpb25zIH0gZnJvbSAnLi4vcmVjb3Jkcy5qcyc7XG5pbXBvcnQgeyBWYWxpZGF0b3JzIH0gZnJvbSAnLi4vLi4vdmFsaWRhdG9ycy92YWxpZGF0b3JzLmpzJztcblxuTWV0ZW9yLnB1Ymxpc2goJ3ZhbGlkYXRvcl9yZWNvcmRzLmFsbCcsIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gVmFsaWRhdG9yUmVjb3Jkcy5maW5kKCk7XG59KTtcblxuTWV0ZW9yLnB1Ymxpc2goJ3ZhbGlkYXRvcl9yZWNvcmRzLnVwdGltZScsIGZ1bmN0aW9uKGFkZHJlc3MsIG51bSl7XG4gICAgcmV0dXJuIFZhbGlkYXRvclJlY29yZHMuZmluZCh7YWRkcmVzczphZGRyZXNzfSx7bGltaXQ6bnVtLCBzb3J0OntoZWlnaHQ6LTF9fSk7XG59KTtcblxuTWV0ZW9yLnB1Ymxpc2goJ2FuYWx5dGljcy5oaXN0b3J5JywgZnVuY3Rpb24oKXtcbiAgICByZXR1cm4gQW5hbHl0aWNzLmZpbmQoe30se3NvcnQ6e2hlaWdodDotMX0sbGltaXQ6NTB9KTtcbn0pO1xuXG5NZXRlb3IucHVibGlzaCgndnBEaXN0cmlidXRpb24ubGF0ZXN0JywgZnVuY3Rpb24oKXtcbiAgICByZXR1cm4gVlBEaXN0cmlidXRpb25zLmZpbmQoe30se3NvcnQ6e2hlaWdodDotMX0sIGxpbWl0OjF9KTtcbn0pO1xuXG5wdWJsaXNoQ29tcG9zaXRlKCdtaXNzZWRibG9ja3MudmFsaWRhdG9yJywgZnVuY3Rpb24oYWRkcmVzcywgdHlwZSl7XG4gICAgbGV0IGNvbmRpdGlvbnMgPSB7fTtcbiAgICBpZiAodHlwZSA9PSAndm90ZXInKXtcbiAgICAgICAgY29uZGl0aW9ucyA9IHtcbiAgICAgICAgICAgIHZvdGVyOiBhZGRyZXNzXG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZXtcbiAgICAgICAgY29uZGl0aW9ucyA9IHtcbiAgICAgICAgICAgIHByb3Bvc2VyOiBhZGRyZXNzXG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgICAgZmluZCgpe1xuICAgICAgICAgICAgcmV0dXJuIE1pc3NlZEJsb2Nrc1N0YXRzLmZpbmQoY29uZGl0aW9ucylcbiAgICAgICAgfSxcbiAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBmaW5kKHN0YXRzKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFZhbGlkYXRvcnMuZmluZChcbiAgICAgICAgICAgICAgICAgICAgICAgIHt9LFxuICAgICAgICAgICAgICAgICAgICAgICAge2ZpZWxkczp7YWRkcmVzczoxLCBkZXNjcmlwdGlvbjoxLCBwcm9maWxlX3VybDoxfX1cbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgXVxuICAgIH1cbn0pO1xuXG5wdWJsaXNoQ29tcG9zaXRlKCdtaXNzZWRyZWNvcmRzLnZhbGlkYXRvcicsIGZ1bmN0aW9uKGFkZHJlc3MsIHR5cGUpe1xuICAgIHJldHVybiB7XG4gICAgICAgIGZpbmQoKXtcbiAgICAgICAgICAgIHJldHVybiBNaXNzZWRCbG9ja3MuZmluZChcbiAgICAgICAgICAgICAgICB7W3R5cGVdOiBhZGRyZXNzfSxcbiAgICAgICAgICAgICAgICB7c29ydDoge3VwZGF0ZWRBdDogLTF9fVxuICAgICAgICAgICAgKVxuICAgICAgICB9LFxuICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGZpbmQoKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFZhbGlkYXRvcnMuZmluZChcbiAgICAgICAgICAgICAgICAgICAgICAgIHt9LFxuICAgICAgICAgICAgICAgICAgICAgICAge2ZpZWxkczp7YWRkcmVzczoxLCBkZXNjcmlwdGlvbjoxLCBvcGVyYXRvcl9hZGRyZXNzOjF9fVxuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICBdXG4gICAgfVxufSk7XG4iLCJpbXBvcnQgeyBNb25nbyB9IGZyb20gJ21ldGVvci9tb25nbyc7XG5pbXBvcnQgeyBWYWxpZGF0b3JzIH0gZnJvbSAnLi4vdmFsaWRhdG9ycy92YWxpZGF0b3JzJztcblxuZXhwb3J0IGNvbnN0IFZhbGlkYXRvclJlY29yZHMgPSBuZXcgTW9uZ28uQ29sbGVjdGlvbigndmFsaWRhdG9yX3JlY29yZHMnKTtcbmV4cG9ydCBjb25zdCBBbmFseXRpY3MgPSBuZXcgTW9uZ28uQ29sbGVjdGlvbignYW5hbHl0aWNzJyk7XG5leHBvcnQgY29uc3QgTWlzc2VkQmxvY2tzU3RhdHMgPSBuZXcgTW9uZ28uQ29sbGVjdGlvbignbWlzc2VkX2Jsb2Nrc19zdGF0cycpO1xuZXhwb3J0IGNvbnN0IE1pc3NlZEJsb2NrcyA9IG5ldyAgTW9uZ28uQ29sbGVjdGlvbignbWlzc2VkX2Jsb2NrcycpO1xuZXhwb3J0IGNvbnN0IFZQRGlzdHJpYnV0aW9ucyA9IG5ldyBNb25nby5Db2xsZWN0aW9uKCd2b3RpbmdfcG93ZXJfZGlzdHJpYnV0aW9ucycpO1xuZXhwb3J0IGNvbnN0IEF2ZXJhZ2VEYXRhID0gbmV3IE1vbmdvLkNvbGxlY3Rpb24oJ2F2ZXJhZ2VfZGF0YScpO1xuZXhwb3J0IGNvbnN0IEF2ZXJhZ2VWYWxpZGF0b3JEYXRhID0gbmV3IE1vbmdvLkNvbGxlY3Rpb24oJ2F2ZXJhZ2VfdmFsaWRhdG9yX2RhdGEnKTtcblxuTWlzc2VkQmxvY2tzU3RhdHMuaGVscGVycyh7XG4gICAgcHJvcG9zZXJNb25pa2VyKCl7XG4gICAgICAgIGxldCB2YWxpZGF0b3IgPSBWYWxpZGF0b3JzLmZpbmRPbmUoe2FkZHJlc3M6dGhpcy5wcm9wb3Nlcn0pO1xuICAgICAgICByZXR1cm4gKHZhbGlkYXRvci5kZXNjcmlwdGlvbik/dmFsaWRhdG9yLmRlc2NyaXB0aW9uLm1vbmlrZXI6dGhpcy5wcm9wb3NlcjtcbiAgICB9LFxuICAgIHZvdGVyTW9uaWtlcigpe1xuICAgICAgICBsZXQgdmFsaWRhdG9yID0gVmFsaWRhdG9ycy5maW5kT25lKHthZGRyZXNzOnRoaXMudm90ZXJ9KTtcbiAgICAgICAgcmV0dXJuICh2YWxpZGF0b3IuZGVzY3JpcHRpb24pP3ZhbGlkYXRvci5kZXNjcmlwdGlvbi5tb25pa2VyOnRoaXMudm90ZXI7XG4gICAgfVxufSlcbiIsImltcG9ydCB7IE1ldGVvciB9IGZyb20gJ21ldGVvci9tZXRlb3InO1xuaW1wb3J0IHsgY2hlY2sgfSBmcm9tICdtZXRlb3IvY2hlY2snXG5pbXBvcnQgeyBTdGF0dXMgfSBmcm9tICcuLi9zdGF0dXMuanMnO1xuXG5NZXRlb3IucHVibGlzaCAoJ3N0YXR1cy5zdGF0dXMnLCBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIFN0YXR1cy5maW5kICh7IGNoYWluSWQgOiBNZXRlb3Iuc2V0dGluZ3MucHVibGljLmNoYWluSWQgfSk7XG59KTtcblxuIiwiaW1wb3J0IHsgTW9uZ28gfSBmcm9tICdtZXRlb3IvbW9uZ28nO1xuXG5leHBvcnQgY29uc3QgU3RhdHVzID0gbmV3IE1vbmdvLkNvbGxlY3Rpb24oJ3N0YXR1cycpOyIsImltcG9ydCB7IE1ldGVvciB9IGZyb20gJ21ldGVvci9tZXRlb3InO1xuaW1wb3J0IHsgSFRUUCB9IGZyb20gJ21ldGVvci9odHRwJztcbmltcG9ydCB7IFRyYW5zYWN0aW9ucyB9IGZyb20gJy4uLy4uL3RyYW5zYWN0aW9ucy90cmFuc2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgVmFsaWRhdG9ycyB9IGZyb20gJy4uLy4uL3ZhbGlkYXRvcnMvdmFsaWRhdG9ycy5qcyc7XG5pbXBvcnQgeyBWb3RpbmdQb3dlckhpc3RvcnkgfSBmcm9tICcuLi8uLi92b3RpbmctcG93ZXIvaGlzdG9yeS5qcyc7XG5cbmNvbnN0IEFkZHJlc3NMZW5ndGggPSA0MDtcblxuTWV0ZW9yLm1ldGhvZHMoe1xuICAgICdUcmFuc2FjdGlvbnMuaW5kZXgnOiBmdW5jdGlvbihoYXNoLCBibG9ja1RpbWUpe1xuICAgICAgICB0aGlzLnVuYmxvY2soKTtcbiAgICAgICAgaGFzaCA9IGhhc2gudG9VcHBlckNhc2UoKTtcbiAgICAgICAgY29uc29sZS5sb2coXCJHZXQgdHg6IFwiK2hhc2gpXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgdXJsID0gTENEKyAnL3R4cy8nK2hhc2g7XG4gICAgICAgICAgICBsZXQgcmVzcG9uc2UgPSBIVFRQLmdldCh1cmwpO1xuICAgICAgICAgICAgbGV0IHR4ID0gSlNPTi5wYXJzZShyZXNwb25zZS5jb250ZW50KTtcblxuICAgICAgICAgICAgY29uc29sZS5sb2coaGFzaCk7XG5cbiAgICAgICAgICAgIHR4LmhlaWdodCA9IHBhcnNlSW50KHR4LmhlaWdodCk7XG5cbiAgICAgICAgICAgIGxldCB0eElkID0gVHJhbnNhY3Rpb25zLmluc2VydCh0eCk7XG4gICAgICAgICAgICBpZiAodHhJZCl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHR4SWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHJldHVybiBmYWxzZTtcblxuICAgICAgICB9XG4gICAgICAgIGNhdGNoKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKHVybCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhlKVxuICAgICAgICB9XG4gICAgfSxcbiAgICAnVHJhbnNhY3Rpb25zLmZpbmREZWxlZ2F0aW9uJzogZnVuY3Rpb24oYWRkcmVzcywgaGVpZ2h0KXtcbiAgICAgICAgLy8gZm9sbG93aW5nIGNvc21vcy1zZGsveC9zbGFzaGluZy9zcGVjLzA2X2V2ZW50cy5tZCBhbmQgY29zbW9zLXNkay94L3N0YWtpbmcvc3BlYy8wNl9ldmVudHMubWRcbiAgICAgICAgcmV0dXJuIFRyYW5zYWN0aW9ucy5maW5kKHtcbiAgICAgICAgICAgICAgICAkb3I6IFt7JGFuZDogW1xuICAgICAgICAgICAgICAgICAgICAgICAge1wibG9ncy5ldmVudHMudHlwZVwiOiBcImRlbGVnYXRlXCJ9LFxuICAgICAgICAgICAgICAgICAgICAgICAge1wibG9ncy5ldmVudHMuYXR0cmlidXRlcy5rZXlcIjogXCJ2YWxpZGF0b3JcIn0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7XCJsb2dzLmV2ZW50cy5hdHRyaWJ1dGVzLnZhbHVlXCI6IGFkZHJlc3N9XG4gICAgICAgICAgICAgICAgICAgIF19LCB7JGFuZDpbXG4gICAgICAgICAgICAgICAgICAgICAgICB7XCJsb2dzLmV2ZW50cy5hdHRyaWJ1dGVzLmtleVwiOiBcImFjdGlvblwifSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHtcImxvZ3MuZXZlbnRzLmF0dHJpYnV0ZXMudmFsdWVcIjogXCJ1bmphaWxcIn0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7XCJsb2dzLmV2ZW50cy5hdHRyaWJ1dGVzLmtleVwiOiBcInNlbmRlclwifSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHtcImxvZ3MuZXZlbnRzLmF0dHJpYnV0ZXMudmFsdWVcIjogYWRkcmVzc31cbiAgICAgICAgICAgICAgICAgICAgXX0sIHskYW5kOltcbiAgICAgICAgICAgICAgICAgICAgICAgIHtcImxvZ3MuZXZlbnRzLnR5cGVcIjogXCJjcmVhdGVfdmFsaWRhdG9yXCJ9LFxuICAgICAgICAgICAgICAgICAgICAgICAge1wibG9ncy5ldmVudHMuYXR0cmlidXRlcy5rZXlcIjogXCJ2YWxpZGF0b3JcIn0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7XCJsb2dzLmV2ZW50cy5hdHRyaWJ1dGVzLnZhbHVlXCI6IGFkZHJlc3N9XG4gICAgICAgICAgICAgICAgICAgIF19LCB7JGFuZDpbXG4gICAgICAgICAgICAgICAgICAgICAgICB7XCJsb2dzLmV2ZW50cy50eXBlXCI6IFwidW5ib25kXCJ9LFxuICAgICAgICAgICAgICAgICAgICAgICAge1wibG9ncy5ldmVudHMuYXR0cmlidXRlcy5rZXlcIjogXCJ2YWxpZGF0b3JcIn0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7XCJsb2dzLmV2ZW50cy5hdHRyaWJ1dGVzLnZhbHVlXCI6IGFkZHJlc3N9XG4gICAgICAgICAgICAgICAgICAgIF19LCB7JGFuZDpbXG4gICAgICAgICAgICAgICAgICAgICAgICB7XCJsb2dzLmV2ZW50cy50eXBlXCI6IFwicmVkZWxlZ2F0ZVwifSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHtcImxvZ3MuZXZlbnRzLmF0dHJpYnV0ZXMua2V5XCI6IFwiZGVzdGluYXRpb25fdmFsaWRhdG9yXCJ9LFxuICAgICAgICAgICAgICAgICAgICAgICAge1wibG9ncy5ldmVudHMuYXR0cmlidXRlcy52YWx1ZVwiOiBhZGRyZXNzfVxuICAgICAgICAgICAgICAgICAgICBdfV0sXG4gICAgICAgICAgICAgICAgXCJjb2RlXCI6IHskZXhpc3RzOiBmYWxzZX0sXG4gICAgICAgICAgICAgICAgaGVpZ2h0OnskbHQ6aGVpZ2h0fX0sXG4gICAgICAgICAgICB7c29ydDp7aGVpZ2h0Oi0xfSxcbiAgICAgICAgICAgICAgICBsaW1pdDogMX1cbiAgICAgICAgKS5mZXRjaCgpO1xuICAgIH0sXG4gICAgJ1RyYW5zYWN0aW9ucy5maW5kVXNlcic6IGZ1bmN0aW9uKGFkZHJlc3MsIGZpZWxkcz1udWxsKXtcbiAgICAgICAgLy8gYWRkcmVzcyBpcyBlaXRoZXIgZGVsZWdhdG9yIGFkZHJlc3Mgb3IgdmFsaWRhdG9yIG9wZXJhdG9yIGFkZHJlc3NcbiAgICAgICAgbGV0IHZhbGlkYXRvcjtcbiAgICAgICAgaWYgKCFmaWVsZHMpXG4gICAgICAgICAgICBmaWVsZHMgPSB7YWRkcmVzczoxLCBkZXNjcmlwdGlvbjoxLCBvcGVyYXRvcl9hZGRyZXNzOjEsIGRlbGVnYXRvcl9hZGRyZXNzOjF9O1xuICAgICAgICBpZiAoYWRkcmVzcy5pbmNsdWRlcyhNZXRlb3Iuc2V0dGluZ3MucHVibGljLmJlY2gzMlByZWZpeFZhbEFkZHIpKXtcbiAgICAgICAgICAgIC8vIHZhbGlkYXRvciBvcGVyYXRvciBhZGRyZXNzXG4gICAgICAgICAgICB2YWxpZGF0b3IgPSBWYWxpZGF0b3JzLmZpbmRPbmUoe29wZXJhdG9yX2FkZHJlc3M6YWRkcmVzc30sIHtmaWVsZHN9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChhZGRyZXNzLmluY2x1ZGVzKE1ldGVvci5zZXR0aW5ncy5wdWJsaWMuYmVjaDMyUHJlZml4QWNjQWRkcikpe1xuICAgICAgICAgICAgLy8gZGVsZWdhdG9yIGFkZHJlc3NcbiAgICAgICAgICAgIHZhbGlkYXRvciA9IFZhbGlkYXRvcnMuZmluZE9uZSh7ZGVsZWdhdG9yX2FkZHJlc3M6YWRkcmVzc30sIHtmaWVsZHN9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChhZGRyZXNzLmxlbmd0aCA9PT0gQWRkcmVzc0xlbmd0aCkge1xuICAgICAgICAgICAgdmFsaWRhdG9yID0gVmFsaWRhdG9ycy5maW5kT25lKHthZGRyZXNzOmFkZHJlc3N9LCB7ZmllbGRzfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHZhbGlkYXRvcil7XG4gICAgICAgICAgICByZXR1cm4gdmFsaWRhdG9yO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIH1cbn0pO1xuIiwiaW1wb3J0IHsgTWV0ZW9yIH0gZnJvbSAnbWV0ZW9yL21ldGVvcic7XG5pbXBvcnQgeyBUcmFuc2FjdGlvbnMgfSBmcm9tICcuLi90cmFuc2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQmxvY2tzY29uIH0gZnJvbSAnLi4vLi4vYmxvY2tzL2Jsb2Nrcy5qcyc7XG5cbnB1Ymxpc2hDb21wb3NpdGUoJ3RyYW5zYWN0aW9ucy5saXN0JywgZnVuY3Rpb24obGltaXQgPSAzMCl7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgZmluZCgpe1xuICAgICAgICAgICAgcmV0dXJuIFRyYW5zYWN0aW9ucy5maW5kKHt9LHtzb3J0OntoZWlnaHQ6LTF9LCBsaW1pdDpsaW1pdH0pXG4gICAgICAgIH0sXG4gICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZmluZCh0eCl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBCbG9ja3Njb24uZmluZChcbiAgICAgICAgICAgICAgICAgICAgICAgIHtoZWlnaHQ6dHguaGVpZ2h0fSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHtmaWVsZHM6e3RpbWU6MSwgaGVpZ2h0OjF9fVxuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICBdXG4gICAgfVxufSk7XG5cbnB1Ymxpc2hDb21wb3NpdGUoJ3RyYW5zYWN0aW9ucy52YWxpZGF0b3InLCBmdW5jdGlvbih2YWxpZGF0b3JBZGRyZXNzLCBkZWxlZ2F0b3JBZGRyZXNzLCBsaW1pdD0xMDApe1xuICAgIGxldCBxdWVyeSA9IHt9O1xuICAgIGlmICh2YWxpZGF0b3JBZGRyZXNzICYmIGRlbGVnYXRvckFkZHJlc3Mpe1xuICAgICAgICBxdWVyeSA9IHskb3I6W3tcImxvZ3MuZXZlbnRzLmF0dHJpYnV0ZXMudmFsdWVcIjp2YWxpZGF0b3JBZGRyZXNzfSwge1wibG9ncy5ldmVudHMuYXR0cmlidXRlcy52YWx1ZVwiOmRlbGVnYXRvckFkZHJlc3N9XX1cbiAgICB9XG5cbiAgICBpZiAoIXZhbGlkYXRvckFkZHJlc3MgJiYgZGVsZWdhdG9yQWRkcmVzcyl7XG4gICAgICAgIHF1ZXJ5ID0ge1wibG9ncy5ldmVudHMuYXR0cmlidXRlcy52YWx1ZVwiOmRlbGVnYXRvckFkZHJlc3N9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgZmluZCgpe1xuICAgICAgICAgICAgcmV0dXJuIFRyYW5zYWN0aW9ucy5maW5kKHF1ZXJ5LCB7c29ydDp7aGVpZ2h0Oi0xfSwgbGltaXQ6bGltaXR9KVxuICAgICAgICB9LFxuICAgICAgICBjaGlsZHJlbjpbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZmluZCh0eCl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBCbG9ja3Njb24uZmluZChcbiAgICAgICAgICAgICAgICAgICAgICAgIHtoZWlnaHQ6dHguaGVpZ2h0fSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHtmaWVsZHM6e3RpbWU6MSwgaGVpZ2h0OjF9fVxuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICBdXG4gICAgfVxufSlcblxucHVibGlzaENvbXBvc2l0ZSgndHJhbnNhY3Rpb25zLmZpbmRPbmUnLCBmdW5jdGlvbihoYXNoKXtcbiAgICByZXR1cm4ge1xuICAgICAgICBmaW5kKCl7XG4gICAgICAgICAgICByZXR1cm4gVHJhbnNhY3Rpb25zLmZpbmQoe3R4aGFzaDpoYXNofSlcbiAgICAgICAgfSxcbiAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBmaW5kKHR4KXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEJsb2Nrc2Nvbi5maW5kKFxuICAgICAgICAgICAgICAgICAgICAgICAge2hlaWdodDp0eC5oZWlnaHR9LFxuICAgICAgICAgICAgICAgICAgICAgICAge2ZpZWxkczp7dGltZToxLCBoZWlnaHQ6MX19XG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIF1cbiAgICB9XG59KVxuXG5wdWJsaXNoQ29tcG9zaXRlKCd0cmFuc2FjdGlvbnMuaGVpZ2h0JywgZnVuY3Rpb24oaGVpZ2h0KXtcbiAgICByZXR1cm4ge1xuICAgICAgICBmaW5kKCl7XG4gICAgICAgICAgICByZXR1cm4gVHJhbnNhY3Rpb25zLmZpbmQoe2hlaWdodDpoZWlnaHR9KVxuICAgICAgICB9LFxuICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGZpbmQodHgpe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gQmxvY2tzY29uLmZpbmQoXG4gICAgICAgICAgICAgICAgICAgICAgICB7aGVpZ2h0OnR4LmhlaWdodH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7ZmllbGRzOnt0aW1lOjEsIGhlaWdodDoxfX1cbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgXVxuICAgIH1cbn0pXG4iLCJpbXBvcnQgeyBNb25nbyB9IGZyb20gJ21ldGVvci9tb25nbyc7XG5pbXBvcnQgeyBCbG9ja3Njb24gfSBmcm9tICcuLi9ibG9ja3MvYmxvY2tzLmpzJztcbmltcG9ydCB7IFR4SWNvbiB9IGZyb20gJy4uLy4uL3VpL2NvbXBvbmVudHMvSWNvbnMuanN4JztcblxuZXhwb3J0IGNvbnN0IFRyYW5zYWN0aW9ucyA9IG5ldyBNb25nby5Db2xsZWN0aW9uKCd0cmFuc2FjdGlvbnMnKTtcblxuVHJhbnNhY3Rpb25zLmhlbHBlcnMoe1xuICAgIGJsb2NrKCl7XG4gICAgICAgIHJldHVybiBCbG9ja3Njb24uZmluZE9uZSh7aGVpZ2h0OnRoaXMuaGVpZ2h0fSk7XG4gICAgfVxufSkiLCJpbXBvcnQgeyBNZXRlb3IgfSBmcm9tICdtZXRlb3IvbWV0ZW9yJztcbmltcG9ydCB7IFRyYW5zYWN0aW9ucyB9IGZyb20gJy4uLy4uL3RyYW5zYWN0aW9ucy90cmFuc2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQmxvY2tzY29uIH0gZnJvbSAnLi4vLi4vYmxvY2tzL2Jsb2Nrcy5qcyc7XG5pbXBvcnQgeyBEZWxlZ2F0aW9ucyB9IGZyb20gJy4uLy4uL2RlbGVnYXRpb25zL2RlbGVnYXRpb25zLmpzJztcblxuTWV0ZW9yLm1ldGhvZHMoe1xuICAgICdWYWxpZGF0b3JzLmZpbmRDcmVhdGVWYWxpZGF0b3JUaW1lJzogZnVuY3Rpb24oYWRkcmVzcyl7XG4gICAgICAgIC8vIGxvb2sgdXAgdGhlIGNyZWF0ZSB2YWxpZGF0b3IgdGltZSB0byBjb25zaWRlciBpZiB0aGUgdmFsaWRhdG9yIGhhcyBuZXZlciB1cGRhdGVkIHRoZSBjb21taXNzaW9uXG4gICAgICAgIGxldCB0eCA9IFRyYW5zYWN0aW9ucy5maW5kT25lKHskYW5kOltcbiAgICAgICAgICAgICAgICB7XCJ0eC52YWx1ZS5tc2cudmFsdWUuZGVsZWdhdG9yX2FkZHJlc3NcIjphZGRyZXNzfSxcbiAgICAgICAgICAgICAgICB7XCJ0eC52YWx1ZS5tc2cudHlwZVwiOlwiY29zbW9zLXNkay9Nc2dDcmVhdGVWYWxpZGF0b3JcIn0sXG4gICAgICAgICAgICAgICAge2NvZGU6eyRleGlzdHM6ZmFsc2V9fVxuICAgICAgICAgICAgXX0pO1xuXG4gICAgICAgIGlmICh0eCl7XG4gICAgICAgICAgICBsZXQgYmxvY2sgPSBCbG9ja3Njb24uZmluZE9uZSh7aGVpZ2h0OnR4LmhlaWdodH0pO1xuICAgICAgICAgICAgaWYgKGJsb2NrKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gYmxvY2sudGltZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNle1xuICAgICAgICAgICAgLy8gbm8gc3VjaCBjcmVhdGUgdmFsaWRhdG9yIHR4XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIC8vIGFzeW5jICdWYWxpZGF0b3JzLmdldEFsbERlbGVnYXRpb25zJyhhZGRyZXNzKXtcbiAgICAnVmFsaWRhdG9ycy5nZXRBbGxEZWxlZ2F0aW9ucycoYWRkcmVzcyl7XG4gICAgICAgIGxldCB1cmwgPSBMQ0QgKyAnL3N0YWtpbmcvdmFsaWRhdG9ycy8nK2FkZHJlc3MrJy9kZWxlZ2F0aW9ucyc7XG5cbiAgICAgICAgdHJ5e1xuICAgICAgICAgICAgbGV0IGRlbGVnYXRpb25zID0gSFRUUC5nZXQodXJsKTtcbiAgICAgICAgICAgIGlmIChkZWxlZ2F0aW9ucy5zdGF0dXNDb2RlID09IDIwMCl7XG4gICAgICAgICAgICAgICAgZGVsZWdhdGlvbnMgPSBKU09OLnBhcnNlKGRlbGVnYXRpb25zLmNvbnRlbnQpLnJlc3VsdDtcbiAgICAgICAgICAgICAgICBkZWxlZ2F0aW9ucy5mb3JFYWNoKChkZWxlZ2F0aW9uLCBpKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkZWxlZ2F0aW9uc1tpXSAmJiBkZWxlZ2F0aW9uc1tpXS5zaGFyZXMpXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWxlZ2F0aW9uc1tpXS5zaGFyZXMgPSBwYXJzZUZsb2F0KGRlbGVnYXRpb25zW2ldLnNoYXJlcyk7XG4gICAgICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgICAgIHJldHVybiBkZWxlZ2F0aW9ucztcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGUpe1xuICAgICAgICAgICAgY29uc29sZS5sb2codXJsKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGUpO1xuICAgICAgICB9XG4gICAgfVxufSk7XG4iLCJpbXBvcnQgeyBNZXRlb3IgfSBmcm9tICdtZXRlb3IvbWV0ZW9yJztcbmltcG9ydCB7IFZhbGlkYXRvcnMgfSBmcm9tICcuLi92YWxpZGF0b3JzLmpzJztcbmltcG9ydCB7IFZhbGlkYXRvclJlY29yZHMgfSBmcm9tICcuLi8uLi9yZWNvcmRzL3JlY29yZHMuanMnO1xuaW1wb3J0IHsgVm90aW5nUG93ZXJIaXN0b3J5IH0gZnJvbSAnLi4vLi4vdm90aW5nLXBvd2VyL2hpc3RvcnkuanMnO1xuXG5NZXRlb3IucHVibGlzaCgndmFsaWRhdG9ycy5hbGwnLCBmdW5jdGlvbiAoc29ydCA9IFwiZGVzY3JpcHRpb24ubW9uaWtlclwiLCBkaXJlY3Rpb24gPSAtMSwgZmllbGRzPXt9KSB7XG4gICAgcmV0dXJuIFZhbGlkYXRvcnMuZmluZCh7fSwge3NvcnQ6IHtbc29ydF06IGRpcmVjdGlvbn0sIGZpZWxkczogZmllbGRzfSk7XG59KTtcblxucHVibGlzaENvbXBvc2l0ZSgndmFsaWRhdG9ycy5maXJzdFNlZW4nLHtcbiAgICBmaW5kKCkge1xuICAgICAgICByZXR1cm4gVmFsaWRhdG9ycy5maW5kKHt9KTtcbiAgICB9LFxuICAgIGNoaWxkcmVuOiBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIGZpbmQodmFsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFZhbGlkYXRvclJlY29yZHMuZmluZChcbiAgICAgICAgICAgICAgICAgICAgeyBhZGRyZXNzOiB2YWwuYWRkcmVzcyB9LFxuICAgICAgICAgICAgICAgICAgICB7IHNvcnQ6IHtoZWlnaHQ6IDF9LCBsaW1pdDogMX1cbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgXVxufSk7XG5cbk1ldGVvci5wdWJsaXNoKCd2YWxpZGF0b3JzLnZvdGluZ19wb3dlcicsIGZ1bmN0aW9uKCl7XG4gICAgcmV0dXJuIFZhbGlkYXRvcnMuZmluZCh7XG4gICAgICAgIHN0YXR1czogMixcbiAgICAgICAgamFpbGVkOmZhbHNlXG4gICAgfSx7XG4gICAgICAgIHNvcnQ6e1xuICAgICAgICAgICAgdm90aW5nX3Bvd2VyOi0xXG4gICAgICAgIH0sXG4gICAgICAgIGZpZWxkczp7XG4gICAgICAgICAgICBhZGRyZXNzOiAxLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246MSxcbiAgICAgICAgICAgIHZvdGluZ19wb3dlcjoxLFxuICAgICAgICAgICAgcHJvZmlsZV91cmw6MVxuICAgICAgICB9XG4gICAgfVxuICAgICk7XG59KTtcblxucHVibGlzaENvbXBvc2l0ZSgndmFsaWRhdG9yLmRldGFpbHMnLCBmdW5jdGlvbihhZGRyZXNzKXtcbiAgICBsZXQgb3B0aW9ucyA9IHthZGRyZXNzOmFkZHJlc3N9O1xuICAgIGlmIChhZGRyZXNzLmluZGV4T2YoTWV0ZW9yLnNldHRpbmdzLnB1YmxpYy5iZWNoMzJQcmVmaXhWYWxBZGRyKSAhPSAtMSl7XG4gICAgICAgIG9wdGlvbnMgPSB7b3BlcmF0b3JfYWRkcmVzczphZGRyZXNzfVxuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgICBmaW5kKCl7XG4gICAgICAgICAgICByZXR1cm4gVmFsaWRhdG9ycy5maW5kKG9wdGlvbnMpXG4gICAgICAgIH0sXG4gICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZmluZCh2YWwpe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gVm90aW5nUG93ZXJIaXN0b3J5LmZpbmQoXG4gICAgICAgICAgICAgICAgICAgICAgICB7YWRkcmVzczp2YWwuYWRkcmVzc30sXG4gICAgICAgICAgICAgICAgICAgICAgICB7c29ydDp7aGVpZ2h0Oi0xfSwgbGltaXQ6NTB9XG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGZpbmQodmFsKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBWYWxpZGF0b3JSZWNvcmRzLmZpbmQoXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGFkZHJlc3M6IHZhbC5hZGRyZXNzIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7IHNvcnQ6IHtoZWlnaHQ6IC0xfSwgbGltaXQ6IE1ldGVvci5zZXR0aW5ncy5wdWJsaWMudXB0aW1lV2luZG93fVxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgXVxuICAgIH1cbn0pO1xuIiwiaW1wb3J0IHsgTW9uZ28gfSBmcm9tICdtZXRlb3IvbW9uZ28nO1xuaW1wb3J0IHsgVmFsaWRhdG9yUmVjb3JkcyB9IGZyb20gJy4uL3JlY29yZHMvcmVjb3Jkcy5qcyc7XG5pbXBvcnQgeyBWb3RpbmdQb3dlckhpc3RvcnkgfSBmcm9tICcuLi92b3RpbmctcG93ZXIvaGlzdG9yeS5qcyc7XG5cbmV4cG9ydCBjb25zdCBWYWxpZGF0b3JzID0gbmV3IE1vbmdvLkNvbGxlY3Rpb24oJ3ZhbGlkYXRvcnMnKTtcblxuVmFsaWRhdG9ycy5oZWxwZXJzKHtcbiAgICBmaXJzdFNlZW4oKXtcbiAgICAgICAgcmV0dXJuIFZhbGlkYXRvclJlY29yZHMuZmluZE9uZSh7YWRkcmVzczp0aGlzLmFkZHJlc3N9KTtcbiAgICB9LFxuICAgIGhpc3RvcnkoKXtcbiAgICAgICAgcmV0dXJuIFZvdGluZ1Bvd2VySGlzdG9yeS5maW5kKHthZGRyZXNzOnRoaXMuYWRkcmVzc30sIHtzb3J0OntoZWlnaHQ6LTF9LCBsaW1pdDo1MH0pLmZldGNoKCk7XG4gICAgfVxufSlcbi8vIFZhbGlkYXRvcnMuaGVscGVycyh7XG4vLyAgICAgdXB0aW1lKCl7XG4vLyAgICAgICAgIC8vIGNvbnNvbGUubG9nKHRoaXMuYWRkcmVzcyk7XG4vLyAgICAgICAgIGxldCBsYXN0SHVuZHJlZCA9IFZhbGlkYXRvclJlY29yZHMuZmluZCh7YWRkcmVzczp0aGlzLmFkZHJlc3N9LCB7c29ydDp7aGVpZ2h0Oi0xfSwgbGltaXQ6MTAwfSkuZmV0Y2goKTtcbi8vICAgICAgICAgY29uc29sZS5sb2cobGFzdEh1bmRyZWQpO1xuLy8gICAgICAgICBsZXQgdXB0aW1lID0gMDtcbi8vICAgICAgICAgZm9yIChpIGluIGxhc3RIdW5kcmVkKXtcbi8vICAgICAgICAgICAgIGlmIChsYXN0SHVuZHJlZFtpXS5leGlzdHMpe1xuLy8gICAgICAgICAgICAgICAgIHVwdGltZSs9MTtcbi8vICAgICAgICAgICAgIH1cbi8vICAgICAgICAgfVxuLy8gICAgICAgICByZXR1cm4gdXB0aW1lO1xuLy8gICAgIH1cbi8vIH0pIiwiaW1wb3J0IHsgTW9uZ28gfSBmcm9tICdtZXRlb3IvbW9uZ28nO1xuXG5leHBvcnQgY29uc3QgVm90aW5nUG93ZXJIaXN0b3J5ID0gbmV3IE1vbmdvLkNvbGxlY3Rpb24oJ3ZvdGluZ19wb3dlcl9oaXN0b3J5Jyk7XG4iLCJpbXBvcnQgeyBNb25nbyB9IGZyb20gJ21ldGVvci9tb25nbyc7XG5cbmV4cG9ydCBjb25zdCBFdmlkZW5jZXMgPSBuZXcgTW9uZ28uQ29sbGVjdGlvbignZXZpZGVuY2VzJyk7XG4iLCJpbXBvcnQgeyBNb25nbyB9IGZyb20gJ21ldGVvci9tb25nbyc7XG5cbmV4cG9ydCBjb25zdCBWYWxpZGF0b3JTZXRzID0gbmV3IE1vbmdvLkNvbGxlY3Rpb24oJ3ZhbGlkYXRvcl9zZXRzJyk7XG4iLCIvLyBJbXBvcnQgbW9kdWxlcyB1c2VkIGJ5IGJvdGggY2xpZW50IGFuZCBzZXJ2ZXIgdGhyb3VnaCBhIHNpbmdsZSBpbmRleCBlbnRyeSBwb2ludFxuLy8gZS5nLiB1c2VyYWNjb3VudHMgY29uZmlndXJhdGlvbiBmaWxlLlxuIiwiaW1wb3J0IHsgQmxvY2tzY29uIH0gZnJvbSAnLi4vLi4vYXBpL2Jsb2Nrcy9ibG9ja3MuanMnO1xuaW1wb3J0IHsgUHJvcG9zYWxzIH0gZnJvbSAnLi4vLi4vYXBpL3Byb3Bvc2Fscy9wcm9wb3NhbHMuanMnO1xuaW1wb3J0IHsgVmFsaWRhdG9yUmVjb3JkcywgQW5hbHl0aWNzLCBNaXNzZWRCbG9ja3NTdGF0cywgTWlzc2VkQmxvY2tzLCBBdmVyYWdlRGF0YSwgQXZlcmFnZVZhbGlkYXRvckRhdGEgfSBmcm9tICcuLi8uLi9hcGkvcmVjb3Jkcy9yZWNvcmRzLmpzJztcbi8vIGltcG9ydCB7IFN0YXR1cyB9IGZyb20gJy4uLy4uL2FwaS9zdGF0dXMvc3RhdHVzLmpzJztcbmltcG9ydCB7IFRyYW5zYWN0aW9ucyB9IGZyb20gJy4uLy4uL2FwaS90cmFuc2FjdGlvbnMvdHJhbnNhY3Rpb25zLmpzJztcbmltcG9ydCB7IFZhbGlkYXRvclNldHMgfSBmcm9tICcuLi8uLi9hcGkvdmFsaWRhdG9yLXNldHMvdmFsaWRhdG9yLXNldHMuanMnO1xuaW1wb3J0IHsgVmFsaWRhdG9ycyB9IGZyb20gJy4uLy4uL2FwaS92YWxpZGF0b3JzL3ZhbGlkYXRvcnMuanMnO1xuaW1wb3J0IHsgVm90aW5nUG93ZXJIaXN0b3J5IH0gZnJvbSAnLi4vLi4vYXBpL3ZvdGluZy1wb3dlci9oaXN0b3J5LmpzJztcbmltcG9ydCB7IEV2aWRlbmNlcyB9IGZyb20gJy4uLy4uL2FwaS9ldmlkZW5jZXMvZXZpZGVuY2VzLmpzJztcbmltcG9ydCB7IENvaW5TdGF0cyB9IGZyb20gJy4uLy4uL2FwaS9jb2luLXN0YXRzL2NvaW4tc3RhdHMuanMnO1xuaW1wb3J0IHsgQ2hhaW5TdGF0ZXMgfSBmcm9tICcuLi8uLi9hcGkvY2hhaW4vY2hhaW4uanMnO1xuXG5DaGFpblN0YXRlcy5yYXdDb2xsZWN0aW9uKCkuY3JlYXRlSW5kZXgoe2hlaWdodDogLTF9LHt1bmlxdWU6dHJ1ZX0pO1xuXG5CbG9ja3Njb24ucmF3Q29sbGVjdGlvbigpLmNyZWF0ZUluZGV4KHtoZWlnaHQ6IC0xfSx7dW5pcXVlOnRydWV9KTtcbkJsb2Nrc2Nvbi5yYXdDb2xsZWN0aW9uKCkuY3JlYXRlSW5kZXgoe3Byb3Bvc2VyQWRkcmVzczoxfSk7XG5cbkV2aWRlbmNlcy5yYXdDb2xsZWN0aW9uKCkuY3JlYXRlSW5kZXgoe2hlaWdodDogLTF9KTtcblxuUHJvcG9zYWxzLnJhd0NvbGxlY3Rpb24oKS5jcmVhdGVJbmRleCh7cHJvcG9zYWxJZDogMX0sIHt1bmlxdWU6dHJ1ZX0pO1xuXG5WYWxpZGF0b3JSZWNvcmRzLnJhd0NvbGxlY3Rpb24oKS5jcmVhdGVJbmRleCh7YWRkcmVzczoxLGhlaWdodDogLTF9LCB7dW5pcXVlOjF9KTtcblZhbGlkYXRvclJlY29yZHMucmF3Q29sbGVjdGlvbigpLmNyZWF0ZUluZGV4KHthZGRyZXNzOjEsZXhpc3RzOjEsIGhlaWdodDogLTF9KTtcblxuQW5hbHl0aWNzLnJhd0NvbGxlY3Rpb24oKS5jcmVhdGVJbmRleCh7aGVpZ2h0OiAtMX0sIHt1bmlxdWU6dHJ1ZX0pXG5cbk1pc3NlZEJsb2Nrcy5yYXdDb2xsZWN0aW9uKCkuY3JlYXRlSW5kZXgoe3Byb3Bvc2VyOjEsIHZvdGVyOjEsIHVwZGF0ZWRBdDogLTF9KTtcbk1pc3NlZEJsb2Nrcy5yYXdDb2xsZWN0aW9uKCkuY3JlYXRlSW5kZXgoe3Byb3Bvc2VyOjEsIGJsb2NrSGVpZ2h0Oi0xfSk7XG5NaXNzZWRCbG9ja3MucmF3Q29sbGVjdGlvbigpLmNyZWF0ZUluZGV4KHt2b3RlcjoxLCBibG9ja0hlaWdodDotMX0pO1xuTWlzc2VkQmxvY2tzLnJhd0NvbGxlY3Rpb24oKS5jcmVhdGVJbmRleCh7dm90ZXI6MSwgcHJvcG9zZXI6MSwgYmxvY2tIZWlnaHQ6LTF9LCB7dW5pcXVlOnRydWV9KTtcblxuTWlzc2VkQmxvY2tzU3RhdHMucmF3Q29sbGVjdGlvbigpLmNyZWF0ZUluZGV4KHtwcm9wb3NlcjoxfSk7XG5NaXNzZWRCbG9ja3NTdGF0cy5yYXdDb2xsZWN0aW9uKCkuY3JlYXRlSW5kZXgoe3ZvdGVyOjF9KTtcbk1pc3NlZEJsb2Nrc1N0YXRzLnJhd0NvbGxlY3Rpb24oKS5jcmVhdGVJbmRleCh7cHJvcG9zZXI6MSwgdm90ZXI6MX0se3VuaXF1ZTp0cnVlfSk7XG5cbkF2ZXJhZ2VEYXRhLnJhd0NvbGxlY3Rpb24oKS5jcmVhdGVJbmRleCh7dHlwZToxLCBjcmVhdGVkQXQ6LTF9LHt1bmlxdWU6dHJ1ZX0pO1xuQXZlcmFnZVZhbGlkYXRvckRhdGEucmF3Q29sbGVjdGlvbigpLmNyZWF0ZUluZGV4KHtwcm9wb3NlckFkZHJlc3M6MSxjcmVhdGVkQXQ6LTF9LHt1bmlxdWU6dHJ1ZX0pO1xuLy8gU3RhdHVzLnJhd0NvbGxlY3Rpb24uY3JlYXRlSW5kZXgoe30pXG5cblRyYW5zYWN0aW9ucy5yYXdDb2xsZWN0aW9uKCkuY3JlYXRlSW5kZXgoe3R4aGFzaDoxfSx7dW5pcXVlOnRydWV9KTtcblRyYW5zYWN0aW9ucy5yYXdDb2xsZWN0aW9uKCkuY3JlYXRlSW5kZXgoe2hlaWdodDotMX0pO1xuLy8gVHJhbnNhY3Rpb25zLnJhd0NvbGxlY3Rpb24oKS5jcmVhdGVJbmRleCh7YWN0aW9uOjF9KTtcblRyYW5zYWN0aW9ucy5yYXdDb2xsZWN0aW9uKCkuY3JlYXRlSW5kZXgoe1wiZXZlbnRzLmF0dHJpYnV0ZXMua2V5XCI6MX0pO1xuVHJhbnNhY3Rpb25zLnJhd0NvbGxlY3Rpb24oKS5jcmVhdGVJbmRleCh7XCJldmVudHMuYXR0cmlidXRlcy52YWx1ZVwiOjF9KTtcblxuVmFsaWRhdG9yU2V0cy5yYXdDb2xsZWN0aW9uKCkuY3JlYXRlSW5kZXgoe2Jsb2NrX2hlaWdodDotMX0pO1xuXG5WYWxpZGF0b3JzLnJhd0NvbGxlY3Rpb24oKS5jcmVhdGVJbmRleCh7YWRkcmVzczoxfSx7dW5pcXVlOnRydWUsIHBhcnRpYWxGaWx0ZXJFeHByZXNzaW9uOiB7IGFkZHJlc3M6IHsgJGV4aXN0czogdHJ1ZSB9IH0gfSk7XG5WYWxpZGF0b3JzLnJhd0NvbGxlY3Rpb24oKS5jcmVhdGVJbmRleCh7Y29uc2Vuc3VzX3B1YmtleToxfSx7dW5pcXVlOnRydWV9KTtcblZhbGlkYXRvcnMucmF3Q29sbGVjdGlvbigpLmNyZWF0ZUluZGV4KHtcInB1Yl9rZXkudmFsdWVcIjoxfSx7dW5pcXVlOnRydWUsIHBhcnRpYWxGaWx0ZXJFeHByZXNzaW9uOiB7IFwicHViX2tleS52YWx1ZVwiOiB7ICRleGlzdHM6IHRydWUgfSB9fSk7XG5cblZvdGluZ1Bvd2VySGlzdG9yeS5yYXdDb2xsZWN0aW9uKCkuY3JlYXRlSW5kZXgoe2FkZHJlc3M6MSxoZWlnaHQ6LTF9KTtcblZvdGluZ1Bvd2VySGlzdG9yeS5yYXdDb2xsZWN0aW9uKCkuY3JlYXRlSW5kZXgoe3R5cGU6MX0pO1xuXG5Db2luU3RhdHMucmF3Q29sbGVjdGlvbigpLmNyZWF0ZUluZGV4KHtsYXN0X3VwZGF0ZWRfYXQ6LTF9LHt1bmlxdWU6dHJ1ZX0pO1xuIiwiLy8gSW1wb3J0IHNlcnZlciBzdGFydHVwIHRocm91Z2ggYSBzaW5nbGUgaW5kZXggZW50cnkgcG9pbnRcblxuaW1wb3J0ICcuL3V0aWwuanMnO1xuaW1wb3J0ICcuL3JlZ2lzdGVyLWFwaS5qcyc7XG5pbXBvcnQgJy4vY3JlYXRlLWluZGV4ZXMuanMnO1xuXG4vLyBpbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnO1xuLy8gaW1wb3J0IHsgcmVuZGVyVG9Ob2RlU3RyZWFtIH0gZnJvbSAncmVhY3QtZG9tL3NlcnZlcic7XG4vLyBpbXBvcnQgeyByZW5kZXJUb1N0cmluZyB9IGZyb20gXCJyZWFjdC1kb20vc2VydmVyXCI7XG5pbXBvcnQgeyBvblBhZ2VMb2FkIH0gZnJvbSAnbWV0ZW9yL3NlcnZlci1yZW5kZXInO1xuLy8gaW1wb3J0IHsgU3RhdGljUm91dGVyIH0gZnJvbSAncmVhY3Qtcm91dGVyLWRvbSc7XG4vLyBpbXBvcnQgeyBTZXJ2ZXJTdHlsZVNoZWV0IH0gZnJvbSBcInN0eWxlZC1jb21wb25lbnRzXCJcbmltcG9ydCB7IEhlbG1ldCB9IGZyb20gJ3JlYWN0LWhlbG1ldCc7XG5cbi8vIGltcG9ydCBBcHAgZnJvbSAnLi4vLi4vdWkvQXBwLmpzeCc7XG5cbm9uUGFnZUxvYWQoc2luayA9PiB7XG4gICAgLy8gY29uc3QgY29udGV4dCA9IHt9O1xuICAgIC8vIGNvbnN0IHNoZWV0ID0gbmV3IFNlcnZlclN0eWxlU2hlZXQoKVxuXG4gICAgLy8gY29uc3QgaHRtbCA9IHJlbmRlclRvU3RyaW5nKHNoZWV0LmNvbGxlY3RTdHlsZXMoXG4gICAgLy8gICAgIDxTdGF0aWNSb3V0ZXIgbG9jYXRpb249e3NpbmsucmVxdWVzdC51cmx9IGNvbnRleHQ9e2NvbnRleHR9PlxuICAgIC8vICAgICAgICAgPEFwcCAvPlxuICAgIC8vICAgICA8L1N0YXRpY1JvdXRlcj5cbiAgICAvLyAgICkpO1xuXG4gICAgLy8gc2luay5yZW5kZXJJbnRvRWxlbWVudEJ5SWQoJ2FwcCcsIGh0bWwpO1xuXG4gICAgY29uc3QgaGVsbWV0ID0gSGVsbWV0LnJlbmRlclN0YXRpYygpO1xuICAgIHNpbmsuYXBwZW5kVG9IZWFkKGhlbG1ldC5tZXRhLnRvU3RyaW5nKCkpO1xuICAgIHNpbmsuYXBwZW5kVG9IZWFkKGhlbG1ldC50aXRsZS50b1N0cmluZygpKTtcblxuICAgIC8vIHNpbmsuYXBwZW5kVG9IZWFkKHNoZWV0LmdldFN0eWxlVGFncygpKTtcbn0pOyIsIi8vIFJlZ2lzdGVyIHlvdXIgYXBpcyBoZXJlXG5cbmltcG9ydCAnLi4vLi4vYXBpL2xlZGdlci9zZXJ2ZXIvbWV0aG9kcy5qcyc7XG5cbmltcG9ydCAnLi4vLi4vYXBpL2NoYWluL3NlcnZlci9tZXRob2RzLmpzJztcbmltcG9ydCAnLi4vLi4vYXBpL2NoYWluL3NlcnZlci9wdWJsaWNhdGlvbnMuanMnO1xuXG5pbXBvcnQgJy4uLy4uL2FwaS9ibG9ja3Mvc2VydmVyL21ldGhvZHMuanMnO1xuaW1wb3J0ICcuLi8uLi9hcGkvYmxvY2tzL3NlcnZlci9wdWJsaWNhdGlvbnMuanMnO1xuXG5pbXBvcnQgJy4uLy4uL2FwaS92YWxpZGF0b3JzL3NlcnZlci9tZXRob2RzLmpzJztcbmltcG9ydCAnLi4vLi4vYXBpL3ZhbGlkYXRvcnMvc2VydmVyL3B1YmxpY2F0aW9ucy5qcyc7XG5cbmltcG9ydCAnLi4vLi4vYXBpL3JlY29yZHMvc2VydmVyL21ldGhvZHMuanMnO1xuaW1wb3J0ICcuLi8uLi9hcGkvcmVjb3Jkcy9zZXJ2ZXIvcHVibGljYXRpb25zLmpzJztcblxuaW1wb3J0ICcuLi8uLi9hcGkvcHJvcG9zYWxzL3NlcnZlci9tZXRob2RzLmpzJztcbmltcG9ydCAnLi4vLi4vYXBpL3Byb3Bvc2Fscy9zZXJ2ZXIvcHVibGljYXRpb25zLmpzJztcblxuaW1wb3J0ICcuLi8uLi9hcGkvdm90aW5nLXBvd2VyL3NlcnZlci9wdWJsaWNhdGlvbnMuanMnO1xuXG5pbXBvcnQgJy4uLy4uL2FwaS90cmFuc2FjdGlvbnMvc2VydmVyL21ldGhvZHMuanMnO1xuaW1wb3J0ICcuLi8uLi9hcGkvdHJhbnNhY3Rpb25zL3NlcnZlci9wdWJsaWNhdGlvbnMuanMnO1xuXG5pbXBvcnQgJy4uLy4uL2FwaS9kZWxlZ2F0aW9ucy9zZXJ2ZXIvbWV0aG9kcy5qcyc7XG5pbXBvcnQgJy4uLy4uL2FwaS9kZWxlZ2F0aW9ucy9zZXJ2ZXIvcHVibGljYXRpb25zLmpzJztcblxuaW1wb3J0ICcuLi8uLi9hcGkvc3RhdHVzL3NlcnZlci9wdWJsaWNhdGlvbnMuanMnO1xuXG5pbXBvcnQgJy4uLy4uL2FwaS9hY2NvdW50cy9zZXJ2ZXIvbWV0aG9kcy5qcyc7XG5cbmltcG9ydCAnLi4vLi4vYXBpL2NvaW4tc3RhdHMvc2VydmVyL21ldGhvZHMuanMnO1xuXG5jb25zb2xlLmxvZyhcIj09PT09IHJlZ2lzdGVyIGFwaSBkb25lID09PT09XCIpO1xuIiwiaW1wb3J0IGJlY2gzMiBmcm9tICdiZWNoMzInXG5pbXBvcnQgeyBIVFRQIH0gZnJvbSAnbWV0ZW9yL2h0dHAnO1xuaW1wb3J0ICogYXMgY2hlZXJpbyBmcm9tICdjaGVlcmlvJztcblxuLy8gTG9hZCBmdXR1cmUgZnJvbSBmaWJlcnNcbnZhciBGdXR1cmUgPSBOcG0ucmVxdWlyZShcImZpYmVycy9mdXR1cmVcIik7XG4vLyBMb2FkIGV4ZWNcbnZhciBleGVjID0gTnBtLnJlcXVpcmUoXCJjaGlsZF9wcm9jZXNzXCIpLmV4ZWM7XG5cbmZ1bmN0aW9uIHRvSGV4U3RyaW5nKGJ5dGVBcnJheSkge1xuICAgIHJldHVybiBieXRlQXJyYXkubWFwKGZ1bmN0aW9uKGJ5dGUpIHtcbiAgICAgICAgcmV0dXJuICgnMCcgKyAoYnl0ZSAmIDB4RkYpLnRvU3RyaW5nKDE2KSkuc2xpY2UoLTIpO1xuICAgIH0pLmpvaW4oJycpXG59XG5cbk1ldGVvci5tZXRob2RzKHtcbiAgICBwdWJrZXlUb0JlY2gzMjogZnVuY3Rpb24ocHVia2V5LCBwcmVmaXgpIHtcbiAgICAgICAgbGV0IHB1YmtleUFtaW5vUHJlZml4ID0gQnVmZmVyLmZyb20oJzE2MjRERTY0MjAnLCAnaGV4JylcbiAgICAgICAgbGV0IGJ1ZmZlciA9IEJ1ZmZlci5hbGxvYygzNylcbiAgICAgICAgcHVia2V5QW1pbm9QcmVmaXguY29weShidWZmZXIsIDApXG4gICAgICAgIEJ1ZmZlci5mcm9tKHB1YmtleS52YWx1ZSwgJ2Jhc2U2NCcpLmNvcHkoYnVmZmVyLCBwdWJrZXlBbWlub1ByZWZpeC5sZW5ndGgpXG4gICAgICAgIHJldHVybiBiZWNoMzIuZW5jb2RlKHByZWZpeCwgYmVjaDMyLnRvV29yZHMoYnVmZmVyKSlcbiAgICB9LFxuICAgIGJlY2gzMlRvUHVia2V5OiBmdW5jdGlvbihwdWJrZXkpIHtcbiAgICAgICAgbGV0IHB1YmtleUFtaW5vUHJlZml4ID0gQnVmZmVyLmZyb20oJzE2MjRERTY0MjAnLCAnaGV4JylcbiAgICAgICAgbGV0IGJ1ZmZlciA9IEJ1ZmZlci5mcm9tKGJlY2gzMi5mcm9tV29yZHMoYmVjaDMyLmRlY29kZShwdWJrZXkpLndvcmRzKSk7XG4gICAgICAgIHJldHVybiBidWZmZXIuc2xpY2UocHVia2V5QW1pbm9QcmVmaXgubGVuZ3RoKS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgfSxcbiAgICBnZXREZWxlZ2F0b3I6IGZ1bmN0aW9uKG9wZXJhdG9yQWRkcil7XG4gICAgICAgIGxldCBhZGRyZXNzID0gYmVjaDMyLmRlY29kZShvcGVyYXRvckFkZHIpO1xuICAgICAgICByZXR1cm4gYmVjaDMyLmVuY29kZShNZXRlb3Iuc2V0dGluZ3MucHVibGljLmJlY2gzMlByZWZpeEFjY0FkZHIsIGFkZHJlc3Mud29yZHMpO1xuICAgIH0sXG4gICAgZ2V0S2V5YmFzZVRlYW1QaWM6IGZ1bmN0aW9uKGtleWJhc2VVcmwpe1xuICAgICAgICBsZXQgdGVhbVBhZ2UgPSBIVFRQLmdldChrZXliYXNlVXJsKTtcbiAgICAgICAgaWYgKHRlYW1QYWdlLnN0YXR1c0NvZGUgPT0gMjAwKXtcbiAgICAgICAgICAgIGxldCBwYWdlID0gY2hlZXJpby5sb2FkKHRlYW1QYWdlLmNvbnRlbnQpO1xuICAgICAgICAgICAgcmV0dXJuIHBhZ2UoXCIua2ItbWFpbi1jYXJkIGltZ1wiKS5hdHRyKCdzcmMnKTtcbiAgICAgICAgfVxuICAgIH1cbn0pXG4iLCJpbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnO1xuaW1wb3J0IHsgVW5jb250cm9sbGVkVG9vbHRpcCB9IGZyb20gJ3JlYWN0c3RyYXAnO1xuXG5leHBvcnQgY29uc3QgRGVub21TeW1ib2wgPSAocHJvcHMpID0+IHtcbiAgICBzd2l0Y2ggKHByb3BzLmRlbm9tKSB7XG4gICAgICAgIGNhc2UgXCJkb2xsYXJcIjpcbiAgICAgICAgICAgIHJldHVybiAnRE9MTEFSJztcbiAgICAgICAgY2FzZSBcIm1kYXBcIjpcbiAgICAgICAgICAgIHJldHVybiAnbURBUCc7XG4gICAgICAgIGNhc2UgXCJzdGVha1wiOlxuICAgICAgICAgICAgcmV0dXJuICfwn6WpJztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiAn8J+NhSc7XG4gICAgfVxufVxuXG5leHBvcnQgY29uc3QgUHJvcG9zYWxTdGF0dXNJY29uID0gKHByb3BzKSA9PiB7XG4gICAgc3dpdGNoIChwcm9wcy5zdGF0dXMpIHtcbiAgICAgICAgY2FzZSAnUGFzc2VkJzpcbiAgICAgICAgICAgIHJldHVybiA8aSBjbGFzc05hbWU9XCJmYXMgZmEtY2hlY2stY2lyY2xlIHRleHQtc3VjY2Vzc1wiPjwvaT47XG4gICAgICAgIGNhc2UgJ1JlamVjdGVkJzpcbiAgICAgICAgICAgIHJldHVybiA8aSBjbGFzc05hbWU9XCJmYXMgZmEtdGltZXMtY2lyY2xlIHRleHQtZGFuZ2VyXCI+PC9pPjtcbiAgICAgICAgY2FzZSAnUmVtb3ZlZCc6XG4gICAgICAgICAgICByZXR1cm4gPGkgY2xhc3NOYW1lPVwiZmFzIGZhLXRyYXNoLWFsdCB0ZXh0LWRhcmtcIj48L2k+XG4gICAgICAgIGNhc2UgJ0RlcG9zaXRQZXJpb2QnOlxuICAgICAgICAgICAgcmV0dXJuIDxpIGNsYXNzTmFtZT1cImZhcyBmYS1iYXR0ZXJ5LWhhbGYgdGV4dC13YXJuaW5nXCI+PC9pPjtcbiAgICAgICAgY2FzZSAnVm90aW5nUGVyaW9kJzpcbiAgICAgICAgICAgIHJldHVybiA8aSBjbGFzc05hbWU9XCJmYXMgZmEtaGFuZC1wYXBlciB0ZXh0LWluZm9cIj48L2k+O1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgcmV0dXJuIDxpPjwvaT47XG4gICAgfVxufVxuXG5leHBvcnQgY29uc3QgVm90ZUljb24gPSAocHJvcHMpID0+IHtcbiAgICBzd2l0Y2ggKHByb3BzLnZvdGUpIHtcbiAgICAgICAgY2FzZSAneWVzJzpcbiAgICAgICAgICAgIHJldHVybiA8aSBjbGFzc05hbWU9XCJmYXMgZmEtY2hlY2sgdGV4dC1zdWNjZXNzXCI+PC9pPjtcbiAgICAgICAgY2FzZSAnbm8nOlxuICAgICAgICAgICAgcmV0dXJuIDxpIGNsYXNzTmFtZT1cImZhcyBmYS10aW1lcyB0ZXh0LWRhbmdlclwiPjwvaT47XG4gICAgICAgIGNhc2UgJ2Fic3RhaW4nOlxuICAgICAgICAgICAgcmV0dXJuIDxpIGNsYXNzTmFtZT1cImZhcyBmYS11c2VyLXNsYXNoIHRleHQtd2FybmluZ1wiPjwvaT47XG4gICAgICAgIGNhc2UgJ25vX3dpdGhfdmV0byc6XG4gICAgICAgICAgICByZXR1cm4gPGkgY2xhc3NOYW1lPVwiZmFzIGZhLWV4Y2xhbWF0aW9uLXRyaWFuZ2xlIHRleHQtaW5mb1wiPjwvaT47XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICByZXR1cm4gPGk+PC9pPjtcbiAgICB9XG59XG5cbmV4cG9ydCBjb25zdCBUeEljb24gPSAocHJvcHMpID0+IHtcbiAgICBpZiAocHJvcHMudmFsaWQpIHtcbiAgICAgICAgcmV0dXJuIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtc3VjY2VzcyB0ZXh0LW5vd3JhcFwiPjxpIGNsYXNzTmFtZT1cImZhcyBmYS1jaGVjay1jaXJjbGVcIj48L2k+PC9zcGFuPjtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHJldHVybiA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LWRhbmdlciB0ZXh0LW5vd3JhcFwiPjxpIGNsYXNzTmFtZT1cImZhcyBmYS10aW1lcy1jaXJjbGVcIj48L2k+PC9zcGFuPjtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBJbmZvSWNvbiBleHRlbmRzIFJlYWN0LkNvbXBvbmVudCB7XG4gICAgY29uc3RydWN0b3IgKHByb3BzKSB7XG4gICAgICAgIHN1cGVyIChwcm9wcyk7XG4gICAgICAgIHRoaXMucmVmID0gUmVhY3QuY3JlYXRlUmVmICgpO1xuICAgIH1cblxuICAgIHJlbmRlciAoKSB7XG4gICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICA8aSBrZXk9J2ljb24nIGNsYXNzTmFtZT0nbWF0ZXJpYWwtaWNvbnMgaW5mby1pY29uJyByZWY9e3RoaXMucmVmfT5pbmZvPC9pPixcbiAgICAgICAgICAgIDxVbmNvbnRyb2xsZWRUb29sdGlwIGtleT0ndG9vbHRpcCcgcGxhY2VtZW50PSdyaWdodCcgdGFyZ2V0PXt0aGlzLnJlZn0+XG4gICAgICAgICAgICAgICAge3RoaXMucHJvcHMuY2hpbGRyZW4gPyB0aGlzLnByb3BzLmNoaWxkcmVuIDogdGhpcy5wcm9wcy50b29sdGlwVGV4dH1cbiAgICAgICAgICAgIDwvVW5jb250cm9sbGVkVG9vbHRpcD5cbiAgICAgICAgXVxuICAgIH1cbn1cbiIsImltcG9ydCB7IE1ldGVvciB9IGZyb20gJ21ldGVvci9tZXRlb3InO1xuaW1wb3J0IG51bWJybyBmcm9tICdudW1icm8nO1xuXG5hdXRvZm9ybWF0ID0gKHZhbHVlKSA9PiB7XG4gICAgbGV0IGZvcm1hdHRlciA9ICcwLDAuMDAwMCc7XG4gICAgdmFsdWUgPSBNYXRoLnJvdW5kICh2YWx1ZSAqIDEwMDApIC8gMTAwMDtcbiAgICBpZiAoTWF0aC5yb3VuZCAodmFsdWUpID09PSB2YWx1ZSlcbiAgICAgICAgZm9ybWF0dGVyID0gJzAsMCdcbiAgICBlbHNlIGlmIChNYXRoLnJvdW5kICh2YWx1ZSAqIDEwKSA9PT0gdmFsdWUgKiAxMClcbiAgICAgICAgZm9ybWF0dGVyID0gJzAsMC4wJ1xuICAgIGVsc2UgaWYgKE1hdGgucm91bmQgKHZhbHVlICogMTAwKSA9PT0gdmFsdWUgKiAxMDApXG4gICAgICAgIGZvcm1hdHRlciA9ICcwLDAuMDAnXG4gICAgZWxzZSBpZiAoTWF0aC5yb3VuZCAodmFsdWUgKiAxMDAwKSA9PT0gdmFsdWUgKiAxMDAwKVxuICAgICAgICBmb3JtYXR0ZXIgPSAnMCwwLjAwMCdcbiAgICByZXR1cm4gbnVtYnJvICh2YWx1ZSkuZm9ybWF0IChmb3JtYXR0ZXIpXG59XG5cbmNvbnN0IGNvaW5MaXN0ID0gTWV0ZW9yLnNldHRpbmdzLnB1YmxpYy5jb2lucztcbmZvciAobGV0IGkgaW4gY29pbkxpc3QpIHtcbiAgICBjb25zdCBjb2luID0gY29pbkxpc3RbaV07XG4gICAgaWYgKCFjb2luLmRpc3BsYXlOYW1lUGx1cmFsKSB7XG4gICAgICAgIGNvaW4uZGlzcGxheU5hbWVQbHVyYWwgPSBjb2luLmRpc3BsYXlOYW1lICsgJ3MnO1xuICAgIH1cbn1cblxuY29uc3QgZGlnaXRhbE1vbmV5ID0gZnVuY3Rpb24gKG4sIG5vbSkge1xuICAgIGNvbnN0IGZyYWN0aW9uID0gWyfop5InLCAn5YiGJ107XG4gICAgY29uc3QgZGlnaXQgPSBbXG4gICAgICAgICfpm7YnLCAn5aO5JywgJ+i0sCcsICflj4EnLCAn6IKGJyxcbiAgICAgICAgJ+S8jScsICfpmYYnLCAn5p+SJywgJ+aNjCcsICfnjpYnXG4gICAgXTtcbiAgICBjb25zdCB1bml0ID0gW1xuICAgICAgICBbJ+WFgycsICfkuIcnLCAn5Lq/J10sXG4gICAgICAgIFsnJywgJ+aLvicsICfkvbAnLCAn5LufJ11cbiAgICBdO1xuICAgIGNvbnN0IGhlYWQgPSBuIDwgMCA/ICfmrKAnIDogJyc7XG4gICAgbiA9IE1hdGguYWJzIChuKTtcbiAgICBsZXQgcyA9ICcnO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZnJhY3Rpb24ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcyArPSAoZGlnaXRbTWF0aC5mbG9vciAobiAqIDEwICogTWF0aC5wb3cgKDEwLCBpKSkgJSAxMF0gKyBmcmFjdGlvbltpXSkucmVwbGFjZSAoL+mbti4vLCAnJyk7XG4gICAgfVxuICAgIHMgPSBzIHx8ICfmlbQnO1xuICAgIG4gPSBNYXRoLmZsb29yIChuKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHVuaXRbMF0ubGVuZ3RoICYmIG4gPiAwOyBpKyspIHtcbiAgICAgICAgbGV0IHAgPSAnJztcbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCB1bml0WzFdLmxlbmd0aCAmJiBuID4gMDsgaisrKSB7XG4gICAgICAgICAgICBwID0gZGlnaXRbbiAlIDEwXSArIHVuaXRbMV1bal0gKyBwO1xuICAgICAgICAgICAgbiA9IE1hdGguZmxvb3IgKG4gLyAxMCk7XG4gICAgICAgIH1cbiAgICAgICAgcyA9IHAucmVwbGFjZSAoLyjpm7YuKSrpm7YkLywgJycpLnJlcGxhY2UgKC9eJC8sICfpm7YnKSArIHVuaXRbMF1baV0gKyBzO1xuICAgIH1cbiAgICByZXR1cm4gaGVhZCArIHMucmVwbGFjZSAoLyjpm7YuKSrpm7blhYMvLCAn5YWDJylcbiAgICAgICAgLnJlcGxhY2UgKC8o6Zu2LikrL2csICfpm7YnKVxuICAgICAgICAucmVwbGFjZSAoL17mlbQkLywgJ+mbtuaVtCcpO1xufVxuY29uc3QgZGlnaXRhbENvaW4gPSBmdW5jdGlvbiAobiwgbm9tKSB7XG4gICAgY29uc3Qgc3ltYm9sID0gbmV3IFN0cmluZyAobm9tKS50b1VwcGVyQ2FzZSAoKTtcbiAgICBjb25zdCBmcmFjdGlvbiA9IFsn6KeSJywgJ+WIhiddO1xuICAgIGNvbnN0IGRpZ2l0ID0gW1xuICAgICAgICAn6Zu2JywgJ+WjuScsICfotLAnLCAn5Y+BJywgJ+iChicsXG4gICAgICAgICfkvI0nLCAn6ZmGJywgJ+afkicsICfmjYwnLCAn546WJ1xuICAgIF07XG4gICAgY29uc3QgdW5pdCA9IFtcbiAgICAgICAgW3N5bWJvbCwgJ+S4hycsICfkur8nXSxcbiAgICAgICAgWycnLCAn5ou+JywgJ+S9sCcsICfku58nXVxuICAgIF07XG4gICAgY29uc3QgaGVhZCA9IG4gPCAwID8gJ+i0nycgOiAnJztcbiAgICBuID0gTWF0aC5hYnMgKG4pO1xuICAgIGxldCBzID0gJyc7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBmcmFjdGlvbi5sZW5ndGg7IGkrKykge1xuICAgICAgICBzICs9IChkaWdpdFtNYXRoLmZsb29yIChuICogMTAgKiBNYXRoLnBvdyAoMTAsIGkpKSAlIDEwXSArIGZyYWN0aW9uW2ldKS5yZXBsYWNlICgv6Zu2Li8sICcnKTtcbiAgICB9XG4gICAgcyA9IHMgfHwgJ+aVtCc7XG4gICAgbiA9IE1hdGguZmxvb3IgKG4pO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdW5pdFswXS5sZW5ndGggJiYgbiA+IDA7IGkrKykge1xuICAgICAgICBsZXQgcCA9ICcnO1xuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHVuaXRbMV0ubGVuZ3RoICYmIG4gPiAwOyBqKyspIHtcbiAgICAgICAgICAgIHAgPSBkaWdpdFtuICUgMTBdICsgdW5pdFsxXVtqXSArIHA7XG4gICAgICAgICAgICBuID0gTWF0aC5mbG9vciAobiAvIDEwKTtcbiAgICAgICAgfVxuICAgICAgICBzID0gcC5yZXBsYWNlICgvKOmbti4pKumbtiQvLCAnJykucmVwbGFjZSAoL14kLywgJ+mbticpICsgdW5pdFswXVtpXSArIHM7XG4gICAgfVxuICAgIHJldHVybiBoZWFkICtcbiAgICAgICAgcy5yZXBsYWNlICgvKOmbti4pKumbtuWFgy8sICcnKVxuICAgICAgICAucmVwbGFjZSAoLyjpm7YuKSsvZywgJ+mbticpXG4gICAgICAgIC5yZXBsYWNlICgvXuaVtCQvLCAn6Zu25pW0Jyk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIENvaW4ge1xuICAgIHN0YXRpYyBTdGFraW5nQ29pbiA9IGNvaW5MaXN0LmZpbmQgKGNvaW4gPT4gY29pbi5kZW5vbSA9PT0gTWV0ZW9yLnNldHRpbmdzLnB1YmxpYy5ib25kRGVub20pO1xuICAgIHN0YXRpYyBNaW5TdGFrZSA9IDEgLyBOdW1iZXIgKENvaW4uU3Rha2luZ0NvaW4uZnJhY3Rpb24pO1xuXG4gICAgY29uc3RydWN0b3IgKGFtb3VudCwgZGVub20gPSBNZXRlb3Iuc2V0dGluZ3MucHVibGljLmJvbmREZW5vbSkge1xuICAgICAgICBjb25zdCBsb3dlckRlbm9tID0gZGVub20udG9Mb3dlckNhc2UgKCk7XG4gICAgICAgIHRoaXMuX2NvaW4gPSBjb2luTGlzdC5maW5kIChjb2luID0+XG4gICAgICAgICAgICBjb2luLmRlbm9tLnRvTG93ZXJDYXNlICgpID09PSBsb3dlckRlbm9tIHx8IGNvaW4uZGlzcGxheU5hbWUudG9Mb3dlckNhc2UgKCkgPT09IGxvd2VyRGVub21cbiAgICAgICAgKTtcblxuICAgICAgICBpZiAodGhpcy5fY29pbikge1xuICAgICAgICAgICAgaWYgKGxvd2VyRGVub20gPT09IHRoaXMuX2NvaW4uZGVub20udG9Mb3dlckNhc2UgKCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9hbW91bnQgPSBOdW1iZXIgKGFtb3VudCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGxvd2VyRGVub20gPT09IHRoaXMuX2NvaW4uZGlzcGxheU5hbWUudG9Mb3dlckNhc2UgKCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9hbW91bnQgPSBOdW1iZXIgKGFtb3VudCkgKiB0aGlzLl9jb2luLmZyYWN0aW9uO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fY29pbiA9IFwiXCI7XG4gICAgICAgICAgICB0aGlzLl9hbW91bnQgPSBOdW1iZXIgKGFtb3VudCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYW1vdW50ICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Ftb3VudDtcbiAgICB9XG5cbiAgICBnZXQgc3Rha2luZ0Ftb3VudCAoKSB7XG4gICAgICAgIHJldHVybiAodGhpcy5fY29pbikgPyB0aGlzLl9hbW91bnQgLyB0aGlzLl9jb2luLmZyYWN0aW9uIDogdGhpcy5fYW1vdW50O1xuICAgIH1cblxuICAgIHRvU3RyaW5nIChwcmVjaXNpb24pIHtcbiAgICAgICAgLy8gZGVmYXVsdCB0byBkaXNwbGF5IGluIG1pbnQgZGVub20gaWYgaXQgaGFzIG1vcmUgdGhhbiA0IGRlY2ltYWwgcGxhY2VzXG4gICAgICAgIGxldCBtaW5TdGFrZSA9IENvaW4uU3Rha2luZ0NvaW4uZnJhY3Rpb24gLyAocHJlY2lzaW9uID8gTWF0aC5wb3cgKDEwLCBwcmVjaXNpb24pIDogMTAwMDApXG4gICAgICAgIGlmICh0aGlzLmFtb3VudCA8IG1pblN0YWtlKSB7XG4gICAgICAgICAgICByZXR1cm4gYCR7bnVtYnJvICh0aGlzLmFtb3VudCkuZm9ybWF0ICgnMCwwLjAwMDAnKX0gJHt0aGlzLl9jb2luLmRlbm9tfWA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gYCR7cHJlY2lzaW9uID8gbnVtYnJvICh0aGlzLnN0YWtpbmdBbW91bnQpLmZvcm1hdCAoJzAsMC4nICsgJzAnLnJlcGVhdCAocHJlY2lzaW9uKSkgOiBhdXRvZm9ybWF0ICh0aGlzLnN0YWtpbmdBbW91bnQpfSAke3RoaXMuX2NvaW4uZGlzcGxheU5hbWV9YFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgbWludFN0cmluZyAoZm9ybWF0dGVyKSB7XG4gICAgICAgIGxldCBhbW91bnQgPSB0aGlzLmFtb3VudFxuICAgICAgICBpZiAoZm9ybWF0dGVyKSB7XG4gICAgICAgICAgICBhbW91bnQgPSBudW1icm8gKGFtb3VudCkuZm9ybWF0IChmb3JtYXR0ZXIpXG4gICAgICAgIH1cblxuICAgICAgICBsZXQgZGVub20gPSAodGhpcy5fY29pbiA9PSBcIlwiKSA/IENvaW4uU3Rha2luZ0NvaW4uZGlzcGxheU5hbWUgOiB0aGlzLl9jb2luLmRlbm9tO1xuICAgICAgICByZXR1cm4gYCR7YW1vdW50fSAke2Rlbm9tfWA7XG4gICAgfVxuXG4gICAgc3Rha2VTdHJpbmcgKGZvcm1hdHRlcikge1xuICAgICAgICBsZXQgYW1vdW50ID0gdGhpcy5zdGFraW5nQW1vdW50XG4gICAgICAgIGlmIChmb3JtYXR0ZXIpIHtcbiAgICAgICAgICAgIGFtb3VudCA9IG51bWJybyAoYW1vdW50KS5mb3JtYXQgKGZvcm1hdHRlcilcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYCR7YW1vdW50fSAke0NvaW4uU3Rha2luZ0NvaW4uZGlzcGxheU5hbWV9YDtcbiAgICB9XG5cbiAgICB0b0hhblN0cmluZyAoKSB7XG4gICAgICAgIC8vIGRlZmF1bHQgdG8gZGlzcGxheSBpbiBtaW50IGRlbm9tIGlmIGl0IGhhcyBtb3JlIHRoYW4gNCBkZWNpbWFsIHBsYWNlc1xuICAgICAgICBsZXQgbWluU3Rha2UgPSBDb2luLlN0YWtpbmdDb2luLmZyYWN0aW9uIC8gMTAwMFxuICAgICAgICBpZiAodGhpcy5hbW91bnQgPCBtaW5TdGFrZSkge1xuICAgICAgICAgICAgcmV0dXJuIGAke251bWJybyAodGhpcy5hbW91bnQpLmZvcm1hdCAoJzAsMC4wMDAwJyl9ICR7dGhpcy5fY29pbi5kZW5vbX1gO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGAke2RpZ2l0YWxDb2luICh0aGlzLnN0YWtpbmdBbW91bnQsIHRoaXMuX2NvaW4uZGlzcGxheU5hbWUpfWBcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsImNvbnN0IGVycm9ycyA9IHtcbiAgICBcInNka1wiIDoge1xuICAgICAgICAxIDogXCJJbnRlcm5hbCBFcnJvclwiLFxuICAgICAgICAyIDogXCJUeCBEZWNvZGUgRXJyb3JcIixcbiAgICAgICAgMyA6IFwiSW52YWxpZCBTZXF1ZW5jZSBOdW1iZXJcIixcbiAgICAgICAgNCA6IFwiVW5hdXRob3JpemVkXCIsXG4gICAgICAgIDUgOiBcIkluc3VmZmljaWVudCBGdW5kc1wiLFxuICAgICAgICA2IDogXCJVbmtub3duIFJlcXVlc3RcIixcbiAgICAgICAgNyA6IFwiSW52YWxpZCBBZGRyZXNzXCIsXG4gICAgICAgIDggOiBcIkludmFsaWQgUHViS2V5XCIsXG4gICAgICAgIDkgOiBcIlVua25vd24gQWRkcmVzc1wiLFxuICAgICAgICAxMCA6IFwiSW5zdWZmaWNpZW50IENvaW5zXCIsXG4gICAgICAgIDExIDogXCJJbnZhbGlkIENvaW5zXCIsXG4gICAgICAgIDEyIDogXCJPdXQgT2YgR2FzXCIsXG4gICAgICAgIDEzIDogXCJNZW1vIFRvbyBMYXJnZVwiLFxuICAgICAgICAxNCA6IFwiSW5zdWZmaWNpZW50IEZlZVwiLFxuICAgICAgICAxNSA6IFwiVG9vIE1hbnkgU2lnbmF0dXJlc1wiLFxuICAgICAgICAxNiA6IFwiR2FzIE92ZXJmbG93XCIsXG4gICAgICAgIDE3IDogXCJObyBTaWduYXR1cmVzXCJcbiAgICB9LFxuICAgIFwic3Rha2luZ1wiIDoge1xuICAgICAgICAxMDEgOiBcIkludmFsaWQgVmFsaWRhdG9yXCIsXG4gICAgICAgIDEwMiA6IFwiSW52YWxpZCBEZWxlZ2F0aW9uXCIsXG4gICAgICAgIDEwMyA6IFwiSW52YWxpZCBJbnB1dFwiLFxuICAgICAgICAxMDQgOiBcIlZhbGlkYXRvciBKYWlsZWRcIlxuICAgIH0sXG4gICAgXCJnb3ZcIiA6IHtcbiAgICAgICAgMSA6IFwiVW5rbm93biBQcm9wb3NhbFwiLFxuICAgICAgICAyIDogXCJJbmFjdGl2ZSBQcm9wb3NhbFwiLFxuICAgICAgICAzIDogXCJBbHJlYWR5IEFjdGl2ZSBQcm9wb3NhbFwiLFxuICAgICAgICA0IDogXCJBbHJlYWR5IEZpbmlzaGVkIFByb3Bvc2FsXCIsXG4gICAgICAgIDUgOiBcIkFkZHJlc3MgTm90IFN0YWtlZFwiLFxuICAgICAgICA2IDogXCJJbnZhbGlkIFRpdGxlXCIsXG4gICAgICAgIDcgOiBcIkludmFsaWQgRGVzY3JpcHRpb25cIixcbiAgICAgICAgOCA6IFwiSW52YWxpZCBQcm9wb3NhbCBUeXBlXCIsXG4gICAgICAgIDkgOiBcIkludmFsaWQgVm90ZVwiLFxuICAgICAgICAxMCA6IFwiSW52YWxpZCBHZW5lc2lzXCIsXG4gICAgICAgIDExIDogXCJJbnZhbGlkIFByb3Bvc2FsIFN0YXR1c1wiXG4gICAgfSxcbiAgICBcImRpc3RyXCIgOiB7XG4gICAgICAgIDEwMyA6IFwiSW52YWxpZCBJbnB1dFwiLFxuICAgICAgICAxMDQgOiBcIk5vIERpc3RyaWJ1dGlvbiBJbmZvXCIsXG4gICAgICAgIDEwNSA6IFwiTm8gVmFsaWRhdG9yIENvbW1pc3Npb25cIixcbiAgICAgICAgMTA2IDogXCJTZXQgV2l0aGRyYXcgQWRkcnJlc3MgRGlzYWJsZWRcIlxuICAgIH0sXG4gICAgXCJiYW5rXCIgOiB7XG4gICAgICAgIDEwMSA6IFwiU2VuZCBEaXNhYmxlZFwiLFxuICAgICAgICAxMDIgOiBcIkludmFsaWQgSW5wdXRzIE91dHB1dHNcIlxuICAgIH0sXG4gICAgXCJzbGFzaGluZ1wiIDoge1xuICAgICAgICAxMDEgOiBcIkludmFsaWQgVmFsaWRhdG9yXCIsXG4gICAgICAgIDEwMiA6IFwiVmFsaWRhdG9yIEphaWxlZFwiLFxuICAgICAgICAxMDMgOiBcIlZhbGlkYXRvciBOb3QgSmFpbGVkXCIsXG4gICAgICAgIDEwNCA6IFwiTWlzc2luZyBTZWxmIERlbGVnYXRpb25cIixcbiAgICAgICAgMTA1IDogXCJTZWxmIERlbGVnYXRpb24gVG9vIExvd1wiXG4gICAgfVxufVxuaW1wb3J0IG51bWJybyBmcm9tICdudW1icm8nO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFcnJvckNoZWNrIHtcbiAgICBjb25zdHJ1Y3RvciAoY29kZSwgY29kZXNwYWNlLCBwYXlsb2FkKSB7XG4gICAgICAgIHRoaXMuY29kZSA9IGNvZGU7XG4gICAgICAgIHRoaXMuc3BhY2UgPSBjb2Rlc3BhY2U7XG4gICAgICAgIHRoaXMubWVzc2FnZSA9IFwiVW5rbm93biBlcnJvclwiO1xuICAgICAgICB0aGlzLnBheWxvYWQgPSBwYXlsb2FkO1xuICAgICAgICB0aGlzLnByb2Nlc3MgKCk7XG4gICAgfVxuXG4gICAgZm91bmRFcnJvciAoKSB7XG4gICAgICAgIHJldHVybiBlcnJvcnMuaGFzT3duUHJvcGVydHkgKHRoaXMuc3BhY2UpO1xuICAgIH1cblxuICAgIEdldE1lc3NhZ2UgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5tZXNzYWdlO1xuICAgIH1cblxuICAgIHByb2Nlc3MgKCkge1xuICAgICAgICBpZiAodGhpcy5mb3VuZEVycm9yICgpKSB7XG4gICAgICAgICAgICBpZiAoZXJyb3JzW3RoaXMuc3BhY2VdLmhhc093blByb3BlcnR5ICh0aGlzLmNvZGUpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5tZXNzYWdlID0gZXJyb3JzW3RoaXMuc3BhY2VdW3RoaXMuY29kZV07XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgaWYgKHRoaXMuc3BhY2UgPT0gXCJzZGtcIiAmJiB0aGlzLmNvZGUgPT0gMTIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IGdhc191c2VkLCBnYXNfd2FudGVkIH0gPSB0aGlzLnBheWxvYWQ7XG4gICAgICAgICAgICAgICAgdGhpcy5tZXNzYWdlID0gdGhpcy5tZXNzYWdlICsgXCJnYXMgdXNlcyAoXCIgKyBudW1icm8gKGdhc191c2VkKS5mb3JtYXQgKFwiMCwwXCIpICsgXCIpID4gZ2FzIHdhbnRlZCAoXCIgKyBudW1icm8gKGdhc193YW50ZWQpLmZvcm1hdCAoXCIwLDBcIikgKyBcIilcIjtcblxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuICAgIH1cbn1cbiIsIi8vIFNlcnZlciBlbnRyeSBwb2ludCwgaW1wb3J0cyBhbGwgc2VydmVyIGNvZGVcblxuaW1wb3J0ICcvaW1wb3J0cy9zdGFydHVwL3NlcnZlcic7XG5pbXBvcnQgJy9pbXBvcnRzL3N0YXJ0dXAvYm90aCc7XG4vLyBpbXBvcnQgbW9tZW50IGZyb20gJ21vbWVudCc7XG4vLyBpbXBvcnQgJy9pbXBvcnRzL2FwaS9ibG9ja3MvYmxvY2tzLmpzJztcblxuU1lOQ0lORyA9IGZhbHNlO1xuQ09VTlRNSVNTRURCTE9DS1MgPSBmYWxzZTtcbkNPVU5UTUlTU0VEQkxPQ0tTU1RBVFMgPSBmYWxzZTtcblJQQyA9IE1ldGVvci5zZXR0aW5ncy5yZW1vdGUucnBjO1xuTENEID0gTWV0ZW9yLnNldHRpbmdzLnJlbW90ZS5sY2Q7XG50aW1lckJsb2NrcyA9IDA7XG50aW1lckNoYWluID0gMDtcbnRpbWVyQ29uc2Vuc3VzID0gMDtcbnRpbWVyUHJvcG9zYWwgPSAwO1xudGltZXJQcm9wb3NhbHNSZXN1bHRzID0gMDtcbnRpbWVyTWlzc2VkQmxvY2sgPSAwO1xudGltZXJEZWxlZ2F0aW9uID0gMDtcbnRpbWVyQWdncmVnYXRlID0gMDtcblxuY29uc3QgREVGQVVMVFNFVFRJTkdTID0gJy9kZWZhdWx0X3NldHRpbmdzLmpzb24nO1xuXG51cGRhdGVDaGFpblN0YXR1cyA9ICgpID0+IHtcbiAgICBNZXRlb3IuY2FsbCAoJ2NoYWluLnVwZGF0ZVN0YXR1cycsIChlcnJvciwgcmVzdWx0KSA9PiB7XG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5sb2cgKFwidXBkYXRlU3RhdHVzOiBcIiArIGVycm9yKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nIChcInVwZGF0ZVN0YXR1czogXCIgKyByZXN1bHQpO1xuICAgICAgICB9XG4gICAgfSlcbn1cblxudXBkYXRlQmxvY2sgPSAoKSA9PiB7XG4gICAgTWV0ZW9yLmNhbGwgKCdibG9ja3MuYmxvY2tzVXBkYXRlJywgKGVycm9yLCByZXN1bHQpID0+IHtcbiAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyAoXCJ1cGRhdGVCbG9ja3M6IFwiICsgZXJyb3IpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2cgKFwidXBkYXRlQmxvY2tzOiBcIiArIHJlc3VsdCk7XG4gICAgICAgIH1cbiAgICB9KVxufVxuXG5nZXRDb25zZW5zdXNTdGF0ZSA9ICgpID0+IHtcbiAgICBNZXRlb3IuY2FsbCAoJ2NoYWluLmdldENvbnNlbnN1c1N0YXRlJywgKGVycm9yLCByZXN1bHQpID0+IHtcbiAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyAoXCJnZXQgY29uc2Vuc3VzOiBcIiArIGVycm9yKVxuICAgICAgICB9XG4gICAgfSlcbn1cblxuZ2V0UHJvcG9zYWxzID0gKCkgPT4ge1xuICAgIE1ldGVvci5jYWxsICgncHJvcG9zYWxzLmdldFByb3Bvc2FscycsIChlcnJvciwgcmVzdWx0KSA9PiB7XG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5sb2cgKFwiZ2V0IHByb3Bvc2FsOiBcIiArIGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyAoXCJnZXQgcHJvcG9zYWw6IFwiICsgcmVzdWx0KTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5nZXRQcm9wb3NhbHNSZXN1bHRzID0gKCkgPT4ge1xuICAgIE1ldGVvci5jYWxsICgncHJvcG9zYWxzLmdldFByb3Bvc2FsUmVzdWx0cycsIChlcnJvciwgcmVzdWx0KSA9PiB7XG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5sb2cgKFwiZ2V0IHByb3Bvc2FscyByZXN1bHQ6IFwiICsgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nIChcImdldCBwcm9wb3NhbHMgcmVzdWx0OiBcIiArIHJlc3VsdCk7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxudXBkYXRlTWlzc2VkQmxvY2tzID0gKCkgPT4ge1xuICAgIE1ldGVvci5jYWxsICgnVmFsaWRhdG9yUmVjb3Jkcy5jYWxjdWxhdGVNaXNzZWRCbG9ja3MnLCAoZXJyb3IsIHJlc3VsdCkgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nIChcIm1pc3NlZCBibG9ja3MgZXJyb3I6IFwiICsgZXJyb3IpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2cgKFwibWlzc2VkIGJsb2NrcyBvazpcIiArIHJlc3VsdCk7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICAvKlxuICAgICAgICBNZXRlb3IuY2FsbCgnVmFsaWRhdG9yUmVjb3Jkcy5jYWxjdWxhdGVNaXNzZWRCbG9ja3NTdGF0cycsIChlcnJvciwgcmVzdWx0KSA9PntcbiAgICAgICAgICAgIGlmIChlcnJvcil7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJtaXNzZWQgYmxvY2tzIHN0YXRzIGVycm9yOiBcIisgZXJyb3IpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocmVzdWx0KXtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIm1pc3NlZCBibG9ja3Mgc3RhdHMgb2s6XCIgKyByZXN1bHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAqL1xufVxuXG5nZXREZWxlZ2F0aW9ucyA9ICgpID0+IHtcbiAgICBNZXRlb3IuY2FsbCAoJ2RlbGVnYXRpb25zLmdldERlbGVnYXRpb25zJywgKGVycm9yLCByZXN1bHQpID0+IHtcbiAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyAoXCJnZXQgZGVsZWdhdGlvbnMgZXJyb3I6IFwiICsgZXJyb3IpXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyAoXCJnZXQgZGVsZWdhdGlvbnMgb2s6IFwiICsgcmVzdWx0KVxuICAgICAgICB9XG4gICAgfSk7XG59XG5cbmFnZ3JlZ2F0ZU1pbnV0ZWx5ID0gKCkgPT4ge1xuICAgIC8vIGRvaW5nIHNvbWV0aGluZyBldmVyeSBtaW5cbiAgICBNZXRlb3IuY2FsbCAoJ0FuYWx5dGljcy5hZ2dyZWdhdGVCbG9ja1RpbWVBbmRWb3RpbmdQb3dlcicsIFwibVwiLCAoZXJyb3IsIHJlc3VsdCkgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nIChcImFnZ3JlZ2F0ZSBtaW51dGVseSBibG9jayB0aW1lIGVycm9yOiBcIiArIGVycm9yKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2cgKFwiYWdncmVnYXRlIG1pbnV0ZWx5IGJsb2NrIHRpbWUgb2s6IFwiICsgcmVzdWx0KVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBNZXRlb3IuY2FsbCAoJ2NvaW5TdGF0cy5nZXRDb2luU3RhdHMnLCAoZXJyb3IsIHJlc3VsdCkgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nIChcImdldCBjb2luIHN0YXRzIGVycm9yOiBcIiArIGVycm9yKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nIChcImdldCBjb2luIHN0YXRzIG9rOiBcIiArIHJlc3VsdClcbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5hZ2dyZWdhdGVIb3VybHkgPSAoKSA9PiB7XG4gICAgLy8gZG9pbmcgc29tZXRoaW5nIGV2ZXJ5IGhvdXJcbiAgICBNZXRlb3IuY2FsbCAoJ0FuYWx5dGljcy5hZ2dyZWdhdGVCbG9ja1RpbWVBbmRWb3RpbmdQb3dlcicsIFwiaFwiLCAoZXJyb3IsIHJlc3VsdCkgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nIChcImFnZ3JlZ2F0ZSBob3VybHkgYmxvY2sgdGltZSBlcnJvcjogXCIgKyBlcnJvcilcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nIChcImFnZ3JlZ2F0ZSBob3VybHkgYmxvY2sgdGltZSBvazogXCIgKyByZXN1bHQpXG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuYWdncmVnYXRlRGFpbHkgPSAoKSA9PiB7XG4gICAgLy8gZG9pbmcgc29tdGhpbmcgZXZlcnkgZGF5XG4gICAgTWV0ZW9yLmNhbGwgKCdBbmFseXRpY3MuYWdncmVnYXRlQmxvY2tUaW1lQW5kVm90aW5nUG93ZXInLCBcImRcIiwgKGVycm9yLCByZXN1bHQpID0+IHtcbiAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyAoXCJhZ2dyZWdhdGUgZGFpbHkgYmxvY2sgdGltZSBlcnJvcjogXCIgKyBlcnJvcilcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nIChcImFnZ3JlZ2F0ZSBkYWlseSBibG9jayB0aW1lIG9rOiBcIiArIHJlc3VsdClcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgTWV0ZW9yLmNhbGwgKCdBbmFseXRpY3MuYWdncmVnYXRlVmFsaWRhdG9yRGFpbHlCbG9ja1RpbWUnLCAoZXJyb3IsIHJlc3VsdCkgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nIChcImFnZ3JlZ2F0ZSB2YWxpZGF0b3JzIGJsb2NrIHRpbWUgZXJyb3I6XCIgKyBlcnJvcilcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nIChcImFnZ3JlZ2F0ZSB2YWxpZGF0b3JzIGJsb2NrIHRpbWUgb2s6XCIgKyByZXN1bHQpO1xuICAgICAgICB9XG4gICAgfSlcbn1cblxuXG5NZXRlb3Iuc3RhcnR1cCAoZnVuY3Rpb24gKCkge1xuICAgIGlmIChNZXRlb3IuaXNEZXZlbG9wbWVudCkge1xuICAgICAgICBwcm9jZXNzLmVudi5OT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEID0gMDtcbiAgICAgICAgaW1wb3J0IERFRkFVTFRTRVRUSU5HU0pTT04gZnJvbSAnLi4vZGVmYXVsdF9zZXR0aW5ncy5qc29uJ1xuICAgICAgICBPYmplY3Qua2V5cyAoREVGQVVMVFNFVFRJTkdTSlNPTikuZm9yRWFjaCAoKGtleSkgPT4ge1xuICAgICAgICAgICAgaWYgKE1ldGVvci5zZXR0aW5nc1trZXldID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybiAoYENIRUNLIFNFVFRJTkdTIEpTT046ICR7a2V5fSBpcyBtaXNzaW5nIGZyb20gc2V0dGluZ3NgKVxuICAgICAgICAgICAgICAgIE1ldGVvci5zZXR0aW5nc1trZXldID0ge307XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBPYmplY3Qua2V5cyAoREVGQVVMVFNFVFRJTkdTSlNPTltrZXldKS5mb3JFYWNoICgocGFyYW0pID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoTWV0ZW9yLnNldHRpbmdzW2tleV1bcGFyYW1dID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4gKGBDSEVDSyBTRVRUSU5HUyBKU09OOiAke2tleX0uJHtwYXJhbX0gaXMgbWlzc2luZyBmcm9tIHNldHRpbmdzYClcbiAgICAgICAgICAgICAgICAgICAgTWV0ZW9yLnNldHRpbmdzW2tleV1bcGFyYW1dID0gREVGQVVMVFNFVFRJTkdTSlNPTltrZXldW3BhcmFtXVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgTWV0ZW9yLmNhbGwgKCdjaGFpbi5nZW5lc2lzJywgKGVyciwgcmVzdWx0KSA9PiB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nIChlcnIpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICAgIGlmIChNZXRlb3Iuc2V0dGluZ3MuZGVidWcuc3RhcnRUaW1lcikge1xuICAgICAgICAgICAgICAgIHRpbWVyQ29uc2Vuc3VzID0gTWV0ZW9yLnNldEludGVydmFsIChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIGdldENvbnNlbnN1c1N0YXRlICgpO1xuICAgICAgICAgICAgICAgIH0sIE1ldGVvci5zZXR0aW5ncy5wYXJhbXMuY29uc2Vuc3VzSW50ZXJ2YWwpO1xuXG4gICAgICAgICAgICAgICAgdGltZXJCbG9ja3MgPSBNZXRlb3Iuc2V0SW50ZXJ2YWwgKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgdXBkYXRlQmxvY2sgKCk7XG4gICAgICAgICAgICAgICAgfSwgTWV0ZW9yLnNldHRpbmdzLnBhcmFtcy5ibG9ja0ludGVydmFsKTtcblxuICAgICAgICAgICAgICAgIHRpbWVyQ2hhaW4gPSBNZXRlb3Iuc2V0SW50ZXJ2YWwgKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgdXBkYXRlQ2hhaW5TdGF0dXMgKCk7XG4gICAgICAgICAgICAgICAgfSwgTWV0ZW9yLnNldHRpbmdzLnBhcmFtcy5zdGF0dXNJbnRlcnZhbCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoTWV0ZW9yLnNldHRpbmdzLnBhcmFtcy5wcm9wb3NhbEludGVydmFsID49IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZXJQcm9wb3NhbCA9IE1ldGVvci5zZXRJbnRlcnZhbCAoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2V0UHJvcG9zYWxzICgpO1xuICAgICAgICAgICAgICAgICAgICB9LCBNZXRlb3Iuc2V0dGluZ3MucGFyYW1zLnByb3Bvc2FsSW50ZXJ2YWwpO1xuXG4gICAgICAgICAgICAgICAgICAgIHRpbWVyUHJvcG9zYWxzUmVzdWx0cyA9IE1ldGVvci5zZXRJbnRlcnZhbCAoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2V0UHJvcG9zYWxzUmVzdWx0cyAoKTtcbiAgICAgICAgICAgICAgICAgICAgfSwgTWV0ZW9yLnNldHRpbmdzLnBhcmFtcy5wcm9wb3NhbEludGVydmFsKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aW1lck1pc3NlZEJsb2NrID0gTWV0ZW9yLnNldEludGVydmFsIChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHVwZGF0ZU1pc3NlZEJsb2NrcyAoKTtcbiAgICAgICAgICAgICAgICB9LCBNZXRlb3Iuc2V0dGluZ3MucGFyYW1zLm1pc3NlZEJsb2Nrc0ludGVydmFsKTtcblxuICAgICAgICAgICAgICAgIHRpbWVyRGVsZWdhdGlvbiA9IE1ldGVvci5zZXRJbnRlcnZhbCAoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBnZXREZWxlZ2F0aW9ucyAoKTtcbiAgICAgICAgICAgICAgICB9LCBNZXRlb3Iuc2V0dGluZ3MucGFyYW1zLmRlbGVnYXRpb25JbnRlcnZhbCk7XG5cbiAgICAgICAgICAgICAgICB0aW1lckFnZ3JlZ2F0ZSA9IE1ldGVvci5zZXRJbnRlcnZhbCAoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgbm93ID0gbmV3IERhdGUgKCk7XG4gICAgICAgICAgICAgICAgICAgIGlmICgobm93LmdldFVUQ1NlY29uZHMgKCkgPT0gMCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFnZ3JlZ2F0ZU1pbnV0ZWx5ICgpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKChub3cuZ2V0VVRDTWludXRlcyAoKSA9PSAwKSAmJiAobm93LmdldFVUQ1NlY29uZHMgKCkgPT0gMCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFnZ3JlZ2F0ZUhvdXJseSAoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICgobm93LmdldFVUQ0hvdXJzICgpID09IDApICYmIChub3cuZ2V0VVRDTWludXRlcyAoKSA9PSAwKSAmJiAobm93LmdldFVUQ1NlY29uZHMgKCkgPT0gMCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFnZ3JlZ2F0ZURhaWx5ICgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSwgMTAwMClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pXG5cbn0pO1xuIl19
