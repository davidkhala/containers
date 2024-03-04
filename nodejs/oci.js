import Dockerode from 'dockerode';
import assert from 'assert';
import {Reason, ContainerStatus} from './constants.js';

const {ContainerNotFound, VolumeNotFound, NetworkNotFound, ImageNotFound} = Reason;
const {exited, running, created} = ContainerStatus;

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
export class OCI {
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

	/**
	 *
	 * @param Name
	 * @param path
	 */
	async volumeCreateIfNotExist({Name, path}) {
		return this.client.createVolume({
			Name, Driver: 'local', DriverOpts: {
				o: 'bind', device: path, type: 'none'
			}
		});
	}

	async volumeRemove(Name) {
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

	/**
	 *
	 * @param {string} containerName
	 */
	async containerDelete(containerName) {
		const container = this.client.getContainer(containerName);
		try {
			const containInfo = await container.inspect();
			const currentStatus = containInfo.State.Status;
			this.logger.debug('delete container', containerName, currentStatus);
			if (this._beforeKill().includes(currentStatus)) {
				await container.kill();
			}
			return await container.remove();

		} catch (err) {
			if (err.statusCode === 404 && err.reason === ContainerNotFound) {
				this.logger.info(err.json.message, 'deleting skipped');
			} else {
				throw err;
			}
		}
	}

	/**
	 * @param {ContainerOpts} createOptions
	 * @param {boolean} [imagePullIfNotExist]
	 */
	async containerStart(createOptions, imagePullIfNotExist) {
		const {name: containerName, Image} = createOptions;
		if (imagePullIfNotExist) {
			await this.imagePullIfNotExist(Image);
		}
		let container = this.client.getContainer(containerName), info;

		try {
			info = await container.inspect();
			this.logger.info('container found', {containerName, status: info.State.Status});

		} catch (err) {
			if (err.reason === ContainerNotFound && err.statusCode === 404) {
				this.logger.info(err.json.message);
				this.logger.info(`creating container [${containerName}]`);
				container = await this.client.createContainer(createOptions);
				info = await container.inspect();
			} else {
				throw err;
			}
		}
		if (this._afterCreate().includes(info.State.Status)) {
			await container.start();
			info = await container.inspect();
			assert.ok(this._afterStart().includes(info.State.Status), `should be one of [${this._afterStart()}], but got status ${info.State.Status}`);
		}
		return info;
	}

	async containerInspect(containerName) {
		const container = this.client.getContainer(containerName);
		return await container.inspect();
	}

	async containerWaitForHealthy(containerName) {
		const info = await this.containerInspect(containerName);
		if (!OCI.isContainerHealthy(info)) {
			return this.containerWaitForHealthy(containerName);
		}
		return info;
	}

	static isContainerHealthy(containerInfo) {
		return containerInfo.State.Health?.Status === 'healthy';
	}

	async containerList({all, network, status} = {all: true}) {
		const filters = {
			network: network ? [network] : undefined, status: status ? [status] : undefined
		};
		return this.client.listContainers({all, filters});
	}

	async inflateContainerName(container_name) {
		const containers = await this.containerList();
		return containers.filter(container => container.Names.find(name => name.includes(container_name)));
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

	async imagePrune() {
		await this.client.pruneImages();
	}

	async imageList(opts = {all: undefined}) {
		return this.client.listImages(opts);
	}

	async imagePullIfNotExist(imageName) {
		const image = this.client.getImage(imageName);
		try {
			return await image.inspect();
		} catch (err) {
			if (err.statusCode === 404 && err.reason === ImageNotFound) {
				this.logger.debug(err.json.message, 'pulling');
				await this.imagePull(imageName);
				return await image.inspect();
			} else {
				throw err;
			}
		}
	}

	async imageDelete(imageName) {
		try {
			const image = this.client.getImage(imageName);
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

	async imagePull(imageName, onProgressCallback) {

		const stream = await this.client.pull(imageName);
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

	/**
	 * expected status after container created
	 * @abstract
	 * @private
	 * @return string[]
	 */
	_afterCreate() {
		return [created];
	}

	/**
	 * expected status after container started
	 * @abstract
	 * @private
	 * @return string[]
	 */
	_afterStart() {
		return [running, exited];
	}

	/**
	 * expected status before killing container
	 * @abstract
	 * @private
	 * @return string[]
	 */
	_beforeKill() {
		return [running];
	}
}

