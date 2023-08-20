var sendJson = require('send-data/json')

var redis = require('../redis')
var utils = require('./utils')

module.exports = {
  saveTarget,
  retrieveTargets,
  getTargetById,
  updateTargetById,
  getDetermineDecision
}

/**
 * Saves a target to Redis
 */
function saveTarget (context) {
  var { targetObj, req, res, callback } = context

  redis.sadd('targets', `target:${targetObj.id}`, function (err, redisResp) {
    if (err) return callback(err)

    if (!redisResp) {
      return sendJson(req, res, {
        statusCode: 400,
        body: {
          status: 'Target already exists. Please try with a different target id.'
        }
      })
    }

    redis.set(`target:${targetObj.id}`, JSON.stringify(targetObj), function (error, redisResp) {
      if (error) return callback(error)
      sendJson(req, res, { status: redisResp })
    })
  })
}

/**
 * Retrieve all targets
 * @param {Function} callback - The callback function to handle results or errors
 */
function retrieveTargets (callback) {
  redis.SMEMBERS('targets', function (error, targets) {
    if (error) return callback(error, null)

    if (!targets.length) return callback(null, [])

    redis.mget(targets, function (error, targetsValue) {
      if (error) return callback(error, null)

      var listTargets = []
      targetsValue.forEach(function (target) {
        if (target) {
          listTargets.push(JSON.parse(target))
        }
      })

      callback(null, listTargets)
    })
  })
}

/**
 * Retrieves a target by its ID from the Redis.
 */
function getTargetById (context) {
  var { targetId, req, res, callback } = context

  redis.get(`target:${targetId}`, function (err, targetResponse) {
    if (err) return callback(err)

    if (!targetResponse) {
      return sendJson(req, res, {
        statusCode: 404,
        body: {
          status: 'Target does not exist with this ID'
        }
      })
    }

    sendJson(req, res, {
      status: 'OK',
      target: JSON.parse(targetResponse)
    })
  })
}

/**
 * Updates a target in the Redis store by its ID.
 */
function updateTargetById (context) {
  var { targetId, data, req, res, callback } = context

  redis.get(`target:${targetId}`, function (err, currentTarget) {
    if (err) return callback(err)

    if (!currentTarget) {
      return sendJson(req, res, {
        statusCode: 404,
        body: {
          status: 'The specified target ID does not exist. Please enter a valid target ID'
        }
      })
    }

    data.id = `${targetId}`
    currentTarget = JSON.parse(currentTarget)
    var updatedTarget = Object.assign(currentTarget, data)

    redis.set(`target:${updatedTarget.id}`, JSON.stringify(updatedTarget), function (err, value) {
      if (err) return callback(err)
      return sendJson(req, res, {
        status: value
      })
    })
  })
}

/**
 * Determines the decision based on the given context.
 * Uses other helper functions for filtering and processing targets.
 */
function getDetermineDecision (context) {
  var { reqBody, req, res, callback } = context
  retrieveTargets(function (err, targets) {
    if (err) return callback(err)

    var hour = utils.extractHourFromTimestamp(reqBody.timestamp)
    var relevantTargets = utils.filterByGeoStateAndHour(targets, reqBody.geoState, hour)

    if (relevantTargets.length === 0) {
      return utils.sendDecision(req, res, 'reject')
    }

    var prioritizedTargets = utils.sortByValueDesc(relevantTargets)
    _processTargets(prioritizedTargets, req, res, callback)
  })
}

/**
* Processes the prioritized targets by checking their daily limits.
* Queries Redis for their current counts and decides on an appropriate target.
*/
function _processTargets (prioritizedTargets, req, res, callback) {
  var targetKeys = prioritizedTargets.map(target => `target:${target.id}:acceptsToday`)

  redis.mget(targetKeys, function (err, acceptsTodayValues) {
    if (err) return callback(err)

    var foundTargetRes = utils.findAcceptableTarget(prioritizedTargets, acceptsTodayValues)

    if (foundTargetRes && foundTargetRes.target) {
      _updateTargetInRedis(foundTargetRes, function (err, respTargetUpdate) {
        if (err) callback(err)
        return utils.sendDecision(req, res, foundTargetRes.target.url)
      })
    } else {
      return utils.sendDecision(req, res, 'reject')
    }
  })
}

/**
* Updates the accepted count of a target in Redis.
* Uses expiration based on the time left for the day.
*/
function _updateTargetInRedis (context, callback) {
  var { acceptsToday, target } = context

  var millisecondsToMidnight = new Date().setUTCHours(24, 0, 0, 0) - new Date()
  var expirationTime = Math.round(millisecondsToMidnight / 1000)

  redis.setex(`target:${target.id}:acceptsToday`, expirationTime, acceptsToday + 1, function (err, redisResp) {
    if (err) return callback(err)
    callback(null, redisResp)
  })
}
