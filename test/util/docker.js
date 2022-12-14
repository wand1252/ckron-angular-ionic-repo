const { PassThrough } = require('stream');
const Docker = require('dockerode');
const streamToString = require('stream-to-string');

class DockerUtil {
  constructor() {
    this.docker = new Docker();
  }

  async getImage(name) {
    const localImages = await this.docker.listImages({
      filters: { reference: [name] }
    });

    if (localImages.length > 0) {
      const [imageDesc] = localImages;
      return this.docker.getImage(imageDesc.Id);
    }

    return null;
  }

  async removeImage(name) {
    const image = await this.getImage(name);
    if (image) {
      await image.remove();
    }
  }

  async pullImage(name) {
    const stream = await this.docker.pull(name);
    await new Promise((res, rej) => {
      this.docker.modem.followProgress(stream, (err) => {
        if (err) return rej(err);
        return res();
      });
    });
  }

  async containerExists(id) {
    const containers = await this.docker.listContainers({
      all: true,
      filters: { id: [id] }
    });
    return containers.length > 0;
  }

  async removeContainer(id) {
    const container = this.docker.getContainer(id);
    await container.remove();
  }

  async runContainer(opt, attach = false) {
    const container = await this.docker.createContainer(opt);
    await container.start();
    if (attach) {
      const stream = await container.logs({
        follow: true,
        stdout: true,
        stderr: true
      });
      const through = new PassThrough();
      stream.on('end', () => through.end());
      this.docker.modem.demuxStream(stream, through, through);
      container.output = streamToString(through).then(s => s.trim());
    }
    return container;
  }

}

module.exports = new DockerUtil();
