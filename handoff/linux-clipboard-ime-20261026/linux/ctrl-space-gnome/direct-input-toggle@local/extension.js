import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Keyboard from 'resource:///org/gnome/shell/ui/status/keyboard.js';

const IFACE = `<node><interface name="org.local.DirectInputToggle"><method name="GetStatus"><arg name="status" type="s" direction="out"/></method></interface></node>`;
const PATH = '/org/local/DirectInputToggle';
const KEY = 'toggle-direct-input';
const describe = source => source ? `${source.type}:${source.id}` : null;

export default class DirectInputToggle extends Extension {
    enable() {
        this._manager = Keyboard.getInputSourceManager();
        this._count = 0;
        this._last = null;
        this._lastAt = 0;
        // A grab supplied by Mutter, never a raw key logger or key injector.
        if (Meta.KeyBindingFlags.IGNORE_AUTOREPEAT === undefined)
            throw new Error('Mutter IGNORE_AUTOREPEAT is required');
        this._settings = this.getSettings();
        this._action = Main.wm.addKeybinding(KEY, this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            () => this._toggle());
        if (this._action === Meta.KeyBindingAction.NONE) {
            Main.wm.removeKeybinding(KEY);
            throw new Error('Ctrl+Space keybinding registration failed');
        }
        this._changedId = this._manager.connect('current-source-changed', () => {
            if (this._last)
                this._last.desktopCurrent = describe(this._manager.currentSource);
        });
        this._dbus = Gio.DBusExportedObject.wrapJSObject(IFACE, {
            GetStatus: () => JSON.stringify({enabled: true,
                current: describe(this._manager.currentSource),
                activations: this._count, last: this._last,
                evidence: 'Mutter callback and GNOME source state only; actual application input remains unverified'}),
        });
        this._dbus.export(Gio.DBus.session, PATH);
        console.log('direct-input-toggle: registered Ctrl+Space without chooser');
    }

    _toggle() {
        const now = GLib.get_monotonic_time();
        if (now - this._lastAt < 250000)
            return;
        const current = this._manager.currentSource;
        const nextId = current?.type === 'ibus' && current.id === 'libpinyin' ? 'us' : 'libpinyin';
        const type = nextId === 'us' ? 'xkb' : 'ibus';
        const target = Object.values(this._manager.inputSources)
            .find(source => source.type === type && source.id === nextId);
        if (!target) {
            console.error(`direct-input-toggle: missing configured source ${type}:${nextId}`);
            return;
        }
        this._lastAt = now;
        this._count++;
        this._last = {sequence: this._count, at: new Date().toISOString(),
            before: describe(current), requested: describe(target),
            desktopCurrent: describe(current)};
        // Same activation path as the desktop menu, with no switcher popup.
        // It synchronizes layout, desktop state, MRU and IBus, without sending keys.
        target.activate(true);
        this._last.desktopCurrent = describe(this._manager.currentSource);
        console.log(`direct-input-toggle: callback=${this._count} ${this._last.before} -> ${this._last.desktopCurrent}; application input unverified`);
    }

    disable() {
        this._dbus?.unexport();
        this._dbus = null;
        if (this._changedId)
            this._manager.disconnect(this._changedId);
        this._changedId = 0;
        Main.wm.removeKeybinding(KEY);
        this._settings = null;
        this._manager = null;
    }
}
