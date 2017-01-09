// REF: https://github.com/dsolonenko/financisto/blob/master/Financisto/src/main/java/ru/orangesoftware/financisto2/backup/DatabaseImport.java

const fs = require('fs'),
      readline = require('readline');
const loki = require('lokijs'),
      db = new loki();
const _ = require('lodash');
const moment = require('moment');

const EventEmitter = require('events').EventEmitter
const emitter = new EventEmitter()

function insertDB(tbname, value) {
  let collect = db.getCollection(tbname);
  if(!collect)
    collect = db.addCollection(tbname);
  collect.insert(value);
}

let value = {}
function recoverDatabase(line) {
  if (line.startsWith("$")) {
    if (line === "$$") {
      // end
      if (Object.keys(value).length <= 0 || value.tableName == null)
        return

      tableName = value.tableName;
      delete value.tableName
      if (Object.keys(value).length > 0) {
        if('is_template' in value && value.is_template === 0)
          return;
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
  else if(['datetime', 'last_recurrence', 'updated_on', 'left', 'right'].indexOf(colName) > -1)
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

rd.on('close', () => emitter.emit('fileReading'))

function retreive(cb) {
  const after = moment().subtract(1, 'years');
  const before = moment().subtract(9, 'months');
  const category = getCategoryList();
  const res = getCategoryBalance(after, before, 'month', 'category_id', category[2])
  return cb(res)

  // console.log(_.reduce(res, (prev, curr) => prev + curr, 0))
};

let getCategoryList = () => {
  let cv = db.getCollection('category');

  const category = cv.data;
  let child = Object();
  category.forEach( (c1) => {
    child[c1._id] = Array();
    category.forEach( (c2) => {
      if (c1.left < c2.left && c1.right > c2.right) {
        child[c1._id].push(c2._id)
      }
    });
  })
  return child;
}

let getCategoryBalance = (after, before, unit = 'month', group = 'category_id', category = null) => {

  let dv = db.getCollection('transactions').addDynamicView('dv');
  dv.applyWhere( (obj) => {
    return obj.category_id !== '-1'
        && obj.datetime >  after.valueOf()
        && obj.datetime <= before.valueOf()
  });

  if(category)
    dv.applyWhere( (obj) => {
      return _.includes(category, obj.category_id)
    });
  
  return sumBalance(dv.data(), 'category_id');
}

// a transaction is composite of from_account and to_account
// if 'to_account' is presented, this value needs to be stored
// so after the reduce, the amount can be added accordingly
let sumBalance = (data, type) => {

  // get account running balance
  let acc_balance = _.groupBy(data, (trans) => {
    return trans[type]
  })

  let trans_balance = {};
  for(let key in acc_balance)
    trans_balance[key] = 0

  let colbalance = _.transform(acc_balance, (res, trans, tag) => {
    res[tag] = trans.reduce( (prev, trans) => {
      if(trans.to_account_id != '0')
        trans_balance[trans.to_account_id] += trans.to_amount

      return prev + trans.from_amount
    }, 0)
  }, {});

  for(let key in colbalance)
    colbalance[key] += trans_balance[key]

  return colbalance;
}

module.exports = {
  retreive,
  emitter
}
