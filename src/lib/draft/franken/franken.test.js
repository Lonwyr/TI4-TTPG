require("../../../global"); // register world.TI4
const assert = require("assert");
const { FACTION_ABILITIES, UNDRAFTABLE } = require("./franken.data");
const { FactionAbilitySchema, UndraftableSchema } = require("./franken.schema");
const { MockGameObject, world } = require("../../../wrapper/api");

it("faction abilities", () => {
    for (const ability of FACTION_ABILITIES) {
        assert(FactionAbilitySchema.validate(ability));
    }
});

it("undraftable", () => {
    for (const undraftable of UNDRAFTABLE) {
        assert(UndraftableSchema.validate(undraftable));
    }
});

it("_setTurnOrder", () => {
    world.__clear();

    // Get a list of desks, move front to back.
    const desks = world.TI4.getAllPlayerDesks();
    const move = desks.shift();
    desks.push(move);

    desks.forEach((desk, index) => {
        const json = JSON.stringify({ franken: true, turnOrder: index });
        world.__addObject(
            new MockGameObject({
                position: desk.pos,
                templateMetadata: "tile.strategy:base/trade",
                savedData: json,
            })
        );
    });

    const expectedOrder = desks.map((desk) => desk.index);
    const observedOrder = world.TI4.turns
        .getTurnOrder()
        .map((desk) => desk.index);
    assert.deepEqual(observedOrder, expectedOrder);
});
