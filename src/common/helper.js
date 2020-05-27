/**
 * Contains generic helper methods
 */
const _ = require('lodash')
const AWS = require('aws-sdk')
const AmazonS3URI = require('amazon-s3-uri')
const XLSX = require('xlsx')
const axios = require('axios')
const config = require('config')
const m2mAuth = require('tc-core-library-js').auth.m2m
const logger = require('./logger')

AWS.config.region = config.get('AWS_REGION')
const s3 = new AWS.S3()

const m2m = m2mAuth(_.pick(config, ['AUTH0_URL', 'AUTH0_AUDIENCE', 'TOKEN_CACHE_TIME', 'AUTH0_PROXY_SERVER_URL']))

/* Function to get M2M token
 * @returns {Promise}
 */
async function getM2Mtoken () {
  return m2m.getMachineToken(config.AUTH0_CLIENT_ID, config.AUTH0_CLIENT_SECRET)
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
 * @param{String} fileURL S3 URL of the file to be downloaded
 * @returns {Buffer} Buffer of downloaded file
 */
async function downloadFile (fileURL) {
  const { bucket, key } = AmazonS3URI(fileURL)
  logger.info(`downloadFile(): file is on S3 ${bucket} / ${key}`)
  const downloadedFile = await s3.getObject({ Bucket: bucket, Key: key }).promise()
  return downloadedFile.Body
}

/**
 * Function to upload error records file to S3
 * @param {Array} records error records
 * @param {String} sourceFileURL source file url for source s3 key
 * @returns {Promise}
 */
async function uploadFailedRecord (records, sourceFileURL) {
  const sourceName = AmazonS3URI(sourceFileURL).key
  const extIndex = sourceName.lastIndexOf('.')
  const errFileName = `${sourceName.substring(0, extIndex)}_errors_${Date.now()}${sourceName.substring(extIndex)}`
  // new workbook
  const wb = XLSX.utils.book_new()
  const wsData = []
  const header = Object.keys(records[0])
  wsData.push(header)
  wsData.push(...(records.map(record => _.at(record, header))))
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')

  logger.info(`upload failed records to s3 by key: ${errFileName}`)
  await s3.upload({ Bucket: config.S3_FAILED_RECORD_BUCKET, Key: errFileName, Body: XLSX.write(wb, { type: 'buffer' }) }).promise()
}

/**
 * Function to data from ubahn api and check there is only one record
 * @param {String} path api path
 * @param {Object} params query params
 * @param {Boolean} isOptionRecord whether the data can be empty
 * @returns {Promise} the record or null
 */
async function getUbahnSingleRecord (path, params, isOptionRecord) {
  const token = await getM2Mtoken()

  logger.debug(`request ${config.UBAHN_API_URL}${path} by params: ${JSON.stringify(params)}`)
  try {
    const res = await axios.get(`${config.UBAHN_API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` }, params })
    if (res.data.length === 1) {
      return res.data[0]
    }
    if (res.data.length === 0 && isOptionRecord) {
      return null
    }
  } catch (err) {
    logger.error(err)
    throw Error(`get ${path} by params: ${JSON.stringify(params)} failed`)
  }
  logger.error(`get ${path} by params: ${JSON.stringify(params)} failed`)
  throw Error(`get ${path} by params: ${JSON.stringify(params)} failed`)
}

/**
 * Function to post data to ubahn api to create ubahn record
 * @param {String} path api path
 * @param {Object} data request body
 * @returns {Promise} the created record
 */
async function createUbahnRecord (path, data) {
  const token = await getM2Mtoken()

  logger.debug(`request ${config.UBAHN_API_URL}${path} by data: ${JSON.stringify(data)}`)
  try {
    const res = await axios.post(`${config.UBAHN_API_URL}${path}`, data, { headers: { Authorization: `Bearer ${token}` } })
    return res.data
  } catch (err) {
    logger.error(err)
    throw Error(`post ${path} by data: ${JSON.stringify(data)} failed`)
  }
}

/**
 * Creates user in Topcoder (sso user)
 * @param {Object} user The user to create
 */
async function createUserInTopcoder (user) {
  const url = config.TOPCODER_USERS_API
  const requestBody = { param: user }
  const token = await getM2Mtoken()

  logger.debug(`request ${url} by data: ${JSON.stringify(user)}`)
  try {
    const res = await axios.post(`${url}`, requestBody, { headers: { Authorization: `Bearer ${token}` } })
    return res.data
  } catch (err) {
    logger.error(err)
    throw Error(`post ${url} by data: ${JSON.stringify(user)} failed`)
  }
}

/**
 * Function to notify the process status to ubahn ui api
 * @param {String} id the message payload id
 * @param {Object} data process status
 * @returns {Promise} patch result data
 */
async function updateProcessStatus (id, data) {
  const token = await getM2Mtoken()
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
    header[i - colStart] = ws[`${XLSX.utils.encode_col(i)}${XLSX.utils.encode_row(rowStart)}`].v
  }
  const requireHeader = ['handle', 'skillName', 'skillProviderName', 'metricValue', 'skillCertifierId', 'skillCertifiedDate', 'achievementsProviderName',
    'achievementsName', 'achievementsUri', 'achievementsCertifierId', 'achievementsCertifiedDate']
  // check excel content
  if (!requireHeader.every(v => header.includes(v))) {
    logger.error(`require ${JSON.stringify(requireHeader)} columns, but actual columns is ${JSON.stringify(header)}`)
    throw Error(`require ${JSON.stringify(requireHeader)} columns, but actual columns is ${JSON.stringify(header)}`)
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
  createUserInTopcoder,
  updateProcessStatus,
  uploadFailedRecord
}
