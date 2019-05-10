const aws = require('aws-sdk');
const fs = require('fs');
const s3 = new aws.S3();
const bucket = 'aura-snapshots-prod';

async function uploadFile(filename) {
  const path = `./snapshots/${filename}`;
  return s3.putObject(
    {
      ACL: 'public-read',
      Body: fs.readFileSync(path),
      Bucket: bucket,
      Key: filename.replace('.gz', ''),
      ContentType: 'application/json',
      ContentEncoding: 'gzip',
    }
  );
}
