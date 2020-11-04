# Sirius Node

**S**ervice **I**nterfacing for **R**esponse **I**ntegration **U**sing **S**QL

Sirius Node is a generic service aggregator written in nodejs. It is supposed to act on top of an existing ecosystem of rest services for individual entities. It can also work on existing aggregated services to further optimize the number of api calls.

## Motivations 
 - A System that sits on top of microservices like a plug and play without much setup hassle or having to change existing services. GraphQL is a great idea implemented with difficult adaptability and proven latent system.

### GOALS
 - Create an easy to use aggregator of services with feature of data manipulation in nosql
 - Avoid multiple deployments for each minor change in response
 - Reach as many people from the developers community as possible (frontend/backend/full stack) which is why we have written in javascript.
 - A Framework that can be used with bare minimum knowledge of json and sql, with no maintenance required in the engine.


 ### Features:
  - Do multiple rest calls in parallel and get response in a single network request to Sirius Node.
  - Chain rest calls if there is dependency of data between two api calls
  - Multiple joined queries can be executed in parallel
  - Modify and map data using underlying integrated nosql engine
