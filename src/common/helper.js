/**
 * Contains generic helper methods
 */
const _ = require('lodash')
const AWS = require('aws-sdk')
const XLSX = require('xlsx')
const axios = require('axios')
const config = require('config')
const m2mAuth = require('tc-core-library-js').auth.m2m
const logger = require('./logger')

AWS.config.region = config.get('AWS_REGION')
const s3 = new AWS.S3()

const ubahnM2MConfig = _.pick(config, ['AUTH0_URL', 'AUTH0_UBAHN_AUDIENCE', 'TOKEN_CACHE_TIME', 'AUTH0_PROXY_SERVER_URL'])
const topcoderM2MConfig = _.pick(config, ['AUTH0_URL', 'AUTH0_TOPCODER_AUDIENCE', 'TOKEN_CACHE_TIME', 'AUTH0_PROXY_SERVER_URL'])

const ubahnM2M = m2mAuth({ ...ubahnM2MConfig, AUTH0_AUDIENCE: ubahnM2MConfig.AUTH0_UBAHN_AUDIENCE })
const topcoderM2M = m2mAuth({ ...topcoderM2MConfig, AUTH0_AUDIENCE: topcoderM2MConfig.AUTH0_TOPCODER_AUDIENCE })

/* Function to get M2M token
 * (U-Bahn APIs only)
 * @returns {Promise}
 */
async function getUbahnM2Mtoken () {
  return ubahnM2M.getMachineToken(config.AUTH0_CLIENT_ID, config.AUTH0_CLIENT_SECRET)
}

/* Function to get M2M token
 * (Topcoder APIs only)
 * @returns {Promise}
 */
async function getTopcoderM2Mtoken () {
  return topcoderM2M.getMachineToken(config.AUTH0_CLIENT_ID, config.AUTH0_CLIENT_SECRET)
}

/**
 * Get Kafka options
 * @return {Object} the Kafka options
 */
function getKafkaOptions () {
  const options = { connectionString: config.KAFKA_URL, groupId: config.KAFKA_GROUP_ID }
  if (config.KAFKA_CLIENT_CERT && config.KAFKA_CLIENT_CERT_KEY) {
    options.ssl = { cert: config.KAFKA_CLIENT_CERT, key: config.KAFKA_CLIENT_CERT_KEY }
  }
  return options
}

/**
 * Function to download file from given S3 URL
 * @param {String} objectKey S3 object key of the file to be downloaded
 * @returns {Buffer} Buffer of downloaded file
 */
async function downloadFile (objectKey) {
  const downloadedFile = await s3.getObject({
    Bucket: config.S3_UPLOAD_RECORD_BUCKET,
    Key: objectKey
  }).promise()

  return downloadedFile.Body
}

/**
 * Function to upload error records file to S3
 * @param {Array} records error records
 * @param {String} objectKey source file s3 object key
 * @returns {Promise}
 */
async function uploadFailedRecord (records, objectKey) {
  const extIndex = objectKey.lastIndexOf('.')
  const errFileName = `${objectKey.substring(0, extIndex)}_errors_${Date.now()}${objectKey.substring(extIndex)}`
  // new workbook
  const wb = XLSX.utils.book_new()
  const wsData = []
  const header = Object.keys(records[0])
  wsData.push(header)
  wsData.push(...(records.map(record => _.at(record, header))))
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')

  logger.info(`upload failed records to s3 by key: ${errFileName}`)
  await s3.upload({
    Bucket: config.S3_FAILED_RECORD_BUCKET,
    Key: errFileName,
    Body: XLSX.write(wb, { type: 'buffer' }),
    ContentType: 'application/vnd.ms-excel',
    Metadata: {
      originalname: objectKey
    }
  }).promise()
}

/**
 * Function to get data from ubahn api
 * Call function ONLY IF you are sure that record indeed exists
 * If more than one record exists, then it will attempt to return the one that matches param
 * Else will throw error
 * @param {String} path api path
 * @param {Object} params query params
 * @param {Boolean} isOptionRecord whether the data can be empty
 * @returns {Promise} the record or null
 */
