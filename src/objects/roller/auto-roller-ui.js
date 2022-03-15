const assert = require("../../wrapper/assert-wrapper");
const locale = require("../../lib/locale");
const { System } = require("../../lib/system/system");
const CONFIG = require("../../game-ui/game-ui-config");
const {
    Button,
    GameObject,
    HorizontalBox,
    LayoutBox,
    Text,
    TextJustification,
    UIElement,
    VerticalBox,
    refPackageId,
} = require("../../wrapper/api");

/**
 * Manage the UI on an AutoRoller object.
 */
class AutoRollerUI extends LayoutBox {
    /**
     * Constructor.
     *
     * @param {function} onButton - called with (rollType: string, planet: Planet or false, player: Player)
     */
    constructor(onButton) {
        assert(onButton);
        super();
        this._gameObject = false;
        this._uiElement = false;
        this._onButton = onButton;
        this._player = undefined;

        this.resetAwaitingSystemActivation();
    }

    setOwningObjectForUpdate(gameObject, uiElement) {
        assert(gameObject instanceof GameObject);
        assert(uiElement instanceof UIElement);
        this._gameObject = gameObject;
        this._uiElement = uiElement;
        return this;
    }

    setDoRefresh(doRefresh) {
        assert(typeof doRefresh === "function");
        this._doRefresh = doRefresh;
        return this;
    }

    _update() {
        if (this._gameObject && this._uiElement) {
            this._gameObject.updateUI(this._uiElement);
        }
        if (this._doRefresh) {
            this._doRefresh();
        }
    }

    /**
     * Reset for "no system activated".
     */
    resetAwaitingSystemActivation() {
        const panel = new VerticalBox().setChildDistance(CONFIG.spacing);

        const message = new Text()
            .setFontSize(CONFIG.fontSize)
            .setText(locale("ui.message.no_system_activated"));
        panel.addChild(message);

        panel.addChild(new LayoutBox(), 1); // stretch to fill space

        const reportModifiers = new Button()
            .setFontSize(CONFIG.fontSize)
            .setText(locale("ui.roller.report_modifiers"));
        reportModifiers.onClicked.add((button, player) => {
            this._onButton("reportModifiers", false, player);
        });
        panel.addChild(reportModifiers);

        this.setChild(panel);
        this._update();
    }

