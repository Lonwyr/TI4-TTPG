const assert = require("../wrapper/assert-wrapper");
const { AbstractSetup } = require("./abstract-setup");
const { Faction } = require("../lib/faction/faction");
const { ObjectNamespace } = require("../lib/object-namespace");
const { PlayerDesk } = require("../lib/player-desk");
const { Spawn } = require("./spawn/spawn");
const {
    Card,
    Container,
    ObjectType,
    Rotator,
    Vector,
} = require("../wrapper/api");
const { TECH_DECK_LOCAL_OFFSET } = require("./setup-generic-tech-deck");
const { PROMISSORY_DECK_LOCAL_OFFSET } = require("./setup-generic-promissory");

const FACTION_SHEET = {
    pos: {
        x: -8,
        y: -6,
        z: 0,
    },
};

const COMMAND_TOKENS = {
    tokenNsidType: "token.command",
    tokenCount: 16,
    bagNsid: "bag.token.command:base/*",
    //bagPos: { x: -12, y: 24, z: 0 },
    bagPos: { x: -13.71, y: 35.79, z: 0 },
    bagType: 2, // regular
    commandSheetLocalOffsets: [
        // Tactic
        { x: 6.7, y: -2.3, z: 1, yaw: -90 },
        { x: 6.7, y: 0.5, z: 1, yaw: -90 },
        { x: 3.7, y: -1.0, z: 1, yaw: -90 },
        // Fleet
        { x: 4.5, y: 3.8, z: 1, yaw: -90, roll: 180 },
        { x: 2.6, y: 1.8, z: 1, yaw: -90, roll: 180 },
        { x: 1.6, y: 5.4, z: 1, yaw: -90, roll: 180 },
        // Strategy
        { x: -1.3, y: 5.7, z: 1, yaw: -90 },
        { x: -4.3, y: 4.0, z: 1, yaw: -90 },
    ],
};

const CONTROL_TOKENS = {
    tokenNsidType: "token.control",
    tokenCount: 1,
    bagNsid: "bag.token.control:base/*",
    bagType: 1, // infinite
    //bagPos: { x: -18, y: 23, z: 0 },
    bagPos: { x: -7.55, y: 35.32, z: 0 },
};

const LEADERS = {
    agent: {
        sheetLocalOffset: { x: 6.88, y: -0.11, z: 1 },
        roll: 180,
    },
    commander: {
        sheetLocalOffset: { x: 2.28, y: -0.1, z: 1 },
        roll: 0,
    },
    hero: {
        sheetLocalOffset: { x: -2.28, y: -0.11, z: 1 },
        roll: 0,
    },
    mech: {
        sheetLocalOffset: { x: -6.88, y: -0.11, z: 1 },
        roll: 180,
    },
};
const EXTRA_LEADER_OFFSET_Y = -2;

class SetupFaction extends AbstractSetup {
    constructor(playerDesk, factionNsidName) {
        assert(playerDesk instanceof PlayerDesk);
        assert(typeof factionNsidName === "string");
        super();
        this.setPlayerDesk(playerDesk);

        this._faction = Faction.getByNsidName(factionNsidName);
        assert(this._faction);

        this._leaderTypeToCount = {
            agent: 0,
            commander: 0,
            hero: 0,
            mech: 0,
        };
    }

    setup() {
        this._setupFactionSheet();
        this._setupFactionTech();
        this._setupFactionPromissoryNotes();

        this._leaderDeck = this._setupFactionLeaders();
        this._moveLeadersToSheet(this._leaderDeck);

        this._allianceDeck = this._setupFactionAlliance();
        this._moveLeadersToSheet(this._allianceDeck);

        this._commandTokensBag =
            this._setupFactionCommandControlTokens(COMMAND_TOKENS);
        this._ownerTokensBag =
            this._setupFactionCommandControlTokens(CONTROL_TOKENS);

        this._placeInitialCommandTokens(this._commandTokensBag);
        this._placeScoreboardOwnerToken(this._ownerTokensBag);
    }

