import deepDiff from "deep-diff";
import type { SyncClient } from "twilio-sync";
import { TypedEventEmitter } from "../../lib/events.js";
import { getMakeLogger } from "../../lib/logger.js";
import type { SessionContext } from "../../shared/session/context.js";
import type {
  HumanTextTurn,
  HumanTextTurnParams,
  SystemTurnParams,
  TurnRecord,
} from "../../shared/session/turns.js";
import type {
  MapItemAddedEvent,
  MapItemRemovedEvent,
  MapItemUpdatedEvent,
} from "../../shared/sync/types.js";
import { getSyncClient, SyncQueueService } from "./sync.js";
import { TurnStore } from "./turn-store.js";

export type * from "./turn-store.js";

export class SessionStore {
  public context: Partial<SessionContext>;
  public turns: TurnStore;

  private syncClient: SyncClient;
  private syncQueue: SyncQueueService;
  private log: ReturnType<typeof getMakeLogger>;

  constructor(
    public callSid: string,
    context?: Partial<SessionContext>,
  ) {
    this.log = getMakeLogger(callSid);
    this.eventEmitter = new TypedEventEmitter<TurnEvents>();

    this.context = context ?? {};
    this.context.toolConfig = context?.toolConfig ?? {};

    this.turns = new TurnStore(callSid, this.eventEmitter); // turn events are emitted in the turn store

    this.syncClient = getSyncClient(callSid);
    this.syncQueue = new SyncQueueService(
      callSid,
      this.syncClient,
      () => this.context,
      (turnId: string) => this.turns.get(turnId),
    );

    // send data to sync when local updates are made
    this.on("turnAdded", this.syncQueue.addTurn);
    this.on("turnDeleted", this.syncQueue.deleteTurn);
    this.on("turnUpdated", this.syncQueue.updateTurn);
    // note: contextUpdates are sent to sync w/in the setContext method

    // send initial context to sync
    for (const key in this.context)
      this.syncQueue.updateContext(key as keyof SessionContext);

    // subscribe to context changes from sync and update local state accordingly
    // this is how subconscious processes communicate with the application
    // note: turns are not bidirectional. turn data is only sent to sync
    this.syncQueue.ctxMapPromise.then((ctxMap) => {
      ctxMap.on("itemAdded", (ev: MapItemAddedEvent) => {
        if (ev.isLocal) return;
        this.log.info("sync", `context added ${ev.item.key}`);
        this.setContext({ [ev.item.key]: ev.item.data }, false);
      });
      ctxMap.on("itemRemoved", (ev: MapItemRemovedEvent) => {
        if (ev.isLocal) return;
        this.log.info("sync", `context removed ${ev.key}`);
        this.setContext({ [ev.key]: undefined }, false);
      });
      ctxMap.on("itemUpdated", (ev: MapItemUpdatedEvent) => {
        if (ev.isLocal) return;
        this.log.info("sync", `context updated ${ev.item.key}`);
        this.setContext({ [ev.item.key]: ev.item.data }, false);
      });
    });
  }

  /****************************************************
   Parking Lot
   holds turns that will be added before the next completion. this is used for async situations, such as handling a human agent's response
   // todo: accept any turn type and refactor this entirely
  ****************************************************/
  private parkingLot: Map<string, HumanTextTurnParams | SystemTurnParams> =
    new Map();
  public addParkingLotItem = (params: {
    human?: HumanTextTurnParams;
    system?: SystemTurnParams;
  }) => {
    if (params.system) this.parkingLot.set("addSystemMessage", params.system); // add system first
    if (params.human) this.parkingLot.set("addHumanMessage", params.human);

    this.eventEmitter.emit("tryCompletion");
  };

  public insertParkingLot = () => {
    const systemTurnParams = this.parkingLot.get("addSystemMessage") as
      | SystemTurnParams
      | undefined;
    this.parkingLot.delete("addSystemMessage");
    const humanTurnParams = this.parkingLot.get("addHumanMessage") as
      | HumanTextTurn
      | undefined;
    this.parkingLot.delete("addHumanMessage");

    if (systemTurnParams) this.turns.addSystem(systemTurnParams);
    if (humanTurnParams) this.turns.addHumanText(humanTurnParams);
  };

  /****************************************************
   Session Context
  ****************************************************/
  setContext = (update: Partial<SessionContext>, sendToSync = true) => {
    const prev = this.context;

    const context = { ...(this.context ?? {}), ...update };

    const diff = deepDiff(prev, context);
    if (!diff) return;

    this.context = context;

    const keys = diff.map(({ path }) => path![0]) as (keyof SessionContext)[];
    this.eventEmitter.emit("contextUpdated", { context, prev, keys });
    if (sendToSync) keys.forEach(this.syncQueue.updateContext);
  };

  /****************************************************
   Event Typing
  ****************************************************/
  private eventEmitter: StoreEventEmitter;
  public on: (typeof this.eventEmitter)["on"] = (...args) =>
    this.eventEmitter.on(...args);
}

export type StoreEventEmitter = TypedEventEmitter<
  TurnEvents & ContextEvents & HumanInLoop
>;

// todo: this is a hack to enable human in loop.
// need to figure out way to try to trigger completion loop without mixing LLM service
export interface HumanInLoop {
  tryCompletion: () => void;
}

export interface ContextEvents {
  contextUpdated: (payload: {
    context: Partial<SessionContext>;
    prev: Partial<SessionContext>;
    keys: (keyof SessionContext)[];
  }) => void;
}

export interface TurnEvents {
  turnAdded: (turn: TurnRecord) => void;
  turnDeleted: (turnId: string, turn?: TurnRecord) => void;
  turnUpdated: (turnId: string) => void;
}
