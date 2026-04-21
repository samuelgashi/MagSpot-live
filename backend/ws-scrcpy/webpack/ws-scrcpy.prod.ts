import { backend, frontend } from './ws-scrcpy.common';
import webpack from 'webpack';

const prodOpts: webpack.Configuration = {
    mode: 'production',
    performance: {
        hints: "warning",          // "error" or false to disable completely
        maxEntrypointSize: 1024000, // 1 MB limit for entrypoints
        maxAssetSize: 1024000,      // 1 MB limit for individual assets
    },
};

const front = () => {
    return Object.assign({}, frontend(), prodOpts);
};
const back = () => {
    return Object.assign({}, backend(), prodOpts);
};

module.exports = [front, back];
