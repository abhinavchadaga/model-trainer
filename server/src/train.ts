// import * as tf from '@tensorflow/tfjs-node';
// import { EventEmitter } from 'events';
// import fs from 'fs';
// import path from 'path';
// import sharp from 'sharp';

// // import { dataLoadingProgress } from './server';

// interface ModelInfo {
//     weights: string;
//     img_size: [number, number];
//     mean: [number, number, number];
//     std: [number, number, number];
// }

// const models = new Map<string, ModelInfo>([
//     [
//         'resnet',
//         {
//             weights:
//                 'https://tfhub.dev/google/tfjs-model/imagenet/resnet_v2_50/classification/3/default/1',
//             img_size: [224, 224],
//             mean: [0.485, 0.456, 0.406],
//             std: [0.229, 0.224, 0.225],
//         },
//     ],
// ]);

// /**
//  * Load an image from the file system, force to jpeg,
//  * resize to img_size, and normalize it
//  *
//  * @param filepath path to the image file
//  * @returns a promise that resolves to a tensor of shape [img_size[0], img_size[1], 3]
//  */
// function loadImage(
//     filepath: string,
//     img_size: [number, number] = [224, 224]
// ): Promise<tf.Tensor3D | tf.Tensor4D> {
//     return new Promise((resolve, reject) => {
//         fs.readFile(filepath, (err, buffer) => {
//             if (err) reject(err);
//             // force to jpeg
//             sharp(buffer)
//                 .toFormat('jpeg')
//                 .toBuffer()
//                 .then((jpegBuffer) => {
//                     // convert to tensor
//                     let imageTensor = tf.node.decodeImage(jpegBuffer);

//                     // resize image
//                     imageTensor = tf.image.resizeBilinear(
//                         imageTensor,
//                         img_size
//                     );

//                     resolve(imageTensor);
//                 })
//                 .catch((err) => {
//                     reject(err);
//                 });
//         });
//     });
// }

// async function loadDataset(
//     path_to_dataset: string,
//     arch: string,
//     dataLoadingProgress: EventEmitter
// ) {
//     // subdir names are the classes
//     const classes = fs.readdirSync(path_to_dataset);
//     const images: tf.Tensor[] = [];
//     const labels: tf.Tensor[] = [];

//     // load the normalization parameters for the model
//     const { img_size, mean, std } = models.get(arch)!;

//     for (let i = 0; i < classes.length; i++) {
//         const _class = classes[i];
//         const imageFiles = fs.readdirSync(path.join(path_to_dataset, _class));

//         // load all images in the class
//         const imageTensors = await Promise.all(
//             imageFiles.map((imageFile) =>
//                 loadImage(
//                     path.join(path_to_dataset, _class, imageFile),
//                     img_size
//                 ).then((imageTensor) => {
//                     // normalize the image
//                     return tf.tidy(() => {
//                         return imageTensor
//                             .toFloat()
//                             .div(255.0)
//                             .sub(mean)
//                             .div(std);
//                     });
//                 })
//             )
//         );
//         images.push(...imageTensors);

//         // create a label tensor for the class
//         const labelTensor = tf.oneHot(
//             tf.tensor1d([i], 'int32'),
//             classes.length
//         );
//         labels.push(...Array(imageTensors.length).fill(labelTensor));

//         // update progress
//         dataLoadingProgress.emit('progress', (i + 1) / classes.length);
//     }

//     console.log('Finished loading dataset');

//     return {
//         images: tf.stack(images),
//         labels: tf.stack(labels),
//         classes: classes,
//     };
// }

// export default async function train(arch: string, path_to_dataset: string) {
//     loadDataset(path_to_dataset, arch, dataLoadingProgress).then(
//         async (data) => {
//             // load the base model
//             let baseModel: tf.GraphModel;
//             if (arch === 'resnet') {
//                 baseModel = await tf.loadGraphModel(models.get(arch)!.weights, {
//                     fromTFHub: true,
//                 });
//             } else {
//                 throw new Error('Unknown model architecture');
//             }

//             // warmup the model
//             const { img_size } = models.get(arch)!;
//             let outputDim = 0;
//             tf.tidy(() => {
//                 let answer = baseModel.predict(
//                     tf.zeros([1, ...img_size, 3])
//                 ) as tf.Tensor;
//                 outputDim = answer.shape[1] as number;
//                 console.log('warm-up complete');
//                 console.log(answer.shape);
//             });

//             // extract the features from the base model
//             console.log('extracting features...');
//             // time this operation
//             console.time('feature extraction');
//             const features = baseModel.predict(data.images) as tf.Tensor;
//             console.timeEnd('feature extraction');
//             console.log('features shape', features.shape);

//             // create the classifier head
//             const classifier = tf.sequential();
//             classifier.add(
//                 tf.layers.dense({
//                     inputShape: [outputDim],
//                     units: 128,
//                     activation: 'relu',
//                 })
//             );
//             const num_classes = data.classes.length;
//             classifier.add(
//                 tf.layers.dense({
//                     units: num_classes,
//                     activation: 'softmax',
//                 })
//             );
//             console.log(classifier.summary());

//             // compile the model
//             classifier.compile({
//                 optimizer: tf.train.adam(),
//                 loss:
//                     num_classes === 2
//                         ? 'binaryCrossentropy'
//                         : 'categoricalCrossentropy',
//                 metrics: ['accuracy'],
//             });

//             // train the model
//             console.log('training...');
//             // time this operation
//             console.time('training');
//             // await classifier.fit(features, data.labels, {
//             //     epochs: 10,
//             //     batchSize: 32,
//             //     callbacks: {
//             //         onEpochEnd: (epoch, logs) => {
//             //             console.log(
//             //                 `Epoch ${epoch + 1} of 10 complete. Loss: ${
//             //                     logs.loss
//             //                 }`
//             //             );
//             //         },
//             //     },
//             // });
//             console.timeEnd('training');
//         }
//     );
// }
