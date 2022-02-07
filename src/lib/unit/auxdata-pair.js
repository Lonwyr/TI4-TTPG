const assert = require("../../wrapper/assert");
const locale = require("../locale");
const { AuxData } = require("./auxdata");
const { Broadcast } = require("../broadcast");
const { Hex } = require("../hex");
const { ObjectNamespace } = require("../object-namespace");
const { UnitAttrs } = require("./unit-attrs");
const { UnitModifier } = require("./unit-modifier");
const { UnitPlastic } = require("./unit-plastic");
const { world } = require("../../wrapper/api");

/**
 * Given a combat between two players, create and fill in the AuxData
 * records for each.
 *
 * Accounts for:
 * - player unit upgrades ("Carrier II")
 * - self-modifiers ("Morale Boost")
 * - from-opponent-modifiers ("Disable")
 * - faction abilities ("Fragile")
 *
 * It will find all units in the primary hex as well as adjacent hexes,
 * assigning cardboard tokens to the closest in-hex plastic.
 *
 * If the opponent (playerSlot2) is not given, detect it based on plastic.
 *
 * This is a VERY expensive process, may want to make it asynchronous.
 */
class AuxDataPair {
    constructor(playerSlot1, playerSlot2, hex, planet) {
        assert(typeof playerSlot1 === "number");
        assert(typeof playerSlot2 === "number");
        assert(!hex || typeof hex === "string");
        assert(!planet || typeof planet === "string");

        this._playerSlot1 = playerSlot1;
        this._playerSlot2 = playerSlot2;
        this._hex = hex;
        this._planet = planet;

        this._adjHexes = new Set();

        this._allPlastic = false;
        this._hexPlastic = false;
        this._adjPlastic = false;

        this._aux1 = false;
        this._aux2 = false;
    }

    _getProcessQueue() {
        return [
            () => {
                this.computeAdjHexes();
            },
            () => {
                this.computePlatic();
            },
            () => {
                this.computeOpponent();
                this._aux1 = new AuxData(this._playerSlot1);
                this._aux2 = new AuxData(this._playerSlot2);
            },
            () => {
                this.computeSelfUnitCounts(this._aux1);
            },
            () => {
                this.computeSelfUnitCounts(this._aux2);
            },
            () => {
                this.computeSelfUnitUpgrades(this._aux1);
            },
            () => {
                this.computeSelfUnitUpgrades(this._aux2);
            },
            () => {
                this.computeSelfUnitAbilities(this._aux1, this._aux2);
            },
            () => {
                this.computeSelfUnitAbilities(this._aux2, this._aux1);
            },
            () => {
                this.computeSelfUnitModifiers(this._aux1, this._aux2);
            },
            () => {
                this.computeSelfUnitModifiers(this._aux2, this._aux1);
            },
            () => {
                this.computeSelfFactionAbilities(this._aux1, this._aux2);
            },
            () => {
                this.computeSelfFactionAbilities(this._aux2, this._aux1);
            },
            () => {
                this.applySelfUnitModifiers(this._aux1, this._aux2);
            },
            () => {
                this.applySelfUnitModifiers(this._aux2, this._aux1);
            },
        ];
    }

    getPairSync() {
        const processQueue = this._getProcessQueue();
        for (const processEntry of processQueue) {
            processEntry();
        }
        return [this._aux1, this._aux2];
    }

    getPairAsync(callback) {
        const processQueue = this._getProcessQueue();
        const processNext = () => {
            const processEntry = processQueue.shift();
            if (!processEntry) {
                callback(this._aux1, this._aux2);
            }
            setTimeout(processNext, 10);
        };
        processNext();
    }

