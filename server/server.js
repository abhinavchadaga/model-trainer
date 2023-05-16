const multer = require('multer');
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;
const UPLOAD_DIR = 'data/';

// server can only handle 1 user at a time
// check if the upload directory contains at most 1 file
const checkAvailability = (req, res, next) => {
    // check if the upload directory exists
    if (!fs.existsSync(UPLOAD_DIR)) next();

    // check if the upload directory is empty
    const files = fs.readdirSync(UPLOAD_DIR);
    if (files.length > 0) {
        res.status(400).send('Dataset already uploaded');
    } else {
        next();
    }
};

// create a multer storage object
// sets the destination folder and filename
// for the uploaded file
const storage = multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: function (req, file, cb) {
        // create a save name using the current timestamp
        const ext = path.extname(file.originalname);
        const originalNameNoExt = path.basename(file.originalname, ext);
        const saveName = `${originalNameNoExt}_${Date.now()}${ext}`;
        cb(null, saveName);
    },
});

// create a multer upload object
// sets the storage object and file filter methodology
const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        // allow only zips and csv files
        const allowedExtensions = new Set(['.zip', '.csv']);
        const ext = path.extname(file.originalname);
        if (allowedExtensions.has(ext)) {
            cb(null, true);
        } else {
            cb(null, false);
        }
    },
});

// POST route for handling file uploads
app.post(
    '/upload-dataset',
    checkAvailability,
    upload.single('dataset'),
    (req, res) => {
        if (req.file) {
            res.status(200).send('File Successfully Uploaded');
        } else {
            res.status(400).send('Invalid File Type');
        }
    }
);

// DELETE route for deleting the dataset once the user closes the browser
app.delete('/close-app', (req, res) => {
    // check if the upload directory exists
    if (!fs.existsSync(UPLOAD_DIR)) {
        res.status(200).send('No dataset to delete');
        return;
    }

    // check if the upload directory is empty
    const files = fs.readdirSync(UPLOAD_DIR);
    if (files.length === 0) {
        res.status(200).send('No dataset to delete');
        return;
    }

    // delete the file
    const filePath = path.join(UPLOAD_DIR, files[0]);
    fs.unlinkSync(filePath);
    res.status(200).send('Dataset deleted');
});

app.listen(port, () => console.log(`Listening on port ${port}...`));
