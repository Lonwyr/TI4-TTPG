require("../../global"); // register world.TI4
const assert = require("assert");
const UPDATOR = require("./updator-player-planet-cards");
const { MockCard, MockCardDetails, world } = require("../../wrapper/api");

it("player.planetCards", () => {
    const playerDesks = world.TI4.getAllPlayerDesks();
    const data = {
        players: playerDesks.map((desk) => {
            return { color: desk.colorName };
        }),
    };

    world.__clear();
    world.__addObject(
        new MockCard({
            allCardDetails: [
                new MockCardDetails({
                    metadata: "card.planet:base/meer",
                    name: "Meer",
                }),
            ],
            faceUp: false,
            position: playerDesks[0].center,
        })
    );
    world.__addObject(
        new MockCard({
            allCardDetails: [
                new MockCardDetails({
                    metadata: "card.planet:base/mecatol_rex",
                    name: "Mecatol Rex",
                }),
            ],
            faceUp: false,
            position: playerDesks[0].center,
        })
    );
    world.__addObject(
        new MockCard({
            allCardDetails: [
                new MockCardDetails({
                    metadata: "card.planet:pok/mallice",
                    name: "Mallice",
                }),
            ],
            faceUp: true,
            position: playerDesks[0].center,
        })
    );

    UPDATOR(data);
    world.__clear();

    assert.deepEqual(data.players[0].planetCards, [
        "Meer",
        "Mecatol Rex",
        "Mallice",
    ]);
});
