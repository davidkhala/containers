import {Reason} from './constants.js';

const {ImageNotFound} = Reason;
export default class Image {
    constructor(client, logger) {
        this.client = client;
        this.logger = logger;
    }

    async prune() {
        await this.client.pruneImages();
    }

    async list(opts = {all: undefined}) {
        return this.client.listImages(opts);
    }

    async pullIfNotExist(name) {
        const image = this.client.getImage(name);
        try {
            return [await image.inspect(), image];
        } catch (err) {
            if (err.statusCode === 404 && err.reason === ImageNotFound) {
                this.logger.debug(err.json.message, 'pulling');
                await this.pull(name);
                return [await image.inspect(), image];
            } else {
                throw err;
            }
        }
    }

    async delete(name) {
        try {
            const image = this.client.getImage(name);
            const imageInfo = await image.inspect();
            this.logger.info('delete image', imageInfo.RepoTags);
            return await image.remove({force: true});
        } catch (err) {
            if (err.statusCode === 404 && err.reason === ImageNotFound) {
                this.logger.debug(err.json.message, 'skip deleting');
            } else {
                throw err;
            }
        }
    }

    async pull(name, onProgressCallback) {

        const stream = await this.client.pull(name);
        return new Promise((resolve, reject) => {
            const onFinished = (err, output) => {
                if (err) {
                    this.logger.error('pull image error', {err, output});
                    return reject(err);
                } else {
                    return resolve(output);
                }
            };
            this.client.modem.followProgress(stream, onFinished, onProgressCallback);
        });

    }
}