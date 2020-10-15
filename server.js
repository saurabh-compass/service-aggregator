var express = require('express');
var apiInfo = require('./apiInfo.json')
const bodyParser = require('body-parser');
var request = require('request');
const { Parser } = require('node-sql-parser');
const parser = new Parser();

var app = express();
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function(req, res){
    res.send("Hello world!");
 });
app.post('/aggregator', function(req, res) {
     var data = '';
    req.on("data", function(chunk) {
        data+=chunk;
    })
    req.on("end", function() {
        var result = {}
        var requestQuery = JSON.parse(data);
        var requestCount = 0;
        console.log(requestQuery);
        for(var index=0;index<requestQuery['entities'].length;index++) {
            var entityRequest = requestQuery['entities'][index];
            var url = apiInfo[entityRequest["entity"]].url;
            if(entityRequest.pathParam) {
                url = url.replace("{pathParam}",entityRequest.pathParam);
            }
            var options = {
                uri : url,
                method : apiInfo[entityRequest["entity"]].method,
                headers : apiInfo[entityRequest["entity"]].headers,
                keyName : entityRequest["keyName"]
            }
            var requestFunction = (function () {
                var queryIndex = index;
                return function () {
                    request(options, function (error, response, body) {
                        result[requestQuery['entities'][queryIndex]["keyName"]] = JSON.parse(body);
                        requestCount++;
                        if(requestCount == requestQuery['entities'].length) {
                            res.json(result);
                        }
                      })
                }
              })();
            requestFunction()
        }
    })
 })

 app.post('/aggregatorV2', function(req, res) {
    var data = '';
   req.on("data", function(chunk) {
       data+=chunk;
   })
   req.on("end", function() {
       var result = {}
       var requestQueries = JSON.parse(data);
       var requestCount = 0;
       console.log(requestQueries);
       for(var index = 0;index<requestQueries['queries'].length;index++) {
            var ast = parser.astify(requestQueries['queries'][index]);
            console.log(ast);
            var entityName = ast.from[0].table;
            var url = apiInfo[entityName].url;
            if(ast.where && ast.where.left && ast.where.left.column == "pathParam") {
                url = url.replace("{pathParam}",escape(ast.where.right.value));
            }
            var options = {
                uri : url,
                method : apiInfo[entityName].method,
                headers : apiInfo[entityName].headers,
                keyName : ast.from[0].as
            }
            var requestFunction = (function () {
                var keyName = options.keyName;
                return function () {
                    request(options, function (error, response, body) {
                        result[keyName] = JSON.parse(body);
                        requestCount++;
                        if(requestCount == requestQueries['queries'].length) {
                            res.json(result);
                        }
                      })
                }
              })();
            requestFunction();
       }
       //res.send("in progress");
   })
})

 app.listen(3000);