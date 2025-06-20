import assert from "assert";
import ContainerType from 'dockerode/lib/container.js';
import {ContainerStatus, Reason} from "./constants.js";
const {ContainerNotFound} = Reason;
const {exited, running, created} = ContainerStatus;
export default class Container {
    constructor(client, logger) {
        this.client = client;
        this.logger = logger;
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

    /**
     * expected status before healthy
     * @abstract
     * @private
     * @return string[]
     */
    _beforeHealthy() {
        return ['starting', 'unhealthy'];
    }

    static isHealthy(containerInfo) {
        return containerInfo.State.Health?.Status === 'healthy';
    }
    /**
     * @param {ContainerType} container
     */
    static async stream(container) {
        const {Config} = await container.inspect();
        const stream = await container.attach({stream: true, stdout: true, stderr: true});
        if (Config.Tty) {
            stream.pipe(process.stdout);
        } else {
            container.modem.demuxStream(stream, process.stdout, process.stderr);
        }
    }

    /**
     * @param {ContainerOpts} createOptions
     */
    async start(createOptions) {
        const {name: containerName} = createOptions;

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
        return [info, container];
    }

    async inspect(name) {
        const container = this.client.getContainer(name);
        return await container.inspect();
    }

    async waitForHealthy(containerName) {
        const info = await this.inspect(containerName);
        assert.ok(info.State.Health, 'health check section configuration not specified yet');
        if (!Container.isHealthy(info)) {
            const current = info.State.Health.Status;
            assert.ok(this._beforeHealthy().includes(current), `expected status is either ${this._beforeHealthy()}, but got [${current}]`);
            return this.waitForHealthy(containerName);
        }
        return info;
    }

    async list({all, network, status} = {all: true}) {
        const filters = {
            network: network ? [network] : undefined, status: status ? [status] : undefined
        };
        return this.client.listContainers({all, filters});
    }

    async from(container_name) {
        const containers = await this.list();
        return containers.filter(container => container.Names.find(name => name.includes(container_name)));
    }

    /**
     *
     * @param {string} containerName
     */
    async delete(containerName) {
        const container = this.client.getContainer(containerName);
        try {
            const containInfo = await container.inspect();
            const currentStatus = containInfo.State.Status;
            this.logger.debug('delete container', containerName, currentStatus);
            if (this._beforeKill().includes(currentStatus)) {
                await container.kill();
            }
            await container.remove();

        } catch (err) {
            if (err.statusCode === 404 && err.reason === ContainerNotFound) {
                this.logger.info(err.json.message, 'deleting skipped');
            } else {
                throw err;
            }
        }
    }
}