/**
 * Processor Service
 */

const _ = require('lodash')
const Joi = require('@hapi/joi')
const config = require('config')
const logger = require('../common/logger')
const helper = require('../common/helper')

/**
 * Creates the user in UBahn api as well as Topcoder's Users api
 * @param {Object} user The user to create
 */
async function createUser (user) {
  // Create the user in UBahn api
  const ubahnUserId = (await helper.createUbahnRecord('/users', {
    handle: user.handle
  })).id

  const { handle, firstName, lastName, email, countryName, providerType, provider, userId } = user

  const topcoderUser = {
    handle,
    firstName,
    lastName,
    email,
    active: true, // Verified user
    country: {
      name: countryName
    },
    profile: {
      providerType,
      provider,
      userId
    },
    credential: {
      password: ''
    }
  }

  // Create the user in topcoder's Users api
  await helper.createUserInTopcoder(topcoderUser)

  // We will be only working with the user id in UBahn
  return ubahnUserId
}

/**
 * Function to get user id
 * @param {Object} user
 * @returns {Promise}
 */
async function getUserId (user) {
  const record = await helper.getUbahnSingleRecord('/users', {
    handle: user.handle
  }, true)
  if (record) {
    return record.id
  }

  // No user found. Should we create the user or treat it as an error?
  if (config.CREATE_MISSING_USER_FLAG) {
    return createUser(user)
  } else {
    throw new Error(`Could not find user with handle ${user.handle}`)
  }
}

/**
 * Function to create user skill
 * @param {String} userId
 * @param {String} skillProviderName
 * @param {String} skillName
 * @param {String} certifierId
 * @param {String} certifiedDate
 * @param {String} metricValue
 * @returns {Promise}
 */
async function createUserSkill (userId, skillProviderName, skillName, certifierId, certifiedDate, metricValue) {
  const skillProvider = await helper.getUbahnSingleRecord('/skillsProviders', { name: skillProviderName })
  const skill = await helper.getUbahnSingleRecord('/skills', { skillProviderId: skillProvider.id, name: skillName })
  helper.createUbahnRecord(`/users/${userId}/skills`, { certifierId, certifiedDate, metricValue, skillId: skill.id })
}

/**
 * Function to create user achievement
 * @param {String} userId
 * @param {String} providerName
 * @param {String} certifierId
 * @param {String} certifiedDate
 * @param {String} name
 * @param {String} uri
 * @returns {Promise}
 */
async function createAchievement (userId, providerName, certifierId, certifiedDate, name, uri) {
  const achievementsProvider = await helper.getUbahnSingleRecord('/achievementsProviders', { name: providerName })
  helper.createUbahnRecord(`/users/${userId}/achievements`, { certifierId, certifiedDate, name, uri, achievementsProviderId: achievementsProvider.id })
}

/**
 * Function to create user attributes
 * @param {String} userId
 * @param {Object} record
 * @returns {Promise}
 */
async function createUserAttributes (userId, record) {
  let i = 1
  while (record[`attributeValue${i}`]) {
    const attributeGroup = await helper.getUbahnSingleRecord('/attributeGroups', { name: record[`attributeGroupName${i}`] })
    const attribute = await helper.getUbahnSingleRecord('/attributes', { attributeGroupId: attributeGroup.id, name: record[`attributeName${i}`] })
    await helper.createUbahnRecord(`/users/${userId}/attributes`, { attributeId: attribute.id, value: record[`attributeValue${i}`] })
    i++
  }
}

/**
 * Function to process record
 * @param {Object} record
 * @param {Array} failedRecord then failed records container
 * @returns {Promise}
 */
async function processCreateRecord (record, failedRecord) {
  try {
    const userId = await getUserId(record)
    await createUserSkill(userId, record.skillProviderName, record.skillName, record.skillCertifierId, record.skillCertifiedDate, record.metricValue)
    await createAchievement(userId, record.achievementsProviderName, record.achievementsCertifierId, record.achievementsCertifiedDate, record.achievementsName, record.achievementsUri)
    await createUserAttributes(userId, record)
  } catch (err) {
    failedRecord.push(_.assign(record, { validationMessage: err.message }))
  }
}

/**
 * Process create entity message
 * @param {Object} message the kafka message
 * @returns {Promise}
 */
async function processCreate (message) {
  const { resource, status } = message.payload

  if (resource !== 'upload') {
    logger.info('Ignoring this message since resource is not `upload`')

    return
  }

  if (status === 'pending') {
    try {
      const file = await helper.downloadFile(message.payload.url)
      const records = helper.parseExcel(file)
      const failedRecord = []

      await Promise.map(records, record => processCreateRecord(record, failedRecord), { concurrency: config.PROCESS_CONCURRENCY_COUNT })

      if (failedRecord.length > 0) {
        await helper.uploadFailedRecord(failedRecord, message.payload.url)
      }
      await helper.updateProcessStatus(message.payload.id, { status: 'completed' })
      logger.info(`process the record completed, id: ${message.payload.id}, success count: ${records.length - failedRecord.length}, fail count: ${failedRecord.length}`)
    } catch (err) {
      await helper.updateProcessStatus(message.payload.id, { status: 'failed', info: err.message })
      logger.error(`process the record failed, err: ${err.message}`)
    }
  } else {
    logger.info('Ignore this message since status is not pending')
  }
}

processCreate.schema = {
  message: Joi.object().keys({
    topic: Joi.string().required(),
    originator: Joi.string().required(),
    timestamp: Joi.date().required(),
    'mime-type': Joi.string().required(),
    payload: Joi.object().keys({
      url: Joi.string().required(),
      status: Joi.string().required(),
      info: Joi.string(),
      id: Joi.id()
    }).required().unknown(true)
  }).required()
}

module.exports = {
  processCreate
}

logger.buildService(module.exports)
