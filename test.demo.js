const {pathToRegexp} = require("path-to-regexp")

console.log(pathToRegexp);
const regexp = pathToRegexp('/for:id', [], {});
const {} = regexp
console.log('vlaue:', regexp)