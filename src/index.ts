import * as cli from "cli-argparser";
import { IResult } from "copilot-core/lib/types";
import { startUp, handle, run } from "copilot-core";
const { debug } = require("b-logger")("copilot.core");
const io = require("socket.io");

interface IProcessParam {
  data: {
    input: string;
  };
  seq: number;
}
interface IRunParam {
  data: {
    idx: number;
  };
  seq: number;
}

const opts = cli.cmd.cmdParser({
  jar: {
    handler: cli.handlers.StoreTrue,
    help: "run javafx GUI, java 8 is required"
  },
  port: {
    default: 9999,
    help: "Server listen port",
    type: cli.types.OptionType.NUMBER
  }
});
startUp().then(() => {
  const server = io.listen(opts.port);
  debug(`listen @${opts.port}`);
  server.on("connection", (client: any) => {
    let list: IResult[] = [];
    debug("Connected");
    client.emit("test", "hello");
    // client.on("echo", i => client.emit("echo", i))
    client.on("process", async (input: string) => {
      debug("@process", input);
      const param: IProcessParam = JSON.parse(input);
      try {
        list = await handle(param.data.input);
        client.emit("process", {
          data: list,
          seq: param.seq,
          type: "result"
        });
      } catch (e) {
        debug(e);
        client.emit("process", {
          data: e.message,
          seq: param.seq,
          type: "error"
        });
      }
    });
    client.on("run", async (input: string) => {
      const param: IRunParam = JSON.parse(input);
      if (list.length <= param.seq) {
        run(list[param.data.idx]);
      } else {
        client.emit("run", {
          data: "idx is not in range",
          seq: param.seq,
          type: "error"
        });
      }
    });
  });
});
