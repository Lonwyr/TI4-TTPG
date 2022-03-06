require("../../../global"); // register world.TI4
const assert = require("assert");
const { Hex } = require("../../hex");
const { MiltySliceLayout, SLICE_HEXES } = require("./milty-slice-layout");
const { Vector, world } = require("../../../wrapper/api");

it("_getAnchorPosition", () => {
    const playerDesk = world.TI4.getAllPlayerDesks()[0];
    const playerSlot = playerDesk.playerSlot;
    const pos = MiltySliceLayout._getAnchorPosition(playerSlot);
    assert(pos instanceof Vector);
});

it("_getTilePositions", () => {
    const anchorPos = new Vector(0, 0, 0);
    const yaw = 0;
    const posArray = MiltySliceLayout._getTilePositions(anchorPos, yaw);
    assert(Array.isArray(posArray));
    assert.equal(posArray.length, 5);
    const hexArray = posArray.map((pos) => {
        return Hex.fromPosition(pos);
    });
    assert.deepEqual(hexArray, SLICE_HEXES);
});

it("_toMapString", () => {
    const miltySliceString = "1 2 3 4 5";
    const playerDesk = world.TI4.getAllPlayerDesks()[0];
    const playerSlot = playerDesk.playerSlot;
    const mapString = MiltySliceLayout._toMapString(
        miltySliceString,
        playerSlot
    );
    assert(typeof mapString === "string");
    assert(mapString.length > 0);
    assert.equal(
        mapString,
        "{0} 0 0 0 0 0 0 0 0 0 4 1 0 0 0 0 0 0 0 0 0 0 0 5 2 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 3"
    );
});
