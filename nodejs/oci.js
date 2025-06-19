import Dockerode, {Container as ContainerType} from 'dockerode';
import {Reason} from './constants.js';
import {Writable} from 'stream'
import Volume from "./volume.js";
import Image from './image.js'

const {NetworkNotFound} = Reason;

/**
 * @typedef {Object} DockerodeOpts
 * @property {string} [socketPath]
 * @property {string} [protocol]
 * @property {string} [host]
 * @property {number} [port]
 * @property {string} [version] runtime version like v1.39
 * @property {string} [ca]
 * @property {string} [cert]
 * @property {string} [key]
 */


/**
 * Open Container Initiative: OCI
 */
export default class OCI {
    /**
     *
     * @param {DockerodeOpts} [opts]
     * @param [logger]
     */
    constructor(opts, logger = console) {
        if (opts && !opts.protocol && opts.host) {
            opts.protocol = 'ssh';
        }

        this.client = new Dockerode(opts);
        this.logger = logger;
    }

    async info() {
        return this.client.info();
    }

    async ping() {
        const result = await this.client.ping();
        return result.toString();
    }

    async systemPrune() {
        await this.client.pruneContainers();
        await this.client.pruneVolumes();
        await this.client.pruneNetworks();
    }

    get volume() {
        return new Volume(this.client, this.logger);
    }

    get container() {
        return new Container(this.client, this.logger);
    }

    get image() {
        return new Image(this.client, this.logger);
    }
    /**
     * @param {ContainerOpts} createOptions
     * @param {boolean} [imagePullIfNotExist]
     */
    async containerStart(createOptions, imagePullIfNotExist) {
        const {Image} = createOptions;
        if (imagePullIfNotExist) {
            await this.image.pullIfNotExist(Image);
        }
        return await this.container.start(createOptions)
    }

    async run(Image, Cmd, capture) {

        if (!capture) {
            // By default, this can print to process.stdout
            // For service-like command, this can be pending. Thus, direct return a promise here to allow async
            return this.client.run(Image, Cmd);
        } else {
            let stdoutData = '', stderrData = ''
            const stdoutStream = new Writable({
                write(chunk, encoding, callback) {
                    stdoutData += chunk.toString();
                    callback();
                }
            });

            const stderrStream = new Writable({
                write(chunk, encoding, callback) {
                    stderrData += chunk.toString();
                    callback();
                }
            });
            await this.client.run(image, commands, [
                stdoutStream, stderrStream,
            ], {Tty: false});
            return [stdoutData.trim(), stderrData.trim()]
        }
    }

    async networkRemove(Name) {
        try {
            const network = this.client.getNetwork(Name);
            await network.inspect();
            return await network.remove();
        } catch (err) {
            if (err.statusCode === 404 && err.reason === NetworkNotFound) {
                this.logger.info(err.json.message, 'deleting skipped');
            } else {
                throw err;
            }
        }
    }


}

