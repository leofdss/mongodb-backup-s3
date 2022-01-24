const { exec } = require('child_process');
const rimraf_lib = require('rimraf');
const aws_sdk = require('aws-sdk');
const { join } = require('path');
const { createReadStream } = require('fs');
const config = require('./config.js');
const zip_folder_lib = require('zip-folder');
var cron = require('node-cron');

/**
 * 
 * @param {string} cmd 
 * @returns {Promise<string>}
 */
function execute(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            stdout;
            stderr;
            if (error) {
                reject(error);
            } else {
                resolve('done');
            }
        });
    });
}

/**
 * 
 * @param {string[]} folder
 * @param {string[]} file 
 * @returns {Promise<string>}
 */
function zip_folder(folder, file) {
    return new Promise((resolve, reject) => {
        const folderPath = join(...folder);
        const filePath = join(...file);
        zip_folder_lib(folderPath, filePath, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve('done');
            }
        });
    });
}

/**
 * 
 * @param {string[]} path 
 * @returns {Promise<string>}
 */
function rimraf(path) {
    return new Promise((resolve, reject) => {
        const filePath = join(...path);
        rimraf_lib(filePath, (error) => {
            if (error) {
                reject(error);
            } else {
                resolve('done');
            }
        });
    });
}

/**
 * 
 * @param {string[]} path 
 * @returns {Promise<aws_sdk.S3.ManagedUpload.SendData>}
 */
function uploadFile(path) {
    return new Promise((resolve, reject) => {
        const filePath = join(...path);
        const fileStream = createReadStream(filePath);
        const uploadParams = {
            Bucket: config.s3.bucket,
            Key: join('Backup', 'mongodb', filePath),
            Body: fileStream,
        };

        aws_sdk.config.update({
            region: config.s3.region,
            accessKeyId: config.s3.accessKeyId,
            secretAccessKey: config.s3.secretAccessKey,
        });

        const s3 = new aws_sdk.S3({ apiVersion: config.s3.apiVersion });

        s3.upload(
            uploadParams,
            (err, data) => {
                if (err) {
                    console.log(err);
                    reject(err);
                } else if (data) {
                    resolve(data);
                }
            }
        );
    });
}

/**
 * 
 * @returns {Promise<string>}
 */
function mongo_dump() {
    const cmd = [
        'mongodump',
        '--host mongo',
        '--port 27017',
        `--username ${config.database.user}`,
        `--password ${config.database.pass}`,
        '--authenticationDatabase=admin',
        '--authenticationMechanism=SCRAM-SHA-1',
        '--forceTableScan'
    ].join(' ');
    return execute(cmd);
}

/**
 * 
 * @returns {Promise<string>}
 */
async function main() {
    console.log('-------- start dump --------');
    await mongo_dump();
    console.log('-------- dump done --------');

    console.log('-------- start zip --------');
    const folder = 'dump';
    const date = new Date();
    const fileName = [
        'dump',
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
        date.getHours(),
        date.getMinutes()
    ].join('-') + '.zip';
    await zip_folder([folder], [fileName]);
    console.log('-------- zip done --------');

    console.log('-------- start upload --------');
    await uploadFile([fileName]);
    console.log('-------- upload done --------');

    console.log('-------- start clear --------');
    await rimraf([folder]);
    await rimraf([fileName]);
    console.log('-------- clear done --------');

    return 'done';
}

cron.schedule('0 0 0 * * *', () => {
    main()
        .then(() => console.log('-------- done --------'))
        .catch((err) => console.log(err));
});