async function getUbahnSingleRecord (path, params, isOptionRecord) {
  const token = await getUbahnM2Mtoken()

  logger.debug(`request GET ${path} by params: ${JSON.stringify(params)}`)
  try {
    const res = await axios.get(`${config.UBAHN_API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      params,
      validateStatus: (status) => {
        if (isOptionRecord && status === 404) {
          // If record is not found, it is not an error in scenario where we are checking
          // if record exists or not
          return true
        }

        return status >= 200 && status < 300
      }
    })
    if (_.isArray(res.data)) {
      if (res.data.length === 1) {
        return res.data[0]
      }
      if (res.data.length === 0 && isOptionRecord) {
        return null
      }
      if (res.data.length > 1) {
        const record = _.find(res.data, params)

        if (!record) {
          throw Error('Multiple records returned. None exactly match query')
        }

        return record
      }
    } else {
      return res.data
    }
  } catch (err) {
    logger.error(`get ${path} by params: ${JSON.stringify(params)} failed`)
    logger.error(err)
    throw Error(`get ${path} by params: ${JSON.stringify(params)} failed`)
  }
}

/**
 * Function to post data to ubahn api to create ubahn record
 * @param {String} path api path
 * @param {Object} data request body
 * @returns {Promise} the created record
 */
async function createUbahnRecord (path, data) {
  let token
  try {
    token = await getUbahnM2Mtoken()
  } catch (error) {
    logger.error('An error occurred fetching the m2m token for UBahn APIs')
    logger.error(error)
    throw error
  }

  logger.debug(`request POST ${path} with data: ${JSON.stringify(data)}`)
  try {
    const res = await axios.post(`${config.UBAHN_API_URL}${path}`, data, { headers: { Authorization: `Bearer ${token}` } })
    return res.data
  } catch (err) {
    logger.error(err)
    throw Error(`post ${path} with data: ${JSON.stringify(data)} failed`)
  }
}

/**
 * Function to patch data to ubahn api to update ubahn record
 * @param {String} path api path
 * @param {Object} data request body
 * @returns {Promise} the updated record
 */
async function updateUBahnRecord (path, data) {
  const token = await getUbahnM2Mtoken()

  logger.debug(`request PATCH ${path} with data: ${JSON.stringify(data)}`)
  try {
    const res = await axios.patch(`${config.UBAHN_API_URL}${path}`, data, { headers: { Authorization: `Bearer ${token}` } })
    return res.data
  } catch (err) {
    logger.error(err)
    throw Error(`patch ${path} with data: ${JSON.stringify(data)} failed`)
  }
}

/**
 * Returns the user in Topcoder identified by the handle
 * @param {String} handle The user handle
 */
async function getUserInTopcoder (handle) {
  const url = config.TOPCODER_USERS_API
  const params = { filter: `handle=${handle}` }
  let token

  try {
    token = await getTopcoderM2Mtoken()
  } catch (error) {
    logger.error('An error occurred fetching the m2m token for Topcoder APIs')
    logger.error(error)
    throw error
  }

  logger.debug(`request GET ${url} with params: ${JSON.stringify(params)}`)

  try {
    const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` }, params })
    return res.data
  } catch (err) {
    logger.error(err)
    throw Error(`get ${url} with params: ${JSON.stringify(params)} failed`)
  }
}

/**
 * Creates user in Topcoder (sso user)
 * @param {Object} user The user to create
 */
async function createUserInTopcoder (user) {
  const url = config.TOPCODER_USERS_API
  const requestBody = { param: user }
  let token
  try {
    token = await getTopcoderM2Mtoken()
  } catch (error) {
    logger.error('An error occurred fetching the m2m token for Topcoder APIs')
    logger.error(error)
    throw error
  }

  logger.debug(`request POST ${url} with data: ${JSON.stringify(user)}`)
  try {
    const res = await axios.post(url, requestBody, { headers: { Authorization: `Bearer ${token}` } })
    return res.data
  } catch (err) {
    logger.error(err)
    throw Error(`post ${url} with data: ${JSON.stringify(user)} failed`)
  }
}

/**
 * Function to notify the process status to ubahn ui api
 * @param {String} id the message payload id
 * @param {Object} data process status
 * @returns {Promise} patch result data
 */
async function updateProcessStatus (id, data) {
  const token = await getUbahnM2Mtoken()
  const res = await axios.patch(`${config.UBAHN_SEARCH_UI_API_URL}/uploads/${id}`, data, { headers: { Authorization: `Bearer ${token}` } })
  return res.data
}

/**
 * Function to parse the excel file to object array
 * @param {Object} file excel file
 * @returns {Promise} an array of object
 */
function parseExcel (file) {
  logger.info('start parsing the excel file')
  const wb = XLSX.read(file)
  const ws = wb.Sheets[wb.SheetNames[0]]
  // get the data range
  const range = XLSX.utils.decode_range(ws['!ref'])
  const { s: { r: rowStart, c: colStart }, e: { r: rowEnd, c: colEnd } } = range

  const resultData = []
  const header = []
  for (let i = colStart; i <= colEnd; i++) {
    // Verify that the header cell has value, if it is empty, skil that entire column
    if (ws[`${XLSX.utils.encode_col(i)}${XLSX.utils.encode_row(rowStart)}`]) {
      header[i - colStart] = ws[`${XLSX.utils.encode_col(i)}${XLSX.utils.encode_row(rowStart)}`].v
    }
  }

  if (!header.includes('handle')) {
    logger.error('"handle" column is missing. Cannot process the rows. Aborting.')
    throw Error('"handle" column is missing. Cannot process the rows. Aborting.')
  }
  for (let i = rowStart + 1; i <= rowEnd; i++) {
    const rowData = {}
    for (let j = colStart; j <= colEnd; j++) {
      const cell = ws[`${XLSX.utils.encode_col(j)}${XLSX.utils.encode_row(i)}`]
      if (cell && cell.v) {
        rowData[header[j - colStart]] = cell.v
      }
    }
    if (Object.keys(rowData).length > 0) {
      resultData.push(rowData)
    }
  }
  logger.info(`parsing excel file finish, the record count is ${resultData.length}`)
  return resultData
}

module.exports = {
  getKafkaOptions,
  downloadFile,
  parseExcel,
  getUbahnSingleRecord,
  createUbahnRecord,
  updateUBahnRecord,
  getUserInTopcoder,
  createUserInTopcoder,
  updateProcessStatus,
  uploadFailedRecord
}
