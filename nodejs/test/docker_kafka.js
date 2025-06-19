import {ContainerManager} from "@davidkhala/docker/docker.js";

const manager = new ContainerManager();
const Image = 'confluentinc/cp-kafka'
await manager.imagePull(Image);
await manager.run(Image, ['/bin/kafka-storage', 'random-uuid'], true)// run forever
