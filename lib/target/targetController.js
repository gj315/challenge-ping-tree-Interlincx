var body = require('body/json')
var sendJson = require('send-data/json')

var utils = require('./utils')
var targetServices = require('./targetServices')

module.exports = {
  addTarget,
  getAllTargets
}

/**
 * Add a new target
 *
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @param {Object} options - Optional parameters for the request.
 * @param {Function} callback - Callback function to handle the response
 */
function addTarget (req, res, options, callback) {
  body(req, res, function (error, bodyResponse) {
    if (error) return utils.badRequest(req, res, error)
    utils.validateTarget(bodyResponse, 'add', function (err, targetObj) {
      if (err) return utils.badRequest(req, res, err)
      targetServices.saveTarget({ targetObj, req, res, callback })
    })
  })
}

/**
 * Retrieves a list of all targets
 *
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 */
function getAllTargets (req, res) {
  targetServices.retrieveTargets(function (error, targetsResponse) {
    if (error) return utils.badRequest(req, res, error)
    sendJson(req, res, {
      status: 'OK',
      data: targetsResponse
    })
  })
}