    _setupFactionSheet() {
        const sheetNsid = "sheet.faction:base/???"; // temporary until assets are in
        const pos = this.playerDesk.localPositionToWorld(FACTION_SHEET.pos);
        const rot = this.playerDesk.rot;
        const sheet = Spawn.spawn(sheetNsid, pos, rot);
        sheet.setObjectType(ObjectType.Ground);
    }

    _setupFactionTech() {
        const pos = this.playerDesk.localPositionToWorld(
            TECH_DECK_LOCAL_OFFSET
        );
        const rot = this.playerDesk.rot;

        // Only use items listed in faction tables, not just because in deck.
        const acceptNames = new Set();
        this._faction.raw.techs.forEach((name) => acceptNames.add(name));
        this._faction.raw.units.forEach((name) => acceptNames.add(name));

        const nsidPrefix = "card.technology";
        this.spawnDecksThenFilter(pos, rot, nsidPrefix, (nsid) => {
            // "card.technology.red", "card.technology.red.muaat"
            const factionName = this.parseNsidGetTypePart(nsid, nsidPrefix, 3);
            if (factionName !== this._faction.raw.faction) {
                return false;
            }
            // Check if legal name.  Include "name.omega", etc versions.
            const parsed = ObjectNamespace.parseNsid(nsid);
            const name = parsed.name.split(".")[0];
            if (!acceptNames.has(name)) {
                // Unwanted card in the deck, or a typo?
                console.log(`Unregistered "${nsid}"`);
                return false;
            }
            return true;
        });
    }

    _setupFactionPromissoryNotes() {
        const pos = this.playerDesk.localPositionToWorld(
            PROMISSORY_DECK_LOCAL_OFFSET
        );
        const rot = this.playerDesk.rot;

        // Only use items listed in faction tables, not just because in deck.
        const acceptNames = new Set();
        this._faction.raw.promissoryNotes.forEach((name) =>
            acceptNames.add(name)
        );

        const nsidPrefix = "card.promissory";
        const deck = this.spawnDecksThenFilter(pos, rot, nsidPrefix, (nsid) => {
            // "card.promissory.jolnar" (careful about "card.promissory.blue").
            const factionName = this.parseNsidGetTypePart(nsid, nsidPrefix, 2);
            if (factionName !== this._faction.raw.faction) {
                return false;
            }
            // Check if legal name.  Include "name.omega", etc versions.
            const parsed = ObjectNamespace.parseNsid(nsid);
            const name = parsed.name.split(".")[0];
            if (!acceptNames.has(name)) {
                // Unwanted card in the deck, or a typo?
                console.log(`Unregistered "${nsid}"`);
                return false;
            }
            return true;
        });

        this.moveToCardHolder(deck);
    }

    _setupFactionLeaders() {
        // Arbitrary, will move to leader sheet later.
        const pos = this.playerDesk.pos.add([0, 0, 5]);
        const rot = this.playerDesk.rot;

        // Only use items listed in faction tables, not just because in deck.
        const acceptNames = new Set();
        this._faction.raw.leaders.agents.forEach((name) =>
            acceptNames.add(name)
        );
        this._faction.raw.leaders.commanders.forEach((name) =>
            acceptNames.add(name)
        );
        this._faction.raw.leaders.heroes.forEach((name) =>
            acceptNames.add(name)
        );
        this._faction.raw.units.forEach((name) => acceptNames.add(name));

        const nsidPrefix = "card.leader";
        return this.spawnDecksThenFilter(pos, rot, nsidPrefix, (nsid) => {
            // "card.leader.agent.x"
            const factionName = this.parseNsidGetTypePart(nsid, nsidPrefix, 3);
            if (factionName !== this._faction.raw.faction) {
                return false;
            }
            // Check if legal name.  Include "name.omega", etc versions.
            const parsed = ObjectNamespace.parseNsid(nsid);
            const name = parsed.name.split(".")[0];
            if (!acceptNames.has(name)) {
                // Unwanted card in the deck, or a typo?
                console.log(`Unregistered "${nsid}"`);
                return false;
            }
            return true;
        });
    }

