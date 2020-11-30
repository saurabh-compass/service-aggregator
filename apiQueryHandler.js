var apiInfo = require('./apiInfo.json');
var mergeJSON = require("merge-json");
const { Parser } = require('node-sql-parser');
const parser = new Parser();
var request = require('request');
function formatQuery(queryString) {
    if (!queryString.match(/^ *select *\*/gmi))
        return "select * " + queryString;
    return queryString;
}

function resolveEntities(ast, queryContext, queryCompleteCallback) {
    var currentFromIndex = queryContext.currentFromIndex;
    if (currentFromIndex >= ast.from.length) {
        queryCompleteCallback();
        return
    }
    //mergeJSON.merge example
    var entityName = ast.from[currentFromIndex].table
    var whereMap = queryContext.whereMap[entityName];
    var url = apiInfo[entityName].url;
    if (url.includes("{pathParam}")) {
        var pathParam = ""
        if (whereMap)
            pathParam = whereMap.pathParam
        pathParam = pathParam || apiInfo[entityName]["defaultPathParam"] || ""
        url = url.replace("{pathParam}", escape(pathParam));
    }

    var onMap = null, joinGetParams = {}, joinPostParams = {};
    if (ast.from[currentFromIndex].on) {
        onMap = {}
        parseOnClause(ast.from[currentFromIndex].on, onMap);
        for (var tableName in onMap) {
            for (var columnPath in onMap[tableName]) {
                var collectedData = []
                collectDataForPath(queryContext.entityNameToDataMap[tableName], columnPath.split("."), 0, collectedData)
                var createdReqData = {}
                var joinParams = apiInfo[entityName].joinParams[onMap[tableName][columnPath]]
                var joinRightPath = joinParams["getParams"] || joinParams["postParams"];
                createJSONPath(collectedData, joinRightPath.split("."), 0, createdReqData)
                if (joinParams["getParams"]) {
                    joinGetParams = mergeJSON.merge(joinGetParams, createdReqData);
                } else {
                    joinPostParams = mergeJSON.merge(joinPostParams, createdReqData);
                }
            }
        }
    }
    var getParams = {}
    if (whereMap && whereMap["getParams"]) {
        getParams = JSON.parse(whereMap["getParams"]);
    }
    getParams = mergeJSON.merge(getParams, apiInfo[entityName]["defaultGetParams"] || {})
    getParams = mergeJSON.merge(getParams, joinGetParams || {})

    var postParams = {}
    if (whereMap && whereMap["postParams"]) {
        postParams = JSON.parse(whereMap["postParams"]);
    }
    postParams = mergeJSON.merge(postParams, apiInfo[entityName]["defaultPostParams"] || {})
    postParams = mergeJSON.merge(postParams, joinPostParams || {})

    var parsedGetParams = ""
    for (var getKey in getParams) {
        parsedGetParams += getKey + "=" + escape(JSON.stringify(getParams[getKey])) + "&"
    }
    if (parsedGetParams) {
        url += "?" + parsedGetParams;
    }
    var headers = mergeJSON.merge(apiInfo[entityName].headers || {}, whereMap ? (whereMap["headers"] || {}) : {});
    headers = mergeJSON.merge(headers, queryContext.commonHeaders || {});
    var options = {
        uri: url,
        method: apiInfo[entityName].method,
        headers: headers,
        keyName: ast.from[currentFromIndex].as,
        //qs: parsedGetParams,
        json: true,
        body: postParams
    }
    var requestFunction = (function () {
        var keyName = options.keyName;
        var localContext = queryContext, localAst = ast, localCurrentFromIndex = currentFromIndex, localEntityName = entityName;
        return function () {
            request(options, function (error, response, body) {
                var result = (body.constructor == ({}).constructor) ? body : JSON.parse(body);
                localContext.entityNameToDataMap[localEntityName] = result;
                localContext.contextKeys[keyName] = result;
                if (error) {
                    // Setting FromIndex to max to end recursion
                    localContext.currentFromIndex = localAst.from.length;
                    resolveEntities(localAst, localContext, queryCompleteCallback)
                } else {
                    localContext.currentFromIndex = localCurrentFromIndex + 1;
                    resolveEntities(localAst, localContext, queryCompleteCallback)
                }
            })
        }
    })();
    requestFunction();
}

function createJSONPath(dataToFill, jsonPath, currentIndex, output) {
    if (currentIndex == jsonPath.length - 1) {
        if (jsonPath[currentIndex].endsWith("[]")) {
            output[jsonPath[currentIndex].replace("[]", "")] = dataToFill;
        } else {
            output[jsonPath[currentIndex]] = dataToFill;
        }
        return
    }
    if (jsonPath[currentIndex].endsWith("[]")) {
        for (index = 0; index < dataToFill; index++) {
            createJSONPath(dataToFill[index], jsonPath, currentIndex + 1, output)
        }
    } else {
        output[jsonPath[currentIndex]] = {};
        createJSONPath(dataToFill, jsonPath, currentIndex + 1, output[jsonPath[currentIndex]])
    }
}

function collectDataForPath(jsonData, pathToCollect, currentIndex, output) {
    if (!jsonData)
        return
    if (currentIndex == pathToCollect.length - 1) {
        if (jsonData[pathToCollect[currentIndex]] instanceof Array) {
            for (var index = 0; index < jsonData[pathToCollect[currentIndex]].length; index++)
                output.push(jsonData[pathToCollect[currentIndex]][index])
        } else {
            output.push(jsonData[pathToCollect[currentIndex]])
        }
        return;
    }
    if (jsonData[pathToCollect[currentIndex]] instanceof Array) {
        var itrLen = (jsonData[pathToCollect[currentIndex]]).length;
        for (var index = 0; index < itrLen; index++) {
            collectDataForPath(jsonData[pathToCollect[currentIndex]][index], pathToCollect, currentIndex + 1, output)
        }
    } else {
        collectDataForPath(jsonData[pathToCollect[currentIndex]], pathToCollect, currentIndex + 1, output)
    }
}

function parseWhereClause(where, whereMap) {
    if (where.operator == '=') {
        whereMap[where.left.table] = whereMap[where.left.table] || {}
        whereMap[where.left.table][where.left.column] = where.right.value;
    } else {
        parseWhereClause(where.left, whereMap);
        parseWhereClause(where.right, whereMap);
    }
}

function parseOnClause(onAst, onMap) {
    if (onAst.operator == '=') {
        onMap[onAst.left.table] = onMap[onAst.left.table] || {}
        onMap[onAst.left.table][onAst.left.column] = onAst.right.column;
    } else {
        parseOnClause(onAst.left, onMap);
        parseOnClause(onAst.right, onMap);
    }
}

module.exports.processApiQuery = function(apiQuery, context, queryCompleteCallback) {
    var ast = parser.astify(formatQuery(apiQuery.query));
    var queryContext = {};
    queryContext.entityNameToDataMap = {};
    queryContext.whereMap = {};
    queryContext.currentFromIndex = 0;
    queryContext.commonHeaders = context.commonHeaders;
    queryContext.contextKeys = context.contextKeys;
    if (ast.where)
        parseWhereClause(ast.where, queryContext.whereMap)
    resolveEntities(ast, queryContext, queryCompleteCallback)
}