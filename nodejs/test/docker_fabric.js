import {ContainerManager} from "@davidkhala/docker/docker.js";

const manager = new ContainerManager();
const Image = 'hyperledger/fabric-peer';
await manager.imagePull(Image);
await manager.run(Image, [], true)// run forever
