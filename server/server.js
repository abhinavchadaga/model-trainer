const multer = require('multer');
const express = require('express');
const path = require('path');

const app = express();
const port = 3000;

const storage = multer.diskStorage({
    destination: 'user-dataset',
    filename: function (req, file, cb) {
        const fname = `dataset_${Date.now()}${path.extname(file.originalname)}`;
        cb(null, fname);
    },
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        const allowedExtensions = new Set(['.zip', '.csv']);
        const ext = path.extname(file.originalname);
        if (allowedExtensions.has(ext)) {
            cb(null, true);
        } else {
            console.log(ext);
            cb(null, false);
        }
    },
});

app.post('/upload-dataset', upload.single('dataset'), (req, res) => {
    res.send('success!');
});

app.listen(port, () => console.log(`Listening on port ${port}...`));
