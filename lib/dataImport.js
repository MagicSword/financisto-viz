// REF: https://github.com/dsolonenko/financisto/blob/master/Financisto/src/main/java/ru/orangesoftware/financisto2/backup/DatabaseImport.java

const fs = require('fs'),
      readline = require('readline');
const loki = require('lokijs'),
      db = new loki('NorseGods.json');
const _ = require('lodash');

function insertDB(tbname, value) {
  let collect = db.getCollection(tbname);
  if(!collect)
    collect = db.addCollection(tbname);
  collect.insert(value);
}

let value = {};
function recoverDatabase(line) {
  if (line.startsWith("$")) {
    if (line === "$$") {
      // end
      if (Object.keys(value).length > 0 && value.tableName != null) {
        tableName = value.tableName;
        delete value.tableName
        if (Object.keys(value).length > 0)
          insertDB(tableName, value);
      }
    } else {
      // start
      let info = line.split(':').map(s => s.trim());
      value = {};
      value.tableName = info[1];
    }
  } else {
    // content
    let info = line.split(':').map(s => s.trim());
    value[info[0]] = info[1];
  }
}

var rd = readline.createInterface({
    input: fs.createReadStream('data'),
    output: process.stdout,
    terminal: false
});

let startRead = false;
rd.on('line', function(line) {
  if(startRead)
    recoverDatabase(line);
  else if(line === '#START')
    startRead = true;
});

rd.on('close', () => {
  let collect = db.getCollection('transactions');

  // testing: get correct account running balance
  let acc_balance = _.groupBy(collect.data, (trans) => {
    return trans.from_account_id
  })

  let trans_balance = {};
  for(let key in acc_balance)
    trans_balance[key] = 0

  colbalance = _.transform(acc_balance, (res, trans, tag) => {
    res[tag] = trans.reduce( (prev, trans) => {
      if(trans.to_account_id != '0')
        trans_balance[trans.to_account_id] += parseInt(trans.to_amount)

      if(trans.category_id != '-1')
        return prev + parseInt(trans.from_amount)
      else
        return prev
    }, 0)
  }, {});

  for(let key in colbalance)
    colbalance[key] += trans_balance[key]

  console.log(colbalance)
  console.log(_.reduce(colbalance, (prev, acct) => {
    return prev + acct
  }, 0))
  // transactions balance
  // FIXME incorrect
  console.log(
    collect.data.reduce((prev, trans) => {
      if(trans.category_id != '-1')
        return prev + parseInt(trans.from_amount) + parseInt(trans.to_amount)
      else
        return prev
    }, 0))

  // Account balance
  // for verification
  collect = db.getCollection('account')
  console.log(collect.data.reduce((prev, acct) => {
    return prev + parseInt(acct.total_amount)
  }, 0))
});
