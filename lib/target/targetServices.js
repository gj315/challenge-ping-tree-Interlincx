var sendJson = require('send-data/json')

var redis = require('../redis')

module.exports = {
  saveTarget
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
