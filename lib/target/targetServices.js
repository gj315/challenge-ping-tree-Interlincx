var sendJson = require('send-data/json')

var redis = require('../redis')

module.exports = {
  saveTarget,
  retrieveTargets,
  getTargetById,
  updateTargetById
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
