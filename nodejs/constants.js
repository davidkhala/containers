/**
 *
 * @enum {string}
 */
export const ContainerStatus = {
	created: 'created',
	restarting: 'restarting',
	running: 'running',
	removing: 'removing',
	paused: 'paused',
	exited: 'exited', // for short life image like 'hello-world'
	dead: 'dead',
	initialized: 'initialized', // podman alternative of 'created' for some image
};
/**
 *
 * @enum {string}
 */
export const Reason = {
	ContainerNotFound: 'no such container',
	NetworkNotFound: 'no such network',
	ImageNotFound: 'no such image',
	VolumeNotFound: 'no such volume'
};
