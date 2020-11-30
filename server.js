var express = require('express');
var apiInfo = require('./apiInfo.json')
const bodyParser = require('body-parser');
var workFlowManager = require('./workFlowManager');
var app = express();
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function (req, res) {
    res.send("Hello world!");
});

app.get('/apiConfig', function (req, res) {
    res.json(apiInfo);
});

app.post("/apiConfig", function (req, res) {
    var dataConfig = '';
    req.on("data", function (chunk) {
        dataConfig += chunk;
    })
    req.on("end", function () {
        apiInfo = JSON.parse(dataConfig);
        res.send("Api Config Updated");
    })
})

app.post('/aggregator', function (req, res) {
    var data = '';
    req.on("data", function (chunk) {
        data += chunk;
    })
    req.on("end", function () {
        var workFlowsRequest = JSON.parse(data);
        workFlowManager.processWorkFlow(workFlowsRequest.workflows, res);
    })
})

app.listen(3000);