module.exports = {
  nodeRequestBodyToReadableStream: (req) => {
    if (!["get", "head"].includes(req.method.toLowerCase())) {
      let totalData = [];
      let resolveFinalBuffer;
      let finalBuffer = new Promise((resolve) => {
        resolveFinalBuffer = resolve;
      });
      req.on("data", (data) => {
        totalData.push(data);
      });
      req.on("end", (data) => {
        resolveFinalBuffer(Buffer.concat(totalData));
      });

      return finalBuffer;
    }
  },
  responseToNodeResponse: (response, res) => {
    const reader = response.body.getReader();
    reader.read().then(function pump({ done, value }) {
      if (done) {
        res.end();
        return;
      }

      res.write(value);
      res.flush();
      return reader.read().then(pump);
    });
  },
};
