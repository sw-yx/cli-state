import * as Conf from 'conf';
import uuidv4 from 'uuid/v4';
import Frecency from 'frecency';
import { LocalStorage } from 'node-localstorage';
import envPaths from 'env-paths';

// https://stackoverflow.com/questions/43481518/get-argument-types-for-function-class-constructor
// type GetConstructorArgs<T> = T extends new (arg1: infer U) => any ? U : never;
// type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;

type AcceptableConfigTypes = string | boolean | number;
interface AcceptableConfigDict {
  [key: string]: AcceptableConfigTypes | AcceptableConfigDict;
}
/** can take an indefinitely nested set of strings, bools, or nums */
type ConfigTypes = AcceptableConfigDict | AcceptableConfigTypes;

let willPrintDebugMessages = false;

/** machine/user level config */
export let globalState: Conf<ConfigTypes>;
/** machine/user level frecencystore */
export let accessGlobalFrecency: (key: string) => Frecency;
/** project level config */
export let projectState: Conf<ConfigTypes>;
type idAttrFn = (result: string) => string;
export type initCLIStateArgs = {
  projectStatePath: string;
  globalConfOptions?: Conf.Options<ConfigTypes>;
  projectConfOptions?: Conf.Options<ConfigTypes>;
  frecencyOpts?: {
    idAttribute?: string | idAttrFn;
    timeStampsLimit?: number;
    recentSelectionsLimit?: number;
    exactQueryMatchWeight?: number;
    subQueryMatchWeight?: number;
    recentSelectionsMatchWeight?: number;
  };
  printDebugMessages?: boolean;
};
export const initCLIState = ({
  /** where in your current project do you store your config */
  projectStatePath,
  globalConfOptions = {},
  projectConfOptions = {},
  frecencyOpts,
  /** pass true to print debug msgs */
  printDebugMessages,
}: initCLIStateArgs) => {
  willPrintDebugMessages = printDebugMessages || false;
  // provide some nice defaults for the CLI global settings
  const globalStateDefaults = {
    /* disable stats from being sent home */
    telemetry: 'enabled',
    /* a unique ID for your CLI user */
    cliId: uuidv4(),
  };
  if (!globalConfOptions.defaults) {
    globalConfOptions = {
      ...globalConfOptions,
      defaults: globalStateDefaults,
    };
  }
  globalState = new Conf.default<ConfigTypes>(globalConfOptions);

  // frecency
  if (globalState instanceof Conf.default) {
    const { _options: options } = globalState as typeof globalState & {
      _options: { projectName: string };
    };
    const storageProviderFrecencyFilePath = envPaths(options.projectName).cache; // store frecency in cache, it is disposable
    if (willPrintDebugMessages) {
      console.log({
        storageProviderFrecencyFilePath,
        globalStatePath: globalState.path,
      });
    }
    const storageProvider = new LocalStorage(storageProviderFrecencyFilePath);
    accessGlobalFrecency = key =>
      new Frecency({
        key,
        storageProvider,
        idAttribute: 'value',
        ...frecencyOpts,
      });
  }

  // scope projectConfOptions to cwd
  projectState = new Conf.default({
    ...projectConfOptions,
    cwd: projectStatePath,
  });
  return {
    globalState,
    projectState,
    accessGlobalFrecency,
  };
};
