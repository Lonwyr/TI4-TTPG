const assert = require("../../../wrapper/assert-wrapper");
const { Hex } = require("../../hex");
const MapStringHex = require("../../map-string/map-string-hex");
const { MapStringLoad } = require("../../map-string/map-string-load");
const { ObjectNamespace } = require("../../object-namespace");
const {
    SetupGenericHomeSystems,
} = require("../../../setup/setup-generic-home-systems");
const { world } = require("../../../wrapper/api");

const SLICE_HEXES = [
    "<1,-1,0>",
    "<1,0,-1>",
    "<0,1,-1>",
    "<2,-1,-1>",
    "<2,0,-2>",
];

class MiltySliceLayout {
    static _getAnchorPosition(playerSlot) {
        assert(typeof playerSlot === "number");

        // Find generic home system anchor.
        for (const obj of world.getAllObjects()) {
            if (obj.getContainer()) {
                continue;
            }
            if (obj.getOwningPlayerSlot() !== playerSlot) {
                continue;
            }
            const nsid = ObjectNamespace.getNsid(obj);
            if (nsid !== "tile.system:base/0") {
                continue;
            }
            const pos = obj.getPosition();
            return pos;
        }

        // No anchor?  Use default.
        const playerDesk = world.TI4.getPlayerDeskByPlayerSlot(playerSlot);
        assert(playerDesk);
        return SetupGenericHomeSystems.getHomeSystemPosition(playerDesk);
    }

    static _getTilePositions(anchorPos, yaw) {
        assert(typeof anchorPos.x === "number");
        assert(typeof yaw === "number");

        return SLICE_HEXES.map((hex) => {
            return Hex.toPosition(hex)
                .rotateAngleAxis(yaw, [0, 0, 1])
                .add(anchorPos);
        });
    }

    static _toMapString(miltySliceString, playerSlot) {
        assert(typeof miltySliceString === "string");
        assert(typeof playerSlot === "number");

        const tileNumbers = Array.from(miltySliceString.matchAll(/\d+/g)).map(
            (str) => Number.parseInt(str)
        );
        assert(Array.isArray(tileNumbers));
        assert(tileNumbers.length === SLICE_HEXES.length);

        // Get tile positions.
        const anchorPos = MiltySliceLayout._getAnchorPosition(playerSlot);
        const yaw = anchorPos.findLookAtRotation([0, 0, anchorPos.z]).yaw;
        const posArray = MiltySliceLayout._getTilePositions(anchorPos, yaw);

        // Convert to map string index values.
        const idxArray = posArray.map((pos) => {
            const hex = Hex.fromPosition(pos);
            return MapStringHex.hexStringToIdx(hex);
        });

        // Generate slice as a map string (not slice string)
        const mapStringArray = [];
        for (let i = 0; i < idxArray.length; i++) {
            const idx = idxArray[i];
            const tile = tileNumbers[i];
            mapStringArray[idx] = tile;
        }

        // Fill in any missing slots.
        for (let i = 0; i < mapStringArray.length; i++) {
            if (!mapStringArray[i]) {
                mapStringArray[i] = 0;
            }
        }
        mapStringArray[0] = "{0}";

        return mapStringArray.join(" ");
    }

    static doLayout(miltySliceString, playerSlot) {
        assert(typeof miltySliceString === "string");
        assert(typeof playerSlot === "number");

        const mapString = MiltySliceLayout._toMapString(
            miltySliceString,
            playerSlot
        );
        console.log(mapString);
        MapStringLoad.load(mapString, true);
    }
}

module.exports = { MiltySliceLayout, SLICE_HEXES };
