const assert = require("../wrapper/assert-wrapper");
const { ColorUtil } = require("../lib/color/color-util");
const { ObjectNamespace } = require("../lib/object-namespace");
const {
    Color,
    GameObject,
    ImageWidget,
    Rotator,
    UIElement,
    Vector,
    globalEvents,
    refPackageId,
    world,
} = require("../wrapper/api");

const OVERLAY_PNG = "global/ui/hex_highlight_notched.png";
const OVERLAY_PNG_SIZE = 110; // 115 for full, make a little smaller to allow for borders
const OVERLAY_SCALE = 4;

const PULSE_SECONDS = 3; // from 0->1->0
const DISPLAY_SECONDS_APPROX = 15; // 30 in TTS
const DISPLAY_SECONDS =
    Math.ceil(DISPLAY_SECONDS_APPROX / PULSE_SECONDS) * PULSE_SECONDS; // complete last pulse

const _imageWidget = new ImageWidget(); // recycling avoids "new UI slowdown" issue (awaiting TTPG fix Nov-2022)
let _systemHighlight = undefined;

class SystemHighlight {
    constructor(obj, color, infinite) {
        assert(obj instanceof GameObject);
        assert(ColorUtil.isColor(color));

        this._mintTimeMsecs = Date.now();
        this._obj = obj;
        this._color = new Color(color.r, color.g, color.b, 1);
        this._ui = new UIElement();
        this._updateHandler = () => {
            const age = Date.now() - this._mintTimeMsecs;
            if (age / 1000 > DISPLAY_SECONDS && !infinite) {
                this.detachUI();
                _systemHighlight = false;
                return;
            }
            this.updateImg();
        };

        // Attach UI (registers listener).
        this.attachUI();
    }

    attachUI() {
        this._ui.position = new Vector(0, 0, 0.13);
        this._ui.rotation = new Rotator(0, 0, 0);
        this._ui.widget = _imageWidget
            .setImageSize(OVERLAY_PNG_SIZE * OVERLAY_SCALE, 0)
            .setImage(OVERLAY_PNG, refPackageId);
        this._ui.useTransparency = true;
        this._ui.scale = 1 / OVERLAY_SCALE;
        this._obj.addUI(this._ui);

        this.updateImg();
        globalEvents.onTick.add(this._updateHandler);
    }

    detachUI() {
        globalEvents.onTick.remove(this._updateHandler);
        this._obj.removeUIElement(this._ui);
    }

    updateImg() {
        const age = (Date.now() - this._mintTimeMsecs) / 1000;
        const u = (age % PULSE_SECONDS) / PULSE_SECONDS;
        const phi = u * Math.PI * 2;
        this._color.a = 1 - (Math.cos(phi) + 1) / 2;
        assert(this._color.a >= 0 && this._color.a <= 1);
        this._ui.widget.setTintColor(this._color);
    }
}

function applyHighlight(obj, color) {
    // Remove any old UI.
    if (_systemHighlight) {
        _systemHighlight.detachUI();
        _systemHighlight = undefined;
    }

    assert(!_imageWidget.getOwningObject());

    _systemHighlight = new SystemHighlight(obj, color);
}

globalEvents.TI4.onSystemActivated.add((obj, player) => {
    assert(ObjectNamespace.isSystemTile(obj));
    const currentDesk = world.TI4.turns.getCurrentTurn();
    const color = currentDesk ? currentDesk.plasticColor : new Color(1, 1, 0);
    applyHighlight(obj, color);
});

module.exports = { SystemHighlight };
