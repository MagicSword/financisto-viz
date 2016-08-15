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
        if (Object.keys(value).length > 0 && value.is_template === '0')
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
    value[info[0]] = convert(info[0], info[1]);
  }
}

let convert = (colName, value) => {
  if(colName.match(/_amount/))
    return parseInt(value)
  else if(['datetime', 'last_recurrence', 'updated_on'].indexOf(colName) > -1)
    return parseInt(value)
  else
    return value
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
    console.log(_.reduce(getAcctRunningBalance(), (prev, curr) => prev + curr, 0))
});

// TODO: get last 12 month running balance
let getAcctRunningBalance = (config = null) => {
  let date = new Date
  date.setMonth(date.getMonth() - 1)

  let collect = db.getCollection('transactions')
  collect.where( o => 
      o.datetime > date.getTime() 
      && o.datetime < (date.getTime() + 3600 * 24 * 1000)
      )

  // get account running balance
  let acc_balance = _.groupBy(collect.data, (trans) => {
    return trans.from_account_id
  })

  let trans_balance = {};
  for(let key in acc_balance)
    trans_balance[key] = 0

  let colbalance = _.transform(acc_balance, (res, trans, tag) => {
    res[tag] = trans.reduce( (prev, trans) => {
      if(trans.to_account_id != '0')
        trans_balance[trans.to_account_id] += trans.to_amount

      if(trans.category_id != '-1')
        return prev + trans.from_amount
      else
        return prev
    }, 0)
  }, {});

  for(let key in colbalance)
    colbalance[key] += trans_balance[key]

  return colbalance;
}
