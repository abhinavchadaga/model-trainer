import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const app = express();
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
const checkAvailability = (req: Request, res: Response, next: NextFunction) => {
    // check if the upload directory exists
    // create if it doesn't and call next middleware function
    if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR);
        next();
    }

    // check if the upload directory is empty
    const files = fs.readdirSync(UPLOAD_DIR);
    if (files.length > 0) {
        res.status(400).send('Dataset already uploaded');
    } else {
        next();
    }
};

/**
 * The storage object for multer
 * Rename the file to include the current timestamp
 */
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

/**
 * The upload object for multer
 * Only allow zips and csv files
 */
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

/**
 * POST route to allow a user to upload a dataset
 */
app.post(
    '/upload-dataset',
    checkAvailability,
    upload.single('dataset'),
    (req: Request, res: Response) => {
        if (req.file) {
            res.status(200).send('File Successfully Uploaded');
        } else {
            res.status(400).send('File Upload Failed');
        }
    }
);

/**
 * DELETE route to delete the uploaded dataset
 * Called when the user closes the app
 */
app.delete('/close-app', (req: Request, res: Response) => {
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
