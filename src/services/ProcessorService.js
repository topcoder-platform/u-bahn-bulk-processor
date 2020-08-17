/**
 * Processor Service
 */

const _ = require('lodash')
const Joi = require('@hapi/joi')
const config = require('config')
const logger = require('../common/logger')
const helper = require('../common/helper')

/**
 * Creates user in ubahn
 * @param {Object} param0 The user details
 */
async function createUserInUbahn ({ handle, firstName, lastName }) {
  logger.debug(`Creating user with handle ${handle} in Ubahn`)

  try {
    const user = await helper.createUbahnRecord('/users', {
      handle,
      firstName,
      lastName
    })

    return user.id
  } catch (error) {
    logger.error('An error occurred creating the user in ubahn')
    logger.error(error)
    // Throw it to fail processing of this record
    throw error
  }
}

/**
 * Creates user in Topcoder
 * @param {Object} user The user details
 */
async function createUserInTopcoder (user) {
  const { handle, firstName, lastName, email, countryName, providerType, provider, userId } = user
  logger.debug(`Creating user with handle ${handle} in Topcoder`)

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

  try {
    // Create the user in topcoder's Users api
    const newUser = await helper.createUserInTopcoder(topcoderUser)
    return newUser.result.content.id
  } catch (error) {
    logger.error('An error occurred creating the user in topcoder')
    logger.error(error)
    // Throw it to fail processing of this record
    throw error
  }
}

/**
 * Creates the user in UBahn api as well as Topcoder's Users api
 * @param {Object} user The user to create
 * @param {String} organizationId The org id to associate the new user with
 */
async function createUser (user, organizationId) {
  // Create the user in Topcoder
  const topcoderUserId = await createUserInTopcoder(user)

  // Create the user in UBahn api
  const ubahnUserId = await createUserInUbahn(user)

  // Now, proceed to map the topcoder user id with the ubahn user id
  await helper.createUbahnRecord(`/users/${ubahnUserId}/externalProfiles`, {
    organizationId,
    externalId: topcoderUserId
  })

  // We will be only working with the user id in UBahn
  return ubahnUserId
}

/**
 * Function to get user id
 * @param {Object} user
 * @param {Object} organizationId The org id to associate a new user with
 * @returns {Promise}
 */
async function getUserId (user, organizationId) {
  const record = await helper.getUbahnSingleRecord('/users', {
    handle: user.handle
  }, true)
  if (record) {
    return record.id
  }

  // No user found. Should we create the user or treat it as an error?
  if (config.CREATE_MISSING_USER_FLAG) {
    return createUser(user, organizationId)
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
  if ((!skillProviderName || !skillName) && (certifierId || certifiedDate || metricValue)) {
    throw Error(`Skill provider or skill name is missing for user with id ${userId} `)
  } else if (!skillProviderName || !skillName) {
    // Empty values. Ignore.
    return
  }
  const skillProvider = await helper.getUbahnSingleRecord('/skillsProviders', { name: skillProviderName })
  const skill = await helper.getUbahnSingleRecord('/skills', { skillProviderId: skillProvider.id, name: skillName })

  // Does the skill already exist on the user?
  const existingSkill = await helper.getUbahnSingleRecord(`/users/${userId}/skills/${skill.id}`, {}, true)

  if (!existingSkill || !existingSkill.id) {
    await helper.createUbahnRecord(`/users/${userId}/skills`, { certifierId, certifiedDate, metricValue, skillId: skill.id })
  } else {
    await helper.updateUBahnRecord(`/users/${userId}/skills/${skill.id}`, { certifierId, certifiedDate, metricValue })
  }
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
  if (!providerName && (certifierId || certifiedDate || name || uri)) {
    throw Error(`Achievement provider name is missing for user with id ${userId}`)
  } else if (!providerName) {
    // Empty values. Ignore.
    return
  }
  const achievementsProvider = await helper.getUbahnSingleRecord('/achievementsProviders', { name: providerName })
  const existingAchievement = await helper.getUbahnSingleRecord(`/users/${userId}/achievements/${achievementsProvider.id}`, {}, true)

  if (!existingAchievement || !existingAchievement.id) {
    await helper.createUbahnRecord(`/users/${userId}/achievements`, { certifierId, certifiedDate, name, uri, achievementsProviderId: achievementsProvider.id })
  } else {
    await helper.updateUBahnRecord(`/users/${userId}/achievements/${achievementsProvider.id}`, { certifierId, certifiedDate, name, uri })
  }
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
    if ((!record[`attributeGroupName${i}`] || !record[`attributeName${i}`]) && record[`attributeValue${i}`]) {
      throw Error(`Attribute group name or attribute name is missing for user with id ${userId} and with attribute value ${record[`attributeValue${i}`]}`)
    } else if (!record[`attributeGroupName${i}`] || !record[`attributeName${i}`]) {
      // Empty values. Ignore.
      return
    }
    const attributeGroup = await helper.getUbahnSingleRecord('/attributeGroups', { name: record[`attributeGroupName${i}`] })
    const attribute = await helper.getUbahnSingleRecord('/attributes', { attributeGroupId: attributeGroup.id, name: record[`attributeName${i}`] })
    const value = _.toString(record[`attributeValue${i}`])

    const existingAttribute = await helper.getUbahnSingleRecord(`/users/${userId}/attributes/${attribute.id}`, {}, true)

    if (!existingAttribute || !existingAttribute.id) {
      await helper.createUbahnRecord(`/users/${userId}/attributes`, { attributeId: attribute.id, value })
    } else {
      await helper.updateUBahnRecord(`/users/${userId}/attributes/${attribute.id}`, { value })
    }
    i++
  }
}

/**
 * Function to process record
 * @param {Object} record
 * @param {Array} failedRecord then failed records container
 * @param {String} organizationId The org id to associate a new user with
 * @returns {Promise}
 */
async function processCreateRecord (record, failedRecord, organizationId) {
  try {
    const userId = await getUserId(record, organizationId)
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
  const { status } = message.payload

  if (status === 'pending') {
    try {
      const file = await helper.downloadFile(message.payload.objectKey)
      const records = helper.parseExcel(file)
      const failedRecord = []

      await Promise.map(records, record => processCreateRecord(record, failedRecord, message.payload.organizationId), { concurrency: config.PROCESS_CONCURRENCY_COUNT })

      if (failedRecord.length > 0) {
        await helper.uploadFailedRecord(failedRecord, message.payload.objectKey)
      }
      await helper.updateProcessStatus(message.payload.id, { status: 'completed' })
      logger.info(`processing of the record(s) completed, id: ${message.payload.id}, success count: ${records.length - failedRecord.length}, fail count: ${failedRecord.length}`)
    } catch (err) {
      await helper.updateProcessStatus(message.payload.id, { status: 'failed', info: err.message })
      logger.error(`processing of the record(s) failed with error: ${err.message}`)
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
      resource: Joi.string().required(),
      objectKey: Joi.string().required(),
      status: Joi.string().required(),
      organizationId: Joi.string().required(),
      id: Joi.id()
    }).required().unknown(true)
  }).required()
}

module.exports = {
  processCreate
}

logger.buildService(module.exports)
