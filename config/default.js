/**
 * The default configuration file.
 */

module.exports = {
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug',

  KAFKA_URL: process.env.KAFKA_URL || 'localhost:9092',
  // below are used for secure Kafka connection, they are optional
  // for the local Kafka, they are not needed
  KAFKA_CLIENT_CERT: process.env.KAFKA_CLIENT_CERT,
  KAFKA_CLIENT_CERT_KEY: process.env.KAFKA_CLIENT_CERT_KEY,

  // Kafka group id
  KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID || 'bulk-record-processor',
  ACTION_CREATE_TOPIC: process.env.ACTION_CREATE_TOPIC || 'u-bahn.action.create',

  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  S3_FAILED_RECORD_BUCKET: process.env.S3_FAILED_RECORD_BUCKET,

  UBAHN_API_URL: process.env.UBAHN_API_URL || 'http://localhost:3001',
  UBAHN_SEARCH_UI_API_URL: process.env.UBAHN_SEARCH_UI_API_URL || 'http://localhost:3001',

  PROCESS_CONCURRENCY_COUNT: process.env.PROCESS_CONCURRENCY_COUNT || 25,

  AUTH0_URL: process.env.AUTH0_URL || 'https://topcoder-dev.auth0.com/oauth/token', // Auth0 credentials
  AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE || 'https://m2m.topcoder-dev.com/',
  TOKEN_CACHE_TIME: process.env.TOKEN_CACHE_TIME,
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
  AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET,
  AUTH0_PROXY_SERVER_URL: process.env.AUTH0_PROXY_SERVER_URL
}
