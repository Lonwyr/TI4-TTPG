const assert = require("../../wrapper/assert-wrapper");
const locale = require("../locale");
const { Broadcast } = require("../broadcast");
const { CardUtil } = require("../card/card-util");
const { CloneReplace } = require("../clone-replace");
const { CommandToken } = require("../command-token/command-token");
const { DealDiscard } = require("../card/deal-discard");
const { Faction } = require("../faction/faction");
const { FindTurnOrder } = require("./find-turn-order");
const { Hex } = require("../hex");
const { ObjectNamespace } = require("../object-namespace");
const { STRATEGY_CARDS } = require("../../setup/setup-strategy-cards");
const {
    world,
    Card,
    GameObject,
    Rotator,
    Vector,
} = require("../../wrapper/api");

const ANIMATION_SPEED = 1;

class DealActionCards {
    constructor() {
        throw new Error("static only");
    }

    /**
     * Gets the number of action cards to deal to the player in
     * playerSlot during the status phase.
     *
     * @param {number} playerSlot
     * @returns {number}
     */
    static getNumberActionCardsToDeal(playerSlot) {
        assert(typeof playerSlot === "number");

        let dealNCards = 1;

        const faction = Faction.getByPlayerSlot(playerSlot);
        if (faction && faction.raw.abilities.includes("scheming")) {
            dealNCards += 1;
        }

        if (
            CardUtil.hasCard(
                playerSlot,
                "card.technology.green:base/neural_motivator"
            )
        ) {
            dealNCards += 1;
        }

        return dealNCards;
    }

    /**
     * Deals action cards to players in initiative order, reshuffling the discard
     * if necessary.
     */
    static dealToAll() {
        // get the color names for each slot for better broadcast messages
        const colorNames = Object.fromEntries(
            world.TI4.getAllPlayerDesks().map((element) => [
                element.playerSlot,
                element.colorName,
            ])
        );

        for (const playerSlot of FindTurnOrder.order()) {
            const count =
                DealActionCards.getNumberActionCardsToDeal(playerSlot);
            const message = locale("ui.message.deal_action_cards", {
                playerColor: colorNames[playerSlot],
                count: count,
            });
            Broadcast.chatAll(message);
            const success = DealDiscard.deal("card.action", count, playerSlot);
            if (!success) {
                // What should happen here?
                console.warn("dealToAll: deal failed");
            }
        }
    }
}

class EndStatusPhase {
    constructor() {
        throw new Error("static only");
    }

    /**
     * Gets the number of command tokens to distribute to the player
     * in playerSlot during the status phase.
     *
     * @param {number} playerSlot
     * @returns {number}
     */
    static getNumberOfCommandTokensToDistribute(playerSlot) {
        assert(typeof playerSlot === "number");

        let dealNTokens = 2;

        const faction = Faction.getByPlayerSlot(playerSlot);
        if (faction && faction.raw.abilities.includes("versatile")) {
            dealNTokens += 1;
        }

        if (
            CardUtil.hasCard(
                playerSlot,
                "card.technology.green:base/hyper_metabolism"
            )
        ) {
            dealNTokens += 1;
        }
        if (
            CardUtil.hasCard(
                playerSlot,
                "card.promissory.l1z1x:base/cybernetic_enhancements"
            )
        ) {
            dealNTokens += 1;
        }
        if (
            CardUtil.hasCard(
                playerSlot,
                "card.promissory.l1z1x:base/cybernetic_enhancements.omega"
            )
        ) {
            dealNTokens += 1;
        }

        return dealNTokens;
    }

    /**
     * Repairs all ships.
     */
    static repairShips() {
        for (const obj of world.getAllObjects()) {
            if (ObjectNamespace.isUnit(obj)) {
                const objRotation = obj.getRotation();
                const repairedRotation = new Rotator(
                    objRotation.pitch,
                    objRotation.yaw,
                    0
                );
                obj.setRotation(repairedRotation, ANIMATION_SPEED);
            }
        }
    }

    /**
     * Places all command tokens that are on system tiles back in their proper
     * containers.
     */
    static returnCommandTokens() {
        const playerSlotToCommandTokenBag =
            CommandToken.getPlayerSlotToCommandTokenBag();

        // Get all hexes with a system tile (much cheaper than getSystemTileObjectByPosition).
        const hexSet = new Set();
        for (const systemTileObj of world.TI4.getAllSystemTileObjects()) {
            const pos = systemTileObj.getPosition();
            const hex = Hex.fromPosition(pos);
            hexSet.add(hex);
        }

        for (const obj of world.getAllObjects()) {
            if (obj.getContainer()) {
                continue;
            }
            if (!ObjectNamespace.isCommandToken(obj)) {
                continue;
            }
            const pos = obj.getPosition();
            const hex = Hex.fromPosition(pos);
            if (!hexSet.has(hex)) {
                continue; // not on a system tile
            }
            const playerSlot = obj.getOwningPlayerSlot();
            if (playerSlot < 0) {
                continue;
            }
            const bag = playerSlotToCommandTokenBag[playerSlot];
            if (!bag) {
                continue;
            }
            bag.addObjects([obj]);
        }
    }

