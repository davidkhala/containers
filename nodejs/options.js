import assert from 'assert';
/**
 * @typedef {Object} ContainerOpts
 * @property {string} name container name
 * @property {string[]} Env
 * @property {string} Cmd
 * @property {string} Image
 * @property {HostConfig} HostConfig
 */

/**
 * @typedef {Object} HostConfig
 * @example {
 *        Binds:[ `${hostPath}:${containerPath}` ],
 *    PortBindings: {
 *        '7054': [{HostPort: port.toString()}]
 *    }
 *  }
 *
 * @property {string[]} Binds list of `${hostPath}:${containerPath}`
 * @property {PortBindings} PortBindings
 */

/**
 * @typedef {Record<string, HostPort[]>} PortBindings with exposed port number in string format as key
 */

/**
 * @typedef {Object} HostPort
 * @property {string} HostPort port number in string format
 */
/**
 *
 */
export class OCIContainerOptsBuilder {

	/**
	 *
	 * @param {string} Image
	 * @param {string[]} [Cmd] the default of CMD should be empty array that it can fall back to image default
	 * @param [logger]
	 */
	constructor(Image, Cmd = [], logger = console) {
		assert.ok(Array.isArray(Cmd), `Cmd should be array, but got ${Cmd}`);
		/**
		 * @type {ContainerOpts}
		 */
		this.opts = {
			Image, Cmd, HostConfig: {}
		};
		this.logger = logger;
	}

	/**
	 *
	 * @param {string} name The container name
	 */
	set name(name) {
		this.opts.name = name;
	}

	/**
	 * Attach standard streams to a TTY, including stdin if it is not closed.
	 * @param {boolean} tty
	 */
	set tty(tty) {
		if (tty) {
			this.opts.Tty = true;
		} else {
			delete this.opts.Tty;
		}
	}

	/**
	 *
	 * @param {string[]} env
	 */
	set env(env) {
		this.opts.Env = env;
	}

	/**
	 * @param {object} env
	 * @returns {OCIContainerOptsBuilder}
	 */
	setEnvObject(env) {
		this.env = Object.entries(env).map(([key, value]) => `${key}=${value}`);
		return this;
	}

	/**
	 *
	 * @param {string} key
	 * @param {string} value
	 * @returns {OCIContainerOptsBuilder}
	 */
	addEnv(key, value) {
		const newItem = `${key}=${value}`;
		if (!this.opts.Env.includes(newItem)) {
			this.opts.Env.push(newItem);
		}
		return this;
	}

	/**
	 * @param {string} localBind `8051:7051`
	 * @returns {OCIContainerOptsBuilder}
	 */
	setPortBind(localBind) {
		let HostPort, containerPort;
		if (Number.isInteger(localBind)) {
			localBind = localBind.toString();
		}
		const tokens = localBind.split(':');
		switch (tokens.length) {
			case 1:
				HostPort = tokens[0];
				containerPort = tokens[0];
				break;
			case 2:
				HostPort = tokens[0];
				containerPort = tokens[1];
				break;
			default:
				assert.fail(`invalid localBind string[${localBind}], it should be like 8051:7051 or 7051`);
		}

		this.logger.info(`container:${containerPort} => localhost:${HostPort}`);
		if (!this.opts.ExposedPorts) {
			this.opts.ExposedPorts = {};
		}

		if (!this.opts.HostConfig.PortBindings) {
			this.opts.HostConfig.PortBindings = {};
		}
		this.opts.ExposedPorts[containerPort] = {};
		this.opts.HostConfig.PortBindings[containerPort] = [{
			HostPort
		}];

		return this;
	}

	/**
	 *
	 * @param {string} volumeName or a bind-mount absolute path
	 * @param {string} containerPath
	 * @returns {OCIContainerOptsBuilder}
	 */
	setVolume(volumeName, containerPath) {
		if (!this.opts.HostConfig.Binds) {
			this.opts.HostConfig.Binds = [];
		}
		this.opts.HostConfig.Binds.push(`${volumeName}:${containerPath}`);
		return this;
	}

	set healthcheck(commands) {

		if (!this.opts.Healthcheck) {
			this.opts.Healthcheck = {};
		}

		if (Array.isArray(commands)) {
			this.opts.Healthcheck.Test = commands;
		} else {
			this.opts.Healthcheck.Test = ['NONE']; // disable healthcheck
		}
	}

	//
	/**
	 * https://docs.docker.com/engine/api/v1.44/#tag/Container/operation/ContainerCreate
	 * @param useShell
	 * @param commands
	 * @param interval checks frequency in milliseconds
	 */
	setHealthCheck({
		useShell, commands, interval = 1
	}) {
		this.healthcheck = [useShell ? 'CMD-SHELL' : 'CMD', ...commands];
		this.opts.Healthcheck.Interval = interval * 1000000;
	}

}