    _setupFactionAlliance() {
        // Arbitrary, will move to leader sheet later.
        const pos = this.playerDesk.pos.add([-5, 0, 5]);
        const rot = this.playerDesk.rot;

        const nsidPrefix = "card.alliance";
        return this.spawnDecksThenFilter(pos, rot, nsidPrefix, (nsid) => {
            // "card.alliance:pok/faction"
            const parsed = ObjectNamespace.parseNsid(nsid);
            const factionName = parsed.name;
            return factionName === this._faction.raw.faction;
        });
    }

    _moveLeadersToSheet(leaderDeck) {
        assert(leaderDeck instanceof Card);

        // Find the leader sheet.
        const leaderSheetNsid = "sheet:pok/leader";
        const leaderSheet = this.findObjectOwnedByPlayerDesk(leaderSheetNsid);
        if (!leaderSheet) {
            return; // no leaderSheet sheet? abort.
        }

        const cardObjectArray = this.separateCards(leaderDeck);

        cardObjectArray.forEach((card) => {
            const nsid = ObjectNamespace.getNsid(card);
            let leaderType = false;
            if (nsid.startsWith("card.leader")) {
                leaderType = nsid.split(".")[2];
            } else if (nsid.startsWith("card.alliance")) {
                leaderType = "commander";
            }
            const count = this._leaderTypeToCount[leaderType];
            assert(typeof count === "number");
            this._leaderTypeToCount[leaderType] = count + 1;
            const leaderData = LEADERS[leaderType];
            const o = leaderData.sheetLocalOffset;
            const localOffset = new Vector(o.x, o.y, o.z).add([
                0,
                EXTRA_LEADER_OFFSET_Y * count,
                count,
            ]);
            const pos = leaderSheet.localPositionToWorld(localOffset);
            // GameObject.localRotationToWorld is broken (should be fixed in Feb2022)
            //const rot = leaderSheet.localRotationToWorld([
            //    0,
            //    0,
            //    leaderData.roll,
            //]);
            // Workaround:
            const roll = nsid.startsWith("card.alliance")
                ? 180
                : leaderData.roll;
            const rot = new Rotator(0, 0, roll).compose(
                leaderSheet.getRotation()
            );
            card.setPosition(pos);
            card.setRotation(rot);
        });
    }

    _setupFactionCommandControlTokens(tokenData) {
        tokenData.tokenNsid = `${tokenData.tokenNsidType}:${this._faction.raw.source}/${this._faction.raw.faction}`;
        return this.spawnTokensAndBag(tokenData);
    }

    _placeInitialCommandTokens(commandTokensBag) {
        assert(commandTokensBag instanceof Container);

        // Find the command sheet.
        const commandSheetNsid = "sheet:base/command";
        const commandSheet = this.findObjectOwnedByPlayerDesk(commandSheetNsid);
        if (!commandSheet) {
            return; // no command sheet? abort.
        }

        assert(
            commandTokensBag.getNumItems() >=
                COMMAND_TOKENS.commandSheetLocalOffsets.length
        );
        COMMAND_TOKENS.commandSheetLocalOffsets.forEach((offset) => {
            const pos = commandSheet.localPositionToWorld([
                offset.x,
                offset.y,
                offset.z,
            ]);
            const rot = commandSheet.localRotationToWorld([
                offset.pitch || 0,
                offset.yaw || 0,
                offset.roll || 0,
            ]);
            const token = commandTokensBag.takeAt(0, pos, true);
            token.setRotation(rot);
        });
    }

    _placeScoreboardOwnerToken(ownerTokensBag) {
        // TODO XXX
    }
}

module.exports = { SetupFaction, FACTION_SHEET };
