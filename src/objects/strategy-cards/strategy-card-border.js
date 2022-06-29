const assert = require("../../wrapper/assert-wrapper");
const {
    Border,
    GameObject,
    Rotator,
    UIElement,
    world,
} = require("../../wrapper/api");
const { PlayerDesk } = require("../../lib/player-desk/player-desk");

/**
 * A border holding the UI elements for the strategy card popups.
 * Since the UIElement added to the world does not have a association (i.e. child/parent)
 * to the containing widget, the UIElement itself contains all necessary associations:
 * - the UI added to the world and containing it
 * - the Desk on which it is displayed
 * - the strategy card which spawned the UI
 */
class StrategyCardBorder extends Border {
    /**
     * Constructor of a new StrategyCardBorder.
     * To handle the item correct on triggered events, the associations
     * <code>ui</code>, <code>card</code> and <code>playerDesk</code>, <code>height</code>
     * are necessary.
     *
     * @param data {object}
     * @param data.card {GameObject} The strategy card containing the border
     * @param data.desk {PlayerDesk} The player desk where the border will be placed
     * @param data.height {Integer} The height of the UI
     * @param data.width {Integer} The width of the UI
     * @param data.ui {UIElement} The UIElement containing the border
     */
    constructor(data) {
        assert(data.card instanceof GameObject);
        assert(data.desk instanceof PlayerDesk);
        assert(Number.isInteger(data.height));
        assert(Number.isInteger(data.width));
        assert(data.ui instanceof UIElement);

        super(data);

        this._card = data.card;
        this._desk = data.desk;
        this._height = data.height;
        this._width = data.width;
        this._ui = data.ui;
    }

    /**
     * @returns {GameObject} The strategy card associated with the border
     */
    get card() {
        return this._card;
    }

    /**
     * @returns {PlayerDesk} The playerDesk card associated with the border
     */
    get desk() {
        return this._desk;
    }

    /**
     * @returns {Integer} The height of the UI
     */
    get height() {
        return this._height;
    }

    /**
     * @returns {Integer} The width of the UI
     */
    get width() {
        return this._width;
    }

    /**
     * @returns {UIElement} The playerDesk card associated with the border
     */
    get ui() {
        return this._ui;
    }

    /**
     * (Re)position the UI on the players desk. The <code>index</code> is used for
     * the z-offset in case of multiple strategy card UIs on the same desk.
     *
     * @param {Integer} index Position of the UI on the stack on the players desk
     */
    positionUi(index) {
        this._ui.anchorY = 1;
        this._ui.position = this._desk.localPositionToWorld({
            x: 10 + index * 2,
            y: 0,
            z: 5,
        });
        world.updateUI(this._ui);
    }

    /**
     * Spawns the UI by setting the required associations, calculating the
     * position & rotation and adding the UI to the world.
     */
    spawnUi(index) {
        this._ui.useWidgetSize = false;
        this._ui.widget = this;
        this._ui.height = this.height;
        this._ui.width = this.width;
        this._ui.scale = 0.65;
        this.positionUi(index);
        this._ui.rotation = this._desk.localRotationToWorld(
            new Rotator(35, 0, 0)
        );
        world.addUI(this._ui);
    }
}

module.exports = {
    StrategyCardBorder,
};