    /**
     * Distributes command tokens to all players.
     */
    static distributeCommandTokens() {
        const playerSlotToCommandTokenBag =
            CommandToken.getPlayerSlotToCommandTokenBag();

        for (const playerDesk of world.TI4.getAllPlayerDesks()) {
            const playerSlot = playerDesk.playerSlot;
            const commandTokenBag = playerSlotToCommandTokenBag[playerSlot];
            if (!commandTokenBag) {
                continue;
            }
            const count =
                EndStatusPhase.getNumberOfCommandTokensToDistribute(playerSlot);

            const message = locale("ui.message.distribute_command_tokens", {
                playerColor: playerDesk.colorName,
                count: count,
            });
            const errorMessage = locale(
                "ui.message.not_enough_command_tokens",
                {
                    playerColor: playerDesk.colorName,
                }
            );
            Broadcast.chatAll(message);

            for (let i = 0; i < count; i++) {
                if (commandTokenBag.getItems().length === 0) {
                    Broadcast.chatAll(errorMessage);
                    break;
                } else {
                    const dropPosition = playerDesk.localPositionToWorld(
                        new Vector(5, 20 + i * 1, 0)
                    );
                    let obj = commandTokenBag.takeAt(0, dropPosition, true);
                    obj = CloneReplace.cloneReplace(obj);
                }
            }
        }
    }

    static returnStrategyCard(strategyCardObj) {
        assert(strategyCardObj instanceof GameObject);
        assert(ObjectNamespace.isStrategyCard(strategyCardObj));

        if (!FindTurnOrder.isStrategyCardPicked(strategyCardObj)) {
            return; // already on (a) home spot, leave it alone
        }

        const strategyCardMat = FindTurnOrder.getStrategyCardMat();
        assert(strategyCardMat);

        const snapPoints = strategyCardMat.getAllSnapPoints();
        const nsidToSnapPoint = {};
        for (const cardData of STRATEGY_CARDS) {
            const snapPoint = snapPoints[cardData.snapPointIndex];
            assert(snapPoint);
            nsidToSnapPoint[cardData.nsid] = snapPoint;
        }

        const nsid = ObjectNamespace.getNsid(strategyCardObj);
        const snapPoint = nsidToSnapPoint[nsid];
        assert(snapPoint);
        const pos = snapPoint.getGlobalPosition().add([0, 0, 3]);
        const yaw = snapPoint.getSnapRotation();
        const rot = new Rotator(0, yaw, 0);
        strategyCardObj.setPosition(pos, ANIMATION_SPEED);
        strategyCardObj.setRotation(rot, ANIMATION_SPEED);
    }

    /**
     * Returns all strategy cards to their proper position and rotation.
     */
    static returnStrategyCards() {
        for (const obj of world.getAllObjects()) {
            if (obj.getContainer()) {
                continue;
            }
            if (!ObjectNamespace.isStrategyCard(obj)) {
                continue;
            }
            EndStatusPhase.returnStrategyCard(obj);
        }
    }

    /**
     *  If the given card is not faceup, make it face up.
     * @param {Card} cardObj
     */
    static makeFaceUp(cardObj) {
        assert(cardObj instanceof Card);
        if (!cardObj.isFaceUp()) {
            const rotation = cardObj.getRotation();
            const newRotation = new Rotator(rotation.pitch, rotation.yaw, -180);
            cardObj.setRotation(newRotation, ANIMATION_SPEED);
        }
    }

    /**
     * Refreshes all planets (that are not on system tiles), technologies, agents
     * and relics.
     */
    static refreshCards() {
        const systemHexes = new Set();
        for (const systemTileObj of world.TI4.getAllSystemTileObjects()) {
            const pos = systemTileObj.getPosition();
            const hex = Hex.fromPosition(pos);
            systemHexes.add(hex);
        }

        for (const obj of world.getAllObjects()) {
            if (obj.getContainer()) {
                continue;
            }
            if (!(obj instanceof Card)) {
                continue;
            }
            if (obj.getStackSize() > 1) {
                continue;
            }
            if (obj.isHeld() || obj.isInHolder()) {
                continue;
            }
            if (obj.isFaceUp()) {
                continue; // already face up
            }

            const parsed = ObjectNamespace.parseCard(obj);

            // refresh planets and legendary planet cards
            if (parsed.deck.includes("planet")) {
                // Ignore cards on system tiles.
                const pos = obj.getPosition();
                const hex = Hex.fromPosition(pos);
                if (!systemHexes.has(hex)) {
                    EndStatusPhase.makeFaceUp(obj);
                }
            }

            // refresh technology
            if (parsed.deck.includes("technology")) {
                EndStatusPhase.makeFaceUp(obj);
            }

            // refresh relics: crown of emphidia, maw of worlds etc.
            if (parsed.deck.includes("relic")) {
                EndStatusPhase.makeFaceUp(obj);
            }

            // refresh agents
            if (parsed.deck.includes("agent")) {
                EndStatusPhase.makeFaceUp(obj);
            }
        }
    }
}

module.exports = { DealActionCards, EndStatusPhase };
