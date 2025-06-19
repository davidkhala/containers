import {Reason} from './constants.js';

const {VolumeNotFound} = Reason;
export default class Volume {
    constructor(client, logger) {
        this.client = client;
        this.logger = logger;
    }

    /**
     * CreateIfNotExist
     * @param Name
     * @param path
     */
    async create({Name, path}) {
        return this.client.createVolume({
            Name, Driver: 'local', DriverOpts: {
                o: 'bind', device: path, type: 'none'
            }
        });
    }

    async delete(Name) {
        try {
            const volume = this.client.getVolume(Name);
            const info = await volume.inspect();
            this.logger.info('delete volume', Name);
            this.logger.debug('delete volume', info);
            return await volume.remove();
        } catch (err) {
            if (err.statusCode === 404 && err.reason === VolumeNotFound) {
                this.logger.info(err.json.message, 'delete skipped');
            } else {
                throw err;
            }
        }
    }
}