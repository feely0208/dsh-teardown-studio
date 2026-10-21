/**
 * @deepwhale-cn/dsh-teardown-studio — client half
 * Registers a real sidebar panel (not a floating overlay), like the other
 * DeepWhale shell plugins. The panel is the local Studio served by lib/server.mjs.
 */
window.__ModuleLoader__.load({
  id: '@deepwhale-cn/dsh-teardown-studio',
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    const react = require('react');
    const h = react.createElement;
    const PANEL_ID = 'teardown-studio';
    const SLOT_ICON = 'sidebar.panellist';
    const SLOT_MAIN = 'main';
    const SRC = 'http://127.0.0.1:17899/studio/?panel=1';
    function Icon(){ return h('span', { style: { fontSize: '15px', lineHeight: 1 } }, '◈'); }

    const CSS = `
.dsh-ts-wrap{width:100%;height:100%;min-height:0;background:#061324;overflow:hidden}
.dsh-ts-wrap iframe{width:100%;height:100%;border:0;display:block;background:#061324}
.dsh-ts-fallback{padding:24px;color:#9fb3cc;font:13px/1.6 -apple-system,"PingFang SC",sans-serif}
.dsh-ts-fallback b{color:#e7f1ff}
`;

    function Panel() {
      return h('div', { className: 'dsh-ts-wrap' }, [
        h('style', { key: 's' }, CSS),
        h('iframe', { key: 'i', src: SRC, title: '拆解工作室' }),
      ]);
    }

    function apply(ctx) {
      ctx.slots.inject(SLOT_MAIN, function* () {
        yield ctx.slots.register({ name: SLOT_MAIN, key: PANEL_ID }, Panel);
      });
      ctx.slots.inject(SLOT_ICON, function* () {
        yield ctx.slots.register(
          { name: SLOT_ICON, id: PANEL_ID, order: 24, label: '拆解工作室' },
          Icon,
        );
      });
    }

    exports.inject = ['slots'];
    exports.apply = apply;
    return module.exports;
  },
});
