// REF: https://github.com/dsolonenko/financisto/blob/master/Financisto/src/main/java/ru/orangesoftware/financisto2/backup/DatabaseImport.java

const fs = require('fs'),
      readline = require('readline');
const loki = require('lokijs'),
      db = new loki();
const _ = require('lodash');
const moment = require('moment');

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
  const after = moment().subtract(1, 'years');
  const before = moment().subtract(6, 'months');
  const categoryTree = getCategoryTree();
  console.log(_.reduce(getAcctRunningBalance(after, before), (prev, curr) => prev + curr, 0))
});

class Node {
  constructor(obj, child = []) {
    this.id = obj._id;
    this.left = obj.left;
    this.right = obj.right;
    this.child = child;
    this.parent = null;
  }

  addChild(node) {
    this.child.push(node.id)
  }

  toString() {
    return `${this.id}`
  }
}

var getCategoryTree = function() {
  let cv = db.getCollection('category');
  let tree = null;
  let p = null;

  cv.data.forEach( (obj) => {
    while(p !== null) {
    console.log(p, obj)
      if(obj.left > p.left && obj.right < p.right) {
        p.addChild(obj)
        break
      } else {
        p = p.parent
      }
    }
    if(p === null)
      tree = new Node(obj)
    if(obj._id > 0 && (obj.right - obj.left > 1))
      p = new Node(obj)
  );

  return tree;
}

let getAcctRunningBalance = (after, before, category = null) => {

  let dv = db.getCollection('transactions').addDynamicView('dv');
  dv.applyWhere( (obj) => {
    return obj.datetime >  after.valueOf()
        && obj.datetime <= before.valueOf()
  });

  // if(category)
  //   dv.applyWhere( (obj) => {
  //     return obj.category 
  //   });

  // get account running balance
  let acc_balance = _.groupBy(dv.data(), (trans) => {
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
