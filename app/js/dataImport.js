// REF: https://github.com/dsolonenko/financisto/blob/master/Financisto/src/main/java/ru/orangesoftware/financisto2/backup/DatabaseImport.java

const fs = require('fs'),
      readline = require('readline');
const loki = require('lokijs'),
      db = new loki();
const _ = require('lodash');
const moment = require('moment');

const EventEmitter = require('events').EventEmitter
const emitter = new EventEmitter()

class CategoryTree {
  constructor() {
    this.root = null
    this.nodes = Object()
  }

  addNode(n) {
    this.nodes[n.id] = n
  }

  listAll(n) {
    return _.flattenDeep([n.id].concat(n.child.map(c => this.listAll(this.nodes[c]))))
  }
}

class Category {
  constructor(id, title, left, right) {
    this.id = id
    this.title = title
    this.left = left
    this.right = right

    this.parent = null
    this.child = []
    this.parentSpan = Number.MAX_SAFE_INTEGER
  }

  toString() {
    return `(${this.id}) ${this.title}` + _.map(this.child, (c) => c.title).join(',')
  }

  addChild(c) {
    this.child.push(c.id)
  }

  setParent(c, span) {
    this.parent = c.id
    this.parentSpan = span
  }
}

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

function retrieve(cb) {
  const after = moment().subtract(1, 'years').startOf('months');
  const before = moment().subtract(3, 'months').startOf('months');
  getBalance(after, before, 'month', balance => cb(balance))
};

let getCategoryList = () => {
  let cv = db.getCollection('category');

  const category = cv.data;

  let tree = new CategoryTree()
  category.forEach( (c) => {
    let node = new Category(c._id, c.title, c.left, c.right)
    tree.addNode(node)
  })
  tree.root = tree.nodes[0]
  let nodes = tree.nodes

  _.forEach(nodes, (c1) => {
    _.forEach(nodes, (c2) => {
      if (c1.left < c2.left && c1.right > c2.right) {
        c1.addChild(c2)
        if(c1.right - c1.left < c2.parentSpan)
          c2.setParent(c1, c1.right - c1.left)
      }
    });
  })
  _.forEach(nodes, (n) => {
    _.remove(n.child, (c) => nodes[c].parent !== n.id)
  })

  return tree
}

let getBalance = (after, before, unit = 'month', cb) => {
  let group = 'category_id'
  let data = db.getCollection('transactions').chain()
    .where( (obj) => {
      return obj.category_id !== '-1'
          && obj.datetime >=  after.valueOf()
          && obj.datetime < before.valueOf()
    })

  let res = []

  while(after < before) {
    let start = after.startOf(unit).valueOf()
    after.set(unit, after.get(unit)+1)
    let end = after.startOf(unit).valueOf()

    let subdata = data.branch()
      .where( (obj) => {
        return obj.datetime >= start
          && obj.datetime < end
      })
      .data()
    // let tmp = _.map(subdata, elm => elm.category_id + " " + elm.from_amount)
    // console.log(tmp)

    res.push({date: start, value: sumBalance(subdata, group)})
  }

  return cb(res)
}

let sumBalance = (data, group) => {

  // get account running balance
  let raw_balance = _.groupBy(data, (trans) => {
    return trans[group]
  })

  return _.transform(raw_balance, (res, trans, tag) => {
    res[tag] = trans.reduce( (prev, trans) => {
      return prev + trans.from_amount + trans.to_amount
    }, 0)
  }, {});
}

module.exports = {
  getCategoryList,
  retrieve,
  emitter
}
