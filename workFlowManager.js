var apiQueryHandler = require("./apiQueryHandler")
var dataQueryHandler = require("./dataQueryHandler")
function processSingleWorkFlow(workFlowContextMap, currentWorkFlowIndex) {
    var currentQueryIndex = 0;
    var currentWorkFlow = workFlowContextMap[currentWorkFlowIndex];
    if(currentWorkFlow.totalQueries > 0) {
        processQueries(currentWorkFlow, currentQueryIndex, (function(){
            onWorkflowComplete(workFlowContextMap, res);
        })())
    }
}

function onWorkflowComplete(workFlowContextMap, res) {
    workFlowContextMap.completedWorkFlows++;
    if (workFlowContextMap.completedWorkFlows >= workFlowContextMap.totalWorkFlows) {
        var result = {};
        for(var index=0;index < workFlowContextMap.totalWorkFlows; index++) {
            result[workFlowContextMap[index].responseKey] = workFlowContextMap[index].contextKeys;
        }
        response.json(result);
    }
}

function onQueryComplete(workFlowContext, currentQueryIndex, workFlowCompleteCallback) {
    processQueries(workFlowContext, currentQueryIndex + 1, workFlowCompleteCallback);
}

function processQueries(workFlowContext, currentQueryIndex, workFlowCompleteCallback) {
    if(currentQueryIndex >= workFlowContext.totalQueries) {
        workFlowCompleteCallback();
    }
    var query = workFlowContext.context.requestQueries[currentQueryIndex];
    var queryType = requestQueries['queries'][index].type;
    if (queryType == "api") {
        apiQueryHandler.processApiQuery(query, workFlowContext.context, (function(){
            onQueryComplete(workFlowContext, currentQueryIndex, workFlowCompleteCallback)
        })());
    } else if (queryType == "data") {
        dataQueryHandler.processApiQuery(query, workFlowContext.context, (function(){
            onQueryComplete(workFlowContext, currentQueryIndex, workFlowCompleteCallback)
        })());
    } else if(queryType == "contextSelection") {

    }
}

module.exports.processWorkFlow = function(workFlows, res) {
    var workFlowContextMap = {completedWorkFlows:0,totalWorkFlows:workFlows.length};
        for (var workFlowIndex = 0; workFlowIndex < workFlows.length; workFlowIndex++) {
            var context = {
                queriesProcessed: 0,
                indexToEntityNameToDataMap: {},
                response: res,
                indexToWhereMap: {},
                indexToAliasNameToDataMap: {},
                totalQueries: workFlows[workFlowIndex]["queries"].length,
                requestQueries: workFlows[workFlowIndex]["queries"],
                responseKey: workFlows[workFlowIndex]["responseKey"],
                commonHeaders: workFlows[workFlowIndex]["commonHeaders"],
                contextKeys: {}
            }
            workFlowContextMap[workFlowIndex] = {context:context,workFlowComplete:false};
            processSingleWorkFlow(workFlowContextMap, workFlowIndex);
        }
}