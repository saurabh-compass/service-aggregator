var express = require('express');
var apiInfo = require('./apiInfo.json')
const bodyParser = require('body-parser');
var request = require('request');

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

 app.listen(3000);