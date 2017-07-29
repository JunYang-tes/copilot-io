#!/usr/bin/env node
import * as cli from "cli-argparser";
import { IResult } from "copilot-core/lib/types";
import { spawn } from "child_process";
import { resolve } from "path";
const { debug, error } = require("b-logger")("copilot.core");
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
  "with-jar": {
    handler: cli.handlers.StoreTrue,
    help: "run server with javafx GUI, java 8 is required (NOT openJDK 8)"
  },
  "jar-alone": {
    handler: cli.handlers.StoreTrue,
    help: "run javafx GUI, java 8 is required (NOT openJDK 8)"
  },
  port: {
    default: 9999,
    help: "Server listen port",
    type: cli.types.OptionType.NUMBER
  }
});

function runJar() {
  debug("run javafx");
  let jar = spawn("java", [
    "-jar",
    resolve(`$ ){__dirname}/../copilot-javafx.jar`),
    "--url",
    "http://localhost:" + opts.port
  ]);
  jar.stdout.on("data", data => {
    debug(data.toString());
  });
  jar.stderr.on("data", data => {
    error(data.toString());
  });
}
function runServer() {
  const { handle, run, startUp } = require("copilot-core");
  startUp().then(() => {
    const server = io.listen(opts.port);
    debug(`listen @${opts.port}`);
    server.on("connection", (client: any) => {
      let list: IResult[] = [];
      debug("Connected");
      client.emit("test", "hello");
      // client.on("echo", i => client.emit("echo", i))
      client.on("process", async (input: string) => {
        let timeout = setTimeout(() => client.emit("loading"), 500);
        debug("@process", input);
        const param: IProcessParam = JSON.parse(input);
        try {
          list = await handle(param.data.input);
          debug(list.slice(0, 10));
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
        clearTimeout(timeout);
      });
      client.on("run", async (input: string) => {
        debug("@run", input);
        const param: IRunParam = JSON.parse(input);
        if (param.data.idx < list.length) {
          debug(list[param.data.idx]);
          run(list[param.data.idx]);
        } else {
          debug("idx is not in range", list.length);
          client.emit("run", {
            data: "idx is not in range",
            seq: param.seq,
            type: "error"
          });
        }
      });
    });
    if (opts["with-jar"]) {
      runJar();
    }
  });
}

if (opts["jar-alone"]) {
  runJar();
} else {
  runServer();
}