    /**
     * Reset for the given system.
     *
     * Get localized planet names by: `system.planets[].getNameStr()`
     *
     * To test with a system get one via `world.TI4.getSystemByTileNumber(#)`.
     *
     * @param {System} system
     */
    resetAfterSystemActivation(system) {
        assert(system instanceof System);

        const panels = [new VerticalBox().setChildDistance(5)];

        const addButton = (parent, localeText, combatType, planet) => {
            assert(typeof parent === "object");
            const button = new Button()
                .setText(locale(localeText))
                .setFontSize(9);
            button.onClicked.add((button, player) => {
                this._onButton(combatType, planet, player);
            });
            parent[parent.length - 1].addChild(button);
            return button;
        };

        const addLayoutButton = (
            parent,
            localeText,
            combatType,
            planet,
            fontSize,
            maxWidth,
            maxHeight
        ) => {
            assert(typeof parent === "object");
            const lbox1 = new LayoutBox()
                .setOverrideWidth(maxWidth)
                .setOverrideHeight(maxHeight);
            const button = new Button()
                .setText(locale(localeText))
                .setFontSize(fontSize);
            const lbox2 = new LayoutBox()
                .setVerticalAlignment(2)
                .setHorizontalAlignment(2);
            const hpanel = new HorizontalBox().setChildDistance(5);
            button.onClicked.add((button, player) => {
                this._onButton(combatType, planet, player);
            });
            lbox1.setChild(button);
            hpanel.addChild(lbox1);
            lbox2.setChild(hpanel);
            parent[parent.length - 1].addChild(lbox2);
        };

        const addLayoutText = (
            parent,
            localeText,
            fontSize,
            italize,
            maxWidth,
            maxHeight,
            fontfile = ""
        ) => {
            assert(typeof parent === typeof []);
            const text = new Text()
                .setText(locale(localeText))
                .setJustification(TextJustification.Center)
                .setFontSize(fontSize)
                .setItalic(italize)
                .setFont(fontfile, refPackageId);
            const lbox1 = new LayoutBox()
                .setOverrideWidth(maxWidth)
                .setOverrideHeight(maxHeight);
            const lbox2 = new LayoutBox()
                .setVerticalAlignment(2)
                .setHorizontalAlignment(2);
            const hpanel = new HorizontalBox().setChildDistance(5);
            lbox1.setChild(text);
            hpanel.addChild(lbox1);
            lbox2.setChild(hpanel);
            parent[parent.length - 1].addChild(lbox2);
        };

        const addHorizontalSubPanel = (parent, spacing) => {
            assert(typeof parent === typeof []);
            const panel = new HorizontalBox().setChildDistance(spacing);
            const lbox = new LayoutBox()
                .setVerticalAlignment(2)
                .setHorizontalAlignment(2);
            lbox.setChild(panel);
            parent[parent.length - 1].addChild(lbox);
            parent.push(panel);
        };

        const addVerticalSubPanel = (parent, spacing) => {
            assert(typeof parent === typeof []);
            const panel = new VerticalBox().setChildDistance(spacing);
            parent[parent.length - 1].addChild(panel);
            parent.push(panel);
        };

        const addPlanetSteps = (parent, planet) => {
            assert(typeof parent === typeof []);
            addVerticalSubPanel(parent, 5);
            addLayoutText(parent, planet.localeName, 10, true, -1, -1);
            addButton(
                parent,
                locale("ui.roller.bombardment"),
                "bombardment",
                planet
            );
            addButton(
                parent,
                locale("ui.roller.space_cannon_defense"),
                "spaceCannonDefense",
                planet
            );
            addButton(
                parent,
                locale("ui.roller.ground_combat"),
                "groundCombat",
                planet
            );
            parent.pop();
        };

        const addGap = (parent, padW, padE, padN, padS) => {
            assert(typeof parent === typeof []);
            const lbox = new LayoutBox();
            lbox.setPadding(padW, padE, padN, padS);
            parent[parent.length - 1].addChild(lbox);
        };

        //Movement step
        addLayoutText(
            panels,
            locale("ui.label.movement"),
            12,
            false,
            -1,
            -1,
            "Handel_Gothic_Regular.otf"
        );
        addHorizontalSubPanel(panels, 2);
        addLayoutButton(
            panels,
            locale("ui.movement.finish_movement"),
            "finishMove",
            false,
            10,
            150,
            -1
        );
        addGap(panels, 5, 0, 0, 0);
        addLayoutButton(
            panels,
            "ui.roller.space_cannon_offense",
            "spaceCannon",
            false,
            10,
            150,
            -1
        );
        panels.pop();

        //Combat step
        addLayoutText(
            panels,
            locale("ui.label.space_combat"),
            12,
            false,
            -1,
            -1,
            "Handel_Gothic_Regular.otf"
        );
        addLayoutButton(
            panels,
            "ui.roller.anti_fighter_barrage",
            "antiFighterBarrage",
            false,
            9,
            200,
            -1
        );
        addLayoutButton(
            panels,
            "ui.roller.announce_retreat",
            "announceRetreat",
            false,
            9,
            200,
            -1
        );
        addLayoutButton(
            panels,
            "ui.roller.space_combat",
            "spaceCombat",
            false,
            9,
            200,
            -1
        );

        //Invasion step
        addLayoutText(
            panels,
            locale("ui.label.invasion"),
            12,
            false,
            -1,
            -1,
            "Handel_Gothic_Regular.otf"
        );
        addHorizontalSubPanel(panels, 2);
        system.planets.forEach((planet) => {
            addPlanetSteps(panels, planet);
            addGap(panels, 3, 0, 0, 0);
        });
        panels.pop();

        //Production step
        addLayoutText(
            panels,
            locale("ui.label.production"),
            12,
            false,
            -1,
            -1,
            "Handel_Gothic_Regular.otf"
        );
        addLayoutButton(
            panels,
            locale("ui.label.production"),
            "production",
            false,
            9,
            200,
            -1
        );

        //Extra
        addVerticalSubPanel(panels, 0);
        addLayoutButton(
            panels,
            "ui.roller.report_modifiers",
            "reportModifiers",
            false,
            7,
            100,
            -1
        );
        panels.pop();

        this.setChild(panels[panels.length - 1]);
        this._update();
    }
}

module.exports = { AutoRollerUI };
