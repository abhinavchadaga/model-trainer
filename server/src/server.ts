import express, { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';
import StreamZip from 'node-stream-zip';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import train from './train';

const app = express();
const port = 3000;
const BASE_DIR = path.join(__dirname, '../', 'data');
const DATASET_DIR = path.join(BASE_DIR, 'dataset');

export const dataLoadingProgress = new EventEmitter();

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
    if (!fs.existsSync(DATASET_DIR)) {
        fs.mkdirSync(DATASET_DIR);
        next();
    }

    // check if the upload directory is empty
    const files = fs.readdirSync(DATASET_DIR);
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
    destination: DATASET_DIR,
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
        const allowedExtensions = new Set(['.csv', '.zip']);
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
    '/dataset/upload',
    checkAvailability,
    upload.single('dataset'),
    (req, res) => {
        if (!req.file) {
            // no file was uploaded
            return res.status(400).send('File Upload Failed');
        }

        if (req.file.mimetype === 'application/zip') {
            // if the file is a zip file, extract it
            const filename = req.file.filename;
            const zip = new StreamZip({
                file: path.join(DATASET_DIR, filename),
            });

            // zip has been loaded into memory, trigger 'ready' event
            zip.on('ready', () => {
                // extract the zip file
                zip.extract(null, DATASET_DIR, (err) => {
                    zip.close();
                    if (err) {
                        return res.status(400).send('File Upload Failed');
                    } else {
                        // delete the old zip file, not needed anymore
                        fs.unlinkSync(path.join(DATASET_DIR, filename));
                        return res
                            .status(200)
                            .send(`File ${req.file?.filename} uploaded`);
                    }
                });
            });

            // zip file is corrupted
            zip.on('error', () => {
                return res.status(400).send('File Upload Failed');
            });
        } else {
            // file is a csv file
            res.status(200).send(`File ${req.file.filename} uploaded`);
        }
    }
);

/**
 * DELETE route to delete the uploaded dataset
 * Called when the user closes the app
 */
app.delete('/dataset/delete', (req, res) => {
    // check if the upload directory exists
    if (!fs.existsSync(DATASET_DIR)) {
        res.status(200).send('No dataset to delete');
        return;
    }

    // check if the upload directory is empty
    const files = fs.readdirSync(DATASET_DIR);
    if (files.length === 0) {
        res.status(200).send('No dataset to delete');
        return;
    }

    // delete the file
    const filePath = path.join(DATASET_DIR, files[0]);
    fs.unlinkSync(filePath);
    res.status(200).send(`${files[0]} deleted`);
});

/**
 * POST route to allow a user to select an architecture
 */
app.post('/select-arch', (req: Request, res: Response) => {
    const validArchitectures = new Set(['mlp', 'vgg', 'resnet']);
    // invalid requests
    if (!req.query.arch) {
        res.status(400).send('Invalid request');
        return;
    } else if (!validArchitectures.has(req.query.arch as string)) {
        res.status(400).send('Unsupported architecture');
        return;
    }

    // valid request
    const file = fs.createWriteStream(path.join(BASE_DIR, 'arch'));
    file.write(req.query.arch as string);
    res.status(200).send(`${req.query.arch} selected`);
});

app.post('/train/start', (req, res) => {
    // start the training process in background
    const path_to_dataset = path.join(
        DATASET_DIR,
        fs.readdirSync(DATASET_DIR)[0]
    );

    train('resnet', path_to_dataset);

    // notify client that training has started
    res.status(203).send('Training started');
});

app.get('/train/status', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Transfer-Encoding', 'chunked');

    dataLoadingProgress.on('progress', (progress) => {
        res.write(`data: ${progress}\n\n`);
    });

    dataLoadingProgress.on('done', () => {
        res.write(`data: done\n\n`);
        res.end();
    });

    dataLoadingProgress.on('error', (err) => {
        res.write(`data: error\n\n`);
        res.end();
    });

    res.on('close', () => {
        dataLoadingProgress.removeAllListeners();
    });
});

app.listen(port, () => console.log(`Listening on port ${port}...`));
