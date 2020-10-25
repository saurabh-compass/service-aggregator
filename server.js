var express = require('express');
var apiInfo = require('./apiInfo.json')
const bodyParser = require('body-parser');
var request = require('request');
const { Parser } = require('node-sql-parser');
var mergeJSON = require("merge-json") ;
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
                keyName : entityRequest["keyName"],
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
       var requestQueries = JSON.parse(data);
       var context = {queriesProcessed:0,indexToEntityNameToDataMap:{}, response:res, indexToWhereMap:{},indexToAliasNameToDataMap:{},totalQueries:requestQueries['queries'].length}
       console.log(requestQueries);
       for(var index = 0;index<requestQueries['queries'].length;index++) {
            var ast = parser.astify(requestQueries['queries'][index]);
            context.indexToEntityNameToDataMap[index] = {}
            context.indexToAliasNameToDataMap[index] = {}
            context.indexToWhereMap[index] = {}
            parseWhereClause(ast.where, context.indexToWhereMap[index])
            console.log(JSON.stringify(ast));
            resolveEntities(ast,context,0,index)
       }
   })
})

function resolveEntities(ast,context,currentFromIndex,currentQueryIndex) {
    if(currentFromIndex >= ast.from.length) {
        context.queriesProcessed++;
        finishProcessing(context)
        return
    }
    //mergeJSON.merge example
    var entityName = ast.from[currentFromIndex].table
    var whereMap = context.indexToWhereMap[currentQueryIndex][entityName];
    var url = apiInfo[entityName].url;
    if(url.includes("{pathParam}")) {
        var pathParam = ""
        if(whereMap)
            pathParam = whereMap.pathParam
        pathParam = pathParam || apiInfo[entityName]["defaultPathParam"] || ""
        url = url.replace("{pathParam}",escape(pathParam));
    }

    var onMap = null, joinGetParams={}, joinPostParams={};
    if(ast.from[currentFromIndex].on) {
        onMap = {}
        parseOnClause(ast.from[currentFromIndex].on, onMap);
        for(var tableName in onMap) {
            for(var columnPath in onMap[tableName]) {
                var collectedData = {}
                collectDataForPath(context.indexToEntityNameToDataMap[currentQueryIndex][tableName], columnPath.split("."), 0, collectedData)
                var createdReqData = {}
                var joinParams = apiInfo[entityName].joinParams[onMap[tableName][columnPath]]
                createJSONPath(collectedData,joinParams["getParams"] || joinParams["postParams"],0,createdReqData)
                if(joinParams["getParams"]) {
                    joinGetParams = mergeJSON.merge(joinGetParams,createdReqData);
                } else {
                    joinPostParams = mergeJSON.merge(joinPostParams,createdReqData);
                }
            }
        }
    }
    var getParams = {}
    if(whereMap && whereMap["getParams"]) {
        getParams = JSON.parse(whereMap["getParams"]);
    }
    getParams = mergeJSON.merge(getParams, apiInfo[entityName]["defaultGetParams"] || {})
    getParams = mergeJSON.merge(getParams, joinGetParams || {})

    var postParams = {}
    if(whereMap && whereMap["postParams"]) {
        postParams = JSON.parse(whereMap["postParams"]);
    }
    postParams = mergeJSON.merge(postParams, apiInfo[entityName]["defaultPostParams"] || {})
    postParams = mergeJSON.merge(postParams, joinPostParams || {})

    var options = {
        uri : url,
        method : apiInfo[entityName].method,
        headers : mergeJSON.merge(apiInfo[entityName].headers || {}, whereMap?(whereMap["headers"]  || {}):{}),
        keyName : ast.from[currentFromIndex].as,
        qs: getParams,
        json: true,
        body: postParams
    }
    var requestFunction = (function () {
        var keyName = options.keyName,localCurrentQueryIndex = currentQueryIndex;
        var localContext = context, localAst = ast, localCurrentFromIndex = currentFromIndex, localEntityName = entityName;
        console.log(options);
        return function () {
            request(options, function (error, response, body) {
                var result = (body.constructor==({}).constructor)?body:JSON.parse(body);
                localContext.indexToEntityNameToDataMap[localCurrentQueryIndex][localEntityName] = result;
                localContext.indexToAliasNameToDataMap[localCurrentQueryIndex][keyName] = result;
                if(error) {
                    resolveEntities(localAst,localContext,localAst.from.length,localCurrentQueryIndex)
                } else {
                    resolveEntities(localAst,localContext,localCurrentFromIndex+1,localCurrentQueryIndex)
                }
            })
        }
    })();
    requestFunction();
}

function finishProcessing(context) {
    if(context.totalQueries == context.queriesProcessed) {
        context.response.json(context.indexToAliasNameToDataMap);
    }
}

function createJSONPath(dataToFill,jsonPath,currentIndex,output) {
    if(currentIndex==jsonPath.length-1) {
        if(jsonPath[currentIndex].endsWith("[]")) {
            output[jsonPath[currentIndex].replace("[]","")]=dataToFill;
        } else {
            output[jsonPath[currentIndex]] = dataToFill;
        }
        return
    }
    if(jsonPath[currentIndex].endsWith("[]")) {
        for(index=0;index<dataToFill;index++) {
            createJSONPath(dataToFill[index],jsonPath,currentIndex+1,output)
        }
    } else {
        output[sonPath[currentIndex]] = {};
        createJSONPath(dataToFill,jsonPath,currentIndex+1,output)
    }
}

function collectDataForPath(jsonData, pathToCollect, currentIndex, output) {
    if(!jsonData)
        return
    if(currentIndex == pathToCollect.length-1) {
        if(jsonData[pathToCollect[currentIndex]] instanceof Array) {
            for(var index=0;index<jsonData[pathToCollect[currentIndex]].length;index++)
                output.push(jsonData[pathToCollect[currentIndex]][index])
        } else {
            output.push(jsonData[pathToCollect[currentIndex]])
        }
        return;
    }
    if(jsonData[pathToCollect[currentIndex]] instanceof Array) {
        for(var index=0;index<jsonData[pathToCollect[currentIndex]].length;index++)
            collectDataForPath(jsonData[pathToCollect[currentIndex]][index], pathToCollect, currentIndex++, output)
    } else {
        collectDataForPath(jsonData[pathToCollect[currentIndex]], pathToCollect, currentIndex++, output)
    }
}

function parseWhereClause(where, whereMap) {
    if(where.operator == '=') {
        whereMap[where.left.table] = whereMap[where.left.table] || {}
        whereMap[where.left.table][where.left.column] = where.right.value;
    } else {
        parseWhereClause(where.left, whereMap);
        parseWhereClause(where.right, whereMap);
    }
}

function parseOnClause(onAst, onMap) {
    if(onAst.operator == '=') {
        onMap[onAst.left.table] = onMap[onAst.left.table] || {}
        onMap[onAst.left.table][onAst.left.column] = onAst.right.column;
    } else {
        parseOnClause(onAst.left, onMap);
        parseOnClause(onAst.right, onMap);
    }
}


app.listen(3000);