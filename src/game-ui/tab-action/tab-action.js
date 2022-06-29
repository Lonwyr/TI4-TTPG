const locale = require("../../lib/locale");
const { TabbedPanel } = require("../../lib/ui/tabbed-panel");
const { TabTactical } = require("./tab-tactical/tab-tactical");
const CONFIG = require("../game-ui-config");
const { Text, globalEvents } = require("../../wrapper/api");

class TabAction {
    constructor() {
        const tabbedPanel = new TabbedPanel()
            .setFontSize(CONFIG.fontSize)
            .setSpacing(CONFIG.spacing);

        // const systemImg = new ImageWidget().setImage(
        //     "locale/ui/tiles/base/special/tile_018.png",
        //     refPackageId
        // );
        // const systemBox = new LayoutBox()
        //     .setChild(systemImg)
        //     .setOverrideHeight(300)
        //     .setOverrideWidth(300);
        // const tacticalPanel = new HorizontalBox()
        //     .addChild(autoRoller.getUI())
        //     .addChild(systemBox);

        const tabTactical = new TabTactical();
        tabbedPanel.addTab(
            locale("ui.tab.tactical_action"),
            tabTactical.getUI(),
            true
        );

        tabbedPanel.addTab(
            locale("ui.tab.strategic_action"),
            new Text()
                .setFontSize(CONFIG.fontSize)
                .setText(locale("ui.strategy.instructions"))
                .setAutoWrap(true)
        );

        tabbedPanel.addTab(
            locale("ui.tab.component_action"),
            new Text()
                .setFontSize(CONFIG.fontSize)
                .setText(locale("ui.component.instructions"))
                .setAutoWrap(true)
        );

        this._ui = tabbedPanel;

        globalEvents.TI4.onSystemActivated.add((systemTileObj, player) => {
            tabbedPanel.selectTab(locale("ui.tab.tactical_action"));
        });
    }

    getUI() {
        return this._ui;
    }
}

module.exports = { TabAction };
