require('dotenv').config();
const fs = require('fs')
const S3 = require("aws-sdk/clients/s3");

const accessKeyID = process.env.AWS_ACCESS_KEY_ID;
const bucketName = process.env.AWS_BUCKET_NAME;
const bucketRegion = process.env.AWS_BUCKET_REGION;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

const s3 = new S3({bucketRegion, accessKeyID, secretAccessKey});

function uploadFile(file){
    const fileStream = fs.createReadStream(file.path)
    const uploadParams = {
        Bucket: bucketName,
        Body: fileStream,
        Key: file.filename
    } 

    return s3.upload(uploadParams).promise();
}

exports.uploadFile = uploadFile;


function getFileStream(fileKey){
    const downloadParams = {
        Key: fileKey,
        Bucket: bucketName
    }

    return s3.getObject(downloadParams).createReadStream()
}

exports.getFileStream = getFileStream;