import express, { Request, Response, NextFunction } from 'express';
import StreamZip from 'node-stream-zip';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { spawn, ChildProcess } from 'node:child_process';

const app = express();
const port = 3000;
const BASE_DIR = path.join(__dirname, '../', 'data');
const DATASET_DIR = path.join(BASE_DIR, 'dataset');

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

interface Progress {
    progress: number;
}

let pythonProcess: ChildProcess | null = null;
let progress: Progress | null = null;

/**
 * POST route to start the training process
 *
 */
app.post('/train/start', (req, res) => {
    if (pythonProcess && !pythonProcess.killed) {
        res.status(400).send('Training already in progress');
        return;
    }

    // get path to dataset
    const path_to_dataset = path.join(
        DATASET_DIR,
        fs.readdirSync(DATASET_DIR)[0]
    );

    // create a new process and run python training script
    const pythonEnv = '/Users/abhinavchadaga/miniforge3/envs/py39/bin/python3';
    pythonProcess = spawn(pythonEnv, ['src/test.py'], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    // write input data to python stdin
    pythonProcess.stdin!.write(JSON.stringify({ progress: 0 }));
    pythonProcess.stdin!.end();

    // listen for data from python stdout
    pythonProcess.stdout!.on('data', (data) => {
        progress = JSON.parse(data.toString());
        console.log('Received from python: ', progress);
    });

    // notify client that training has started
    res.status(203).send('Training started');
});

/**
 * GET route to stream training progress
 */
app.get('/train/status', (req, res) => {
    if (!pythonProcess || pythonProcess.killed) {
        res.status(400).json({ message: 'Python process is not running' });
        return;
    }

    // send SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Transfer-Encoding', 'chunked');

    // setup initial connection
    res.write(`data: ${JSON.stringify(progress)}\n\n`);

    // stream progress, update every second
    const interval = setInterval(() => {
        res.write(`data: ${JSON.stringify(progress)}\n\n`);
    }, 2000);

    // close SSE connection once training script exits
    pythonProcess.on('close', (exitCode) => {
        clearInterval(interval);
        console.log(`process exited with exit code ${exitCode}`);
        res.write(`data: training complete\n\n`);
        res.end();
    });
});

/**
 * GET route to download the trained model
 */
app.get('/train/download', (req, res) => {
    // TODO: send the actual downloaded model
    res.status(200).json({ message: 'Downloaded model' });
});

// start the server
app.listen(port, () => console.log(`Listening on port ${port}...`));
