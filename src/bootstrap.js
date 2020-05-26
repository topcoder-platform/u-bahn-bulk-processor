/**
 * Init app
 */

global.Promise = require('bluebird')
const Joi = require('@hapi/joi')

Joi.id = () => Joi.string().uuid().required()
