const { readdir, lstat } = require('fs/promises');
const { createReadStream } = require('fs');
const { exec } = require('child_process');
const { join } = require('path');

const aws_sdk = require('aws-sdk');
const rimraf_lib = require('rimraf');
const zip_folder_lib = require('zip-folder');

const { PromiseResult } = require('aws-sdk/lib/request');

const config = require('./config.js');

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
function zipFolder(folder, file) {
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
 * @returns {void}
 */
function awsConfigure() {
    aws_sdk.config.update({
        region: config.s3.region,
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
    });
}

/**
 * 
 * @param {string[]} path 
 * @param {string | undefined} folder
 * @returns {Promise<aws_sdk.S3.ManagedUpload.SendData>}
 */
function uploadFile(path, folder) {
    return new Promise((resolve, reject) => {
        const filePath = join(...path);
        const fileStream = createReadStream(filePath);
        const key = folder ? join('Backup', 'mongodb', folder, filePath) : join('Backup', 'mongodb', filePath)
        const uploadParams = {
            Bucket: config.s3.bucket,
            Key: key,
            Body: fileStream,
        };

        const s3 = new aws_sdk.S3({ apiVersion: config.s3.apiVersion });

        console.log('start upload', key);
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
function mongoDump() {
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
 * @param {string} prefix 
 * @returns {Promise<AWS.S3.ObjectList | undefined>}
 */
async function listFilesS3(
    prefix
) {
    const s3 = new aws_sdk.S3({ apiVersion: config.s3.apiVersion });
    return (
        await s3
            .listObjects({
                Bucket: config.s3.bucket,
                Prefix: prefix,
            })
            .promise()
    ).Contents;
}

/**
 * 
 * @param {string} key 
 * @returns {Promise<PromiseResult<aws_sdk.S3.DeleteObjectOutput, aws_sdk.AWSError>>}
 */
function deleteFileS3(
    key
) {
    const s3 = new aws_sdk.S3({ apiVersion: config.s3.apiVersion });
    const result = await s3
        .deleteObject({ Bucket: config.s3.bucket, Key: key })
        .promise();
    console.log('delete', key);
    return result;
}

/**
 * 
 * @param {string[]} path 
 * @param {string | undefined} folder
 * @returns {Promise<void>}
 */
async function uploadTree(path, folder) {
    const items = await readdir(join(...path));
    for (const item of items) {
        const itemPath = [...path, item];
        const stats = await lstat(join(...itemPath));
        if (stats.isDirectory()) {
            await uploadTree(itemPath, folder);
        } else {
            await uploadFile(itemPath, folder);
        }
    }
}

/**
 * @returns {Promise<void>}
 */
async function clearOldS3() {
    const prefix = 'Backup/mongodb/'
    const items = await listFilesS3(prefix);

    let foldersDate = [];

    for (const item of items) {
        const path = item.Key.replace(prefix, '').split('/');
        if (path.length > 2) {
            const folder = path[0];
            if (foldersDate.indexOf(folder) === -1) {
                foldersDate.push(folder);
            }
        }
    }

    foldersDate = foldersDate.sort((a, b) => {
        const aDate = new Date();
        const aSplit = a.split('-');
        aDate.setFullYear(aSplit[0]);
        aDate.setMonth(Number(aSplit[1]) - 1);
        aDate.setDate(aSplit[2]);
        aDate.setHours(aSplit[3]);
        aDate.setMinutes(aSplit[4]);

        const bDate = new Date();
        const bSplit = b.split('-');
        bDate.setFullYear(bSplit[0]);
        bDate.setMonth(Number(bSplit[1]) - 1);
        bDate.setDate(bSplit[2]);
        bDate.setHours(bSplit[3]);
        bDate.setMinutes(bSplit[4]);

        if (aDate < bDate) {
            return 1;
        }
        return -1;
    });

    const [save1, save2, ...trash] = foldersDate;

    for (const item of items) {
        let deleteItem = false;
        for (const garbage of trash) {
            if (item.Key.startsWith(join(prefix, garbage))) {
                deleteItem = true;
                break;
            }
        }
        if(deleteItem) {
            await deleteFileS3(item.Key);
        }
    }
}

module.exports = {
    execute,
    zipFolder,
    rimraf,
    awsConfigure,
    uploadFile,
    mongoDump,
    listFilesS3,
    deleteFileS3,
    uploadTree,
    clearOldS3
};