    /**
     * If given a hex but not a planet, compute the set of adjacent hexes.
     */
    computeAdjHexes() {
        if (this._hex && !this._planet) {
            for (const adjHex of Hex.neighbors(this._hex)) {
                this._adjHexes.add(adjHex);
            }
            // TODO XXX WORMHOLE ADJACENCY
            // TODO XXX HYPERLANE ADJACENCY
        }

        // Remove any hexes that do not contain a system tile.
        const newAdjHexes = new Set();
        this._adjHexes.forEach((hex) => {
            const pos = Hex.toPosition(hex);
            const src = pos.add([0, 0, 10]);
            const dst = pos.subtract([0, 0, 10]);
            const hits = world.lineTrace(src, dst);
            for (const hit of hits) {
                if (ObjectNamespace.isSystemTile(hit.object)) {
                    newAdjHexes.add(hex);
                    break;
                }
            }
        });
        this._adjHexes = newAdjHexes;
    }

    /**
     * Get all plasic in hex and adjacent hexes.  Restrict to "on planet"
     * plastic if a planet combat.
     */
    computePlatic() {
        this._allPlastic = this._hex ? UnitPlastic.getAll() : [];
        this._hexPlastic = this._allPlastic.filter(
            (plastic) => plastic.hex === this._hex
        );
        this._adjPlastic = this._allPlastic.filter((plastic) =>
            this._adjHexes.has(plastic.hex)
        );
        UnitPlastic.assignTokens(this._hexPlastic);
        UnitPlastic.assignTokens(this._adjPlastic);
        if (this._planet) {
            UnitPlastic.assignPlanets(this._planet);
            this._planethexPlastic = this._planethexPlastic.filter(
                (plastic) => plastic.planet === this._planetplanet
            );
        }
    }

    /**
     * If no opponent was given compute one based on "not us" plastic in fight.
     */
    computeOpponent() {
        if (this._playerSlot2 >= 0) {
            return; // already have an oppoent
        }
        // Units pruned down to just those involved in space/planet fight.
        for (const plastic of this._hexPlastic) {
            if (plastic.owningPlayerSlot === this._playerSlot1) {
                continue; // ignore our own units
            }
            if (plastic.owningPlayerSlot === this._playerSlot2) {
                continue; // ignore if we already think this is opponent
            }
            if (this._playerSlot2 < 0) {
                this._playerSlot2 = plastic.owningPlayerSlot;
            } else {
                // Multiple opponents!
                Broadcast.broadcastAll(locale("ui.error.too_many_opponents"));
                this._playerSlot2 = -1;
                break;
            }
        }
    }

    /**
     * Count units belonging to this player in the main and ajacent hexes.
     *
     * @param {AuxData} selfAuxData
     */
    computeSelfUnitCounts(selfAuxData) {
        assert(selfAuxData instanceof AuxData);

        // Abort if anonymous AuxData.
        if (selfAuxData.playerSlot < 0) {
            return;
        }

        // Get hex and adjacent plastic for this player.
        // Also get counts, beware of x3 tokens!
        const playerHexPlastic = this._hexPlastic.filter(
            (plastic) => plastic.owningPlayerSlot == selfAuxData.playerSlot
        );
        selfAuxData.plastic.push(...playerHexPlastic);
        for (const plastic of playerHexPlastic) {
            const count = selfAuxData.count(plastic.unit);
            selfAuxData.overrideCount(plastic.unit, count + plastic.count);
        }
        const playerAdjPlastic = this._adjPlastic.filter(
            (plastic) => plastic.owningPlayerSlot == selfAuxData.playerSlot
        );
        selfAuxData.adjacentPlastic.push(...playerAdjPlastic);
        for (const plastic of playerAdjPlastic) {
            const count = selfAuxData.adjacentCount(plastic.unit);
            selfAuxData.overrideAdjacentCount(
                plastic.unit,
                count + plastic.count
            );
        }
    }

    /**
     * Gather and apply applicable unit upgrades.
     *
     * @param {AuxData} selfAuxData
     */
    computeSelfUnitUpgrades(selfAuxData) {
        assert(selfAuxData instanceof AuxData);

        // Abort if anonymous AuxData.
        if (selfAuxData.playerSlot < 0) {
            return;
        }

        // Apply unit upgrades.
        const upgrades = UnitAttrs.getPlayerUnitUpgrades(
            selfAuxData.playerSlot
        );
        for (const upgrade of upgrades) {
            selfAuxData.unitAttrsSet.upgrade(upgrade);
        }
    }

