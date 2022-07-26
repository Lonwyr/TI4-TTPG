require("../global"); // create globalEvents.TI4
const assert = require("assert");
const locale = require("../lib/locale");
const { setupStrategyCard } = require("./strategy-card-functions");
const {
    globalEvents,
    MockGameObject,
    MockPlayer,
} = require("../mock/mock-api");

it("setupStrategyCard creates a play button and a custom action", () => {
    let card = new MockGameObject();

    setupStrategyCard(card);

    assert(card.getUIs().length === 1);
    assert(card._customActions.length === 1);
});

describe("on actions", () => {
    afterEach(() => {
        globalEvents.TI4.onStrategyCardPlayed.clear();
    });

    it("the custom action triggers the global event on play", () => {
        let card = new MockGameObject();
        let playButtonHitCounter = 0;
        globalEvents.TI4.onStrategyCardPlayed.add(() => playButtonHitCounter++);

        setupStrategyCard(card);

        card.onCustomAction.trigger(
            card,
            undefined /*player*/,
            "*" + locale("ui.button.strategy_card_play")
        );
        expect(playButtonHitCounter).toBe(1);
        card.onCustomAction.trigger(
            card,
            undefined /*player*/,
            "not the button you are looking for"
        );
        expect(playButtonHitCounter).toBe(1);
    });

    it("the button triggers the global event on click", (done) => {
        let card = new MockGameObject();
        const player = new MockPlayer();
        globalEvents.TI4.onStrategyCardPlayed.add(
            (owningObject, clickingPlayer) => {
                done();
            }
        );

        setupStrategyCard(card);
        const playButton = card.play_button;
        playButton.widget.onClicked.trigger(playButton.widget, player);
    });
});
