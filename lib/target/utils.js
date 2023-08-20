var sendJson = require('send-data/json')

module.exports = {
  badRequest,
  validateTarget,
  validateReqParams,
  validateDecisionReqBody,
  filterByGeoStateAndHour,
  sortByValueDesc,
  extractHourFromTimestamp,
  sendDecision,
  findAcceptableTarget
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

  if (!targetObj.accept) {
    return callback(new Error('Required fields are absent'), null)
  }

  var acceptFields = [
    targetObj.accept && targetObj.accept.geoState,
    targetObj.accept && targetObj.accept.hour
  ]

  if (method === 'update' && !requiredFields.some(Boolean)) {
    return callback(new Error('At least one field is required'), null)
  }

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

/**
 * Validates the request parameters to ensure a valid ID is provided.
 * The callback is invoked with an error if the validation fails, otherwise with the valid ID.
 */
function validateReqParams (params, callback) {
  if (!params || !params.id) {
    return callback(new Error('Id param is missing'), null)
  }

  var idNumber = Number(params.id)

  if (isNaN(idNumber) || idNumber <= 0 || idNumber % 1 !== 0) {
    return callback(new Error('Id param should be a positive integer'), null)
  }

  return callback(null, idNumber)
}

/**
 * Validates visitor data based on geoState and timestamp properties.
 * @param {Object} visitorInfo - The data to validate.
 * @param {Function} callback - Callback after validation.
 */
function validateDecisionReqBody (visitorInfo, callback) {
  if (!hasRequiredFields(visitorInfo)) {
    return callback(new Error('Required fields are missing'), null)
  }

  if (!isValidGeoState(visitorInfo.geoState)) {
    return callback(new Error('geoState must be a string of length 2'), null)
  }

  if (!isValidTimestamp(visitorInfo.timestamp)) {
    return callback(new Error('The timestamp should be in the Date format.'), null)
  }

  return callback(null, visitorInfo)
}

function hasRequiredFields (data) {
  return data.geoState && data.timestamp
}

function isValidGeoState (geoState) {
  return typeof geoState === 'string' && geoState.length === 2
}

function isValidTimestamp (timestamp) {
  var dateObject = new Date(timestamp)
  return dateObject instanceof Date && !isNaN(dateObject)
}

function filterByGeoStateAndHour (allTargets, specifiedGeoState, specifiedHour) {
  return allTargets.filter(function (target) {
    return target.accept.geoState.$in.includes(specifiedGeoState) &&
      target.accept.hour.$in.includes(specifiedHour)
  })
}

function sortByValueDesc (unsortedTargets) {
  return unsortedTargets.sort(function (a, b) {
    return Number(b.value) - Number(a.value)
  })
}

/**
* Extracts the hour from the provided timestamp.
* Converts the timestamp to a Date object and retrieves the UTC hour.
*/
function extractHourFromTimestamp (timestamp) {
  return new Date(timestamp).getUTCHours().toString()
}

/**
* Sends a decision response to the client.
* Uses the given decisionValue as the decision in the response.
*/
function sendDecision (req, res, decisionValue) {
  sendJson(req, res, { decision: decisionValue })
}

/**
* Finds an acceptable target based on their daily limits.
* Iterates through targets and their current counts to decide.
*/
function findAcceptableTarget (prioritizedTargets, acceptsTodayValues) {
  for (var i = 0; i < acceptsTodayValues.length; i++) {
    var acceptsToday = Number(acceptsTodayValues[i] || 0)
    var target = prioritizedTargets[i]

    if (Number(target.maxAcceptsPerDay) > acceptsToday) {
      return { target, acceptsToday }
    }
  }
  return null
}
