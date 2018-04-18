var main = require('./lib/authorization.js')
var config = require('./jsreport.config.js')

module.exports = function (options) {
  config.options = options

  config.optionsSchema = {
    extensions: {
      authorization: {
        type: 'object',
        properties: {}
      }
    }
  }

  config.main = main
  config.directory = __dirname
  return config
}
