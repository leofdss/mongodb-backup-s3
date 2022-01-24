require('dotenv').config();

const user = process?.env?.MONGO_INITDB_ROOT_USERNAME;
const pass = process?.env?.MONGO_INITDB_ROOT_PASSWORD;

const region = process.env.REGION;
const accessKeyId = process.env.ACCESS_KEY_ID;
const secretAccessKey = process.env.SECRET_ACCESS_KEY;
const apiVersion = process.env.API_VERSION;
const bucket = process.env.BUCKET;

module.exports = {
  directory: 'dump',
  database: {
    user,
    pass
  },
  s3: {
    region,
    accessKeyId,
    secretAccessKey,
    apiVersion,
    bucket: bucket
  },
};
