// REF: https://github.com/dsolonenko/financisto/blob/master/Financisto/src/main/java/ru/orangesoftware/financisto2/backup/DatabaseImport.java

const fs = require('fs'),
      readline = require('readline');
const loki = require('lokijs'),
      db = new loki('NorseGods.json');

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
  let collect = db.getCollection('account');
});

function readLines(input, func) {
  var remaining = '';
  let value;// = {tableName: null};
  let startRead = false;

  input.on('data', data => {
    remaining += data;
    var index = remaining.indexOf('\n');
    while (index > -1) {
      var line = remaining.substring(0, index);
      remaining = remaining.substring(index + 1);
      recoverDatabase(line);
      index = remaining.indexOf('\n');
    }
  });

  input.on('end', () => {
    if (remaining.length > 0) {
      recoverDatabase(remaining, value);
    }
  });
}

function func(data) {
  console.log('Line: ' + data);
}

