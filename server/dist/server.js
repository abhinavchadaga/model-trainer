"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const app = (0, express_1.default)();
const port = 3000;
const UPLOAD_DIR = 'data/';
/**
 * The server can only handle 1 user at a time.
 * This middleware function checks if the server is available to accept a new dataset
 *
 * @param req Request object
 * @param res Response object
 * @param next NextFunction object
 */
const checkAvailability = (req, res, next) => {
    // check if the upload directory exists
    // create if it doesn't and call next middleware function
    if (!fs_1.default.existsSync(UPLOAD_DIR)) {
        fs_1.default.mkdirSync(UPLOAD_DIR);
        next();
    }
    // check if the upload directory is empty
    const files = fs_1.default.readdirSync(UPLOAD_DIR);
    if (files.length > 0) {
        res.status(400).send('Dataset already uploaded');
    }
    else {
        next();
    }
};
/**
 * The storage object for multer
 * Rename the file to include the current timestamp
 */
const storage = multer_1.default.diskStorage({
    destination: UPLOAD_DIR,
    filename: function (req, file, cb) {
        // create a save name using the current timestamp
        const ext = path_1.default.extname(file.originalname);
        const originalNameNoExt = path_1.default.basename(file.originalname, ext);
        const saveName = `${originalNameNoExt}_${Date.now()}${ext}`;
        cb(null, saveName);
    },
});
/**
 * The upload object for multer
 * Only allow zips and csv files
 */
const upload = (0, multer_1.default)({
    storage: storage,
    fileFilter: function (req, file, cb) {
        // allow only zips and csv files
        const allowedExtensions = new Set(['.zip', '.csv']);
        const ext = path_1.default.extname(file.originalname);
        if (allowedExtensions.has(ext)) {
            cb(null, true);
        }
        else {
            cb(null, false);
        }
    },
});
/**
 * POST route to allow a user to upload a dataset
 */
app.post('/upload-dataset', checkAvailability, upload.single('dataset'), (req, res) => {
    if (req.file) {
        res.status(200).send('File Successfully Uploaded');
    }
    else {
        res.status(400).send('File Upload Failed');
    }
});
/**
 * DELETE route to delete the uploaded dataset
 */
app.delete('/close-app', (req, res) => {
    // check if the upload directory exists
    if (!fs_1.default.existsSync(UPLOAD_DIR)) {
        res.status(200).send('No dataset to delete');
        return;
    }
    // check if the upload directory is empty
    const files = fs_1.default.readdirSync(UPLOAD_DIR);
    if (files.length === 0) {
        res.status(200).send('No dataset to delete');
        return;
    }
    // delete the file
    const filePath = path_1.default.join(UPLOAD_DIR, files[0]);
    fs_1.default.unlinkSync(filePath);
    res.status(200).send('Dataset deleted');
});
app.listen(port, () => console.log(`Listening on port ${port}...`));