    /**
     * Gather BUT DO NOT APPLY unit-ability unit modifiers.
     * A unit-ability unit modifier are things like flagship abilities.
     *
     * @param {AuxData} selfAuxData
     */
    computeSelfUnitAbilities(selfAuxData) {
        // Abort if anonymous AuxData.
        if (selfAuxData.playerSlot < 0) {
            return;
        }

        for (const unitAttrs of selfAuxData.unitAttrsSet.values()) {
            if (!selfAuxData.has(unitAttrs.raw.unit)) {
                continue; // not present
            }
            if (!unitAttrs.raw.unitAbility) {
                continue; // no ability
            }
            const unitModifier = UnitModifier.getUnitAbilityUnitModifier(
                unitAttrs.raw.unitAbility
            );
            if (unitModifier) {
                selfAuxData.unitModifiers.push(unitModifier);
            }
        }
    }

    /**
     * Gather BUT DO NOT APPLY card-given unit modifiers.
     *
     * @param {AuxData} selfAuxData
     * @param {AuxData} opponentAuxData
     */
    computeSelfUnitModifiers(selfAuxData, opponentAuxData) {
        assert(selfAuxData instanceof AuxData);
        assert(opponentAuxData instanceof AuxData);

        // Abort if anonymous AuxData.
        if (selfAuxData.playerSlot < 0) {
            return;
        }

        // Get modifiers.  For each perspective get "self modifiers" and
        // "opponent modifiers applied to opponent".
        const modifiersSelf = UnitModifier.getPlayerUnitModifiers(
            selfAuxData.playerSlot,
            "self"
        );
        const modifiersOpponent = UnitModifier.getPlayerUnitModifiers(
            opponentAuxData.playerSlot,
            "opponent"
        );
        selfAuxData.unitModifiers.push(...modifiersSelf);
        selfAuxData.unitModifiers.push(...modifiersOpponent);
    }

    /**
     * Gather BUT DO NOT APPLY faction-ability unit modifiers.
     *
     * @param {AuxData} selfAuxData
     * @param {AuxData} opponentAuxData
     */
    computeSelfFactionAbilities(selfAuxData, opponentAuxData) {
        assert(selfAuxData instanceof AuxData);
        assert(opponentAuxData instanceof AuxData);

        // Abort if anonymous AuxData.
        if (selfAuxData.playerSlot < 0) {
            return;
        }

        // TODO XXX LOOK UP FACTION BY PLAYER SLOT, ADD MODIFIERS TO AUX.FACTIONABILITIES!
        for (const factionAbility of []) {
            const unitModifier =
                UnitModifier.getFactionAbilityUnitModifier(factionAbility);
            if (unitModifier) {
                selfAuxData.unitModifiers.push(unitModifier);
            }
        }
        // TODO XXX Repeat for opponent's "opponent" modifiers.
    }

    /**
     * Delay this until after computing unit counts for self AND opponent!
     *
     * @param {AuxData} selfAuxData
     * @param {AuxData} opponentAuxData
     */
    applySelfUnitModifiers(selfAuxData, opponentAuxData) {
        assert(selfAuxData instanceof AuxData);
        assert(opponentAuxData instanceof AuxData);

        // Abort if anonymous AuxData.
        if (selfAuxData.playerSlot < 0) {
            return;
        }

        UnitModifier.sortPriorityOrder(selfAuxData.unitModifiers);
        for (const unitModifier of selfAuxData.unitModifiers) {
            unitModifier.apply(selfAuxData.unitAttrsSet, {
                self: selfAuxData,
                opponent: opponentAuxData,
            });
        }
    }
}

module.exports = { AuxDataPair };