var sendJson = require('send-data/json')

module.exports = {
  badRequest,
  validateTarget
}

/**
 * Sends a 400 Bad Request response with an error message
 */
function badRequest (req, res, err) {
  var message = err && err.message ? err.message : 'Something went wrong. Please try again.'
  return sendJson(req, res, {
    statusCode: 400,
    body: { status: message }
  })
}

/**
 * Validates a target object for required fields and correct data types.
 * Ensure 'geoState.$in' and 'hour.$in' inside the 'accept' are arrays.
 */
function validateTarget (targetObj, method = 'add', callback) {
  // check for the existence of required fields
  var requiredFields = [
    targetObj.id,
    targetObj.url,
    targetObj.value,
    targetObj.maxAcceptsPerDay,
    targetObj.accept
  ]

  var acceptFields = [
    targetObj.accept && targetObj.accept.geoState,
    targetObj.accept && targetObj.accept.hour
  ]

  if (method === 'add' && (!requiredFields.every(field => field) || !acceptFields.every(field => field))) {
    return callback(new Error('Required fields are absent'), null)
  }

  // Check if 'geoState.$in' and 'hour.$in' are arrays.
  if (
    !Array.isArray(targetObj.accept.geoState.$in) ||
    !Array.isArray(targetObj.accept.hour.$in)
  ) {
    return callback(new Error('Both "geoState.$in" and "hour.$in" fields must be arrays.'), null)
  }

  return callback(null, targetObj)
}
