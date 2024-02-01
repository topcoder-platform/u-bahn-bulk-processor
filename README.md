DEPRECATED 2/1/2024 https://topcoder.atlassian.net/browse/CORE-203

# UBahn - Bulk Record Processor

## Dependencies

- Nodejs(v12+)
- S3
- Kafka

## Configuration

Configuration for the bulk record processor is at `config/default.js`.
The following parameters can be set in config files or in env variables:

- LOG_LEVEL: the log level; default value: 'debug'
- KAFKA_URL: comma separated Kafka hosts; default value: 'localhost:9092'
- KAFKA_CLIENT_CERT: Kafka connection certificate, optional; default value is undefined;
    if not provided, then SSL connection is not used, direct insecure connection is used;
    if provided, it can be either path to certificate file or certificate content
- KAFKA_CLIENT_CERT_KEY: Kafka connection private key, optional; default value is undefined;
    if not provided, then SSL connection is not used, direct insecure connection is used;
    if provided, it can be either path to private key file or private key content
- KAFKA_GROUP_ID: the Kafka group id, default value is 'bulk-record-processor'
- ACTION_CREATE_TOPIC: the create action Kafka message topic, default value is 'ubahn.action.create'
- AWS_REGION: The Amazon region to use when using AWS S3
- S3_UPLOAD_RECORD_BUCKET: The S3 bucket from which the processor will download the uploaded file
- S3_FAILED_RECORD_BUCKET: S3 bucket for storing uploaded files that failed processing
- UBAHN_API_URL: The ubahn api url, default value: 'localhost:3001'
- UBAHN_SEARCH_UI_API_URL: The ubahn ui api url, default value: 'localhost:3001'
- TOPCODER_USERS_API: The topcoder users api, default value: 'http://api.topcoder-dev.com/v3/users'
- CREATE_MISSING_USER_FLAG: Boolean flag, that when set, will create user if it is not found in Ubahn api. The user is created in both Ubahn and Topcoder's api(s)
- PROCESS_CONCURRENCY_COUNT: The record process concurrency count, default value: 100
- AUTH0_URL: The auth0 url, default value: 'https://topcoder-dev.auth0.com/oauth/token'
- AUTH0_UBAHN_AUDIENCE: The auth0 audience for accessing ubahn api(s), default value: 'https://u-bahn.topcoder-dev.com/'
- AUTH0_TOPCODER_AUDIENCE: The auth0 audience for accessing ubahn api(s), default value: 'https://m2m.topcoder-dev.com/'
- AUTH0_CLIENT_ID: The auth0 client id
- AUTH0_CLIENT_SECRET: The auth0 client secret
- AUTH0_PROXY_SERVER_URL: The auth0 proxy server url
- TOKEN_CACHE_TIME: The token cache time

Note that you can set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY env for access s3, if not provided, then they are loaded from shared credentials, see official documentation

There is a `/health` endpoint that checks for the health of the app. This sets up an expressjs server and listens on the environment variable `PORT`. It's not part of the configuration file and needs to be passed as an environment variable

## Local Kafka setup

### Install bin

- `http://kafka.apache.org/quickstart` contains details to setup and manage Kafka server,
  below provides details to setup Kafka server in Linux/Mac, Windows will use bat commands in bin/windows instead

### Local install with Docker

- Navigate to the directory `docker-kafka`
- Run the command `docker-compose up -d`

## Local deployment

1. Make sure that Kafka is running.

2. From the project root directory, run the following command to install the dependencies

    ```bash
    npm install
    ```

3. To run linters if required

    ```bash
    npm run lint
    ```

    To fix possible lint errors:

    ```bash
    npm run lint:fix
    ```

4. Start mock server

    ```bash
    npm run mockServer
    ```

5. Start the processor and health check dropin

    ```bash
    npm start
    ```

## Local Deployment with Docker

To run the Bulk Record Processor using docker, follow the below steps

1. Navigate to the directory `docker`

2. Rename the file `sample.api.env` to `api.env`

3. Set the required AWS credentials, s3 bucket and auth0 config in the file `api.env`

4. Once that is done, run the following command

    ```bash
    docker-compose up
    ```

5. When you are running the application for the first time, It will take some time initially to download the image and install the dependencies

## Verification

1. config `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `S3_FAILED_RECORD_BUCKET`
2. upload the file in test-data folder to s3
3. start kafka server, start mock server, start processor app
4. start kafka-console-producer to write messages to `u-bahn.action.create`
  `docker exec -it bulk-record-processor_kafka /opt/kafka/bin/kafka-console-producer.sh --broker-list localhost:9092 --topic u-bahn.action.create`
5. write message(replace the url value to url of project_ubahn_bulk.xlsx file in your s3):
  `{ "topic": "u-bahn.action.create", "originator": "u-bahn-api", "timestamp": "2020-05-08T00:00:00.000Z", "mime-type": "application/json", "payload": {"id":"780083e8-9fdd-4281-af87-7c23fe8a1372","url":"https://ubahn.s3.amazonaws.com/project_ubahn_bulk.xlsx","status":"pending"} }`
6. Watch the app console, It will show message successfully handled.
7. Watch the mock server console, It will show the api server and ui api server receive query, create, update status message.
8. Access S3 console, It will show the failed records file upload to the `S3_FAILED_RECORD_BUCKET`.
9. write error file message(replace the url value to url of project_ubahn_bulk_error.xlsx file in your s3):
  `{ "topic": "u-bahn.action.create", "originator": "ubahn-api", "timestamp": "2020-05-08T00:00:00.000Z", "mime-type": "application/json", "payload": {"id":"ab3bf3af-9659-42ca-bf65-0c4a3e475650","url":"https://ubahn.s3.amazonaws.com/project_ubahn_bulk_error.xlsx","status":"pending"} }`
10. Watch the app console, It will show message successfully handled.
11. Watch the mock server console, It will show the ui api server receive update status failed message.
