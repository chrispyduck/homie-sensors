import i2c from "i2c-bus";
import * as winston from "winston";
import { merge } from "lodash";
import { II2CCommand } from "./II2CCommand";
import AHT20 from "./AHT20";
import { II2CConfiguration } from "./II2CConfiguration";
import { EventEmitter } from "events";
import os from "os";
import { ISensor } from "../ISensor";
import { HomieDevice } from "@chrispyduck/homie-device";

export abstract class I2CDevice<TResult extends Record<never, any>> extends EventEmitter implements ISensor<TResult> {
  constructor(deviceType: string, configuration?: II2CConfiguration) {
    super();
    this.configuration = merge({}, AHT20.DefaultConfiguration, configuration);
    this.logger = winston.child({
      type: deviceType,
      name: "default",
    });
  }

  public abstract register(device: HomieDevice): void;
  public abstract read(): Promise<TResult>;

  protected readonly configuration: II2CConfiguration;
  protected readonly logger: winston.Logger;
  private bus$?: i2c.PromisifiedBus;

  protected get bus(): i2c.PromisifiedBus {
    if (!this.bus$)
      throw new Error("Bus has not been opened. Did you forget to call init()?");
    return this.bus$;
  }

  public init = async (): Promise<void> => {
    if (os.platform() != "linux" || os.arch() != "arm") {
      throw new Error("i2c is only supported on linux/arm");
    }
    this.logger.verbose(`Opening I2C bus #${this.configuration.busNumber}`);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const i2c_module = require("i2c-bus");
    this.bus$ = await i2c_module.openPromisified(this.configuration.busNumber);
    this.onInit();
  };

  protected abstract onInit(): Promise<void>;

  protected delay = (ms: number): Promise<void> => new Promise(res => setTimeout(res, ms));

  protected sendCommand = async (cmd: II2CCommand): Promise<void> => {
    if (cmd.args)
      await this.bus?.writeI2cBlock(this.configuration.deviceId, cmd.id, cmd.args.length, cmd.args);

    else
      await this.bus?.sendByte(this.configuration.deviceId, cmd.id);

    await this.delay(cmd.delay);
  };
}
