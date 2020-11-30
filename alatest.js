var alasql = require("alasql")
var data = [{a:1,b:10}, {a:2,b:20}, {a:1,b:30}];
//var res = alasql('SELECT a, SUM(b) AS b FROM ? GROUP BY a',[data]);
//console.log(res);
var data1 = require('./data.json')
//console.log("listings")
//console.log(data1.content.listings)
var result = alasql('SELECT listingIdSHA FROM ?', [data1.content.listings]);
console.log(result);