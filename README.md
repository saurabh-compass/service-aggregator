# Sirius Node

Sirius Node is a generic service aggregator written in nodejs. It is supposed to act on top of an existing ecosystem of rest services for individual entities. It can also work on existing aggregated services to further optimize the number of api calls.
### Setup
Make sure you have nodejs installed on your system. Clone repo and use command **npm start**.

### Features:
  - Do multiple rest calls in parallel and get response in a single network request to Sirius Node.
  - Chain rest calls if there is dependency of data between two api calls
  - Multiple joined queries can be executed in parallel

### Configuration

The configuration is saved in a json file "apiInfo.json". Sample configuration JSON:
```sh
{
    "contacts": {
        "url":"http://staging-mobile-api.compass.com/api/v3/contacts/",
        "joinParams" : {
            "person.personId": {"getParams" : "json.filter.personIDs[]"}
        },
        "method":"GET",
        "defaultGetParams" : {},
        "defaultPostParams" : {},
        "headers":{}
    },
    "board" : {
        "url" : "http://staging-mobile-api.compass.com/api/v3/boards/{pathParam}",
        "method":"GET",
        "defaultGetParams" : {},
        "defaultPostParams" : {},
        "headers":{}
    }
}
```
There are two rest entities onboarded above in configuration. If url contains a path parameter, it can be specified using the template string {pathParam} and then be parametrised later. **method** can be any standard http call to retrieve data GET/POST. The default get / post parameters e.g. pagination params can be set in the **defaultGetParams** **defaultPostParams** , the same is applicable for headers. The default get/post/headers will be overriden by any conflicting data in a reqeust to Sirius Node. 
**joinParams** contains the mapping of column name to the part of request where the dependent data would be kept in request. In the example above **person.personId** is the column name is mapped to the get parameters with json path **json.filter.personIDs[]**. The json path can contain atmost 1 array and should be suffixed with **[]**. A column can also be mapped to post params of request using the key **postParams**.

##### Api to Getting/Updating Configuration at runtime
Get call to localhost:3000/apiConfig will fetch the current configuration json. A post call to localhost:3000/apiConfig with the configuration json as body will update the system in runtime.

## QUERY API
The main query call to Sirius Node is done through a post call to localhost:3000/aggregatorV2. A sample query request:
```sh
{
    "queries" : [{
    	"queryName" : "boardsQuery",
    	"apiQuery":"select * from board as boardsResponse where board.pathParam=\"5f18309565f0aa00015ae939\" "
    	},
    	{
    	"queryName" : "contactsQuery",
    	"apiQuery":"select * from contacts as contactResponse "
    	}
    	],
    "commonHeaders" : {
    	"Authorization" : "<Token Value>",
            "content-type" : "application/json"
    }
}
```
Request contains a list of queries. A single query contains the **queryName** which would be the key for the result of this query in response JSON. **apiQuery** has the query string, the 4 fields that can be set in where clause for an entity are pathParam, getParam, postParam and header.The list of queries would be run parallely by Sirius Node. The common headers for each api call generally used for authentication can be specified in the **commonHeaders** field as key/value pair.

#### Chaining Api Calls
If response data from one api call needs to be used in the request of another api call we can use the chaining feature of nodejs. An example of chained query call:
```sh
{
    "queries" : [
    	{
    	"queryName" : "boardsQuery",
    	"apiQuery":"select * from board as boardsResponse join contacts as contactResponse on board.`board.permissions.profile._id`=contacts.`person.personId` where board.pathParam=\"5f18309565f0aa00015ae939\" "
    	}
    ],
    "commonHeaders" : {
    	"Authorization" : "<Token Value>",
            "content-type" : "application/json"
    }
}
```
**board.`board.permissions.profile._id`=contacts.`person.personId`** this means that the data collected from the json path **board.permissions.profile._id** from board response would be filled in the request to contact entity for the column **person.personId** whose mapping should be mentioned in the configuration